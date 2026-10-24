
const path = require("node:path");
const fs = require("node:fs");
if (process.env.NODE_ENV !== "test") {
  require("dotenv").config({ path: path.join(__dirname, ".env"), quiet: true });
}

const express = require("express");
const { randomUUID } = require("node:crypto");
const { authenticate } = require("@google-cloud/local-auth");
const { google } = require("googleapis");
const { DateTime } = require("luxon");
const { DatabaseSync } = require("node:sqlite");

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v26.0";

const ZONE = "America/Mexico_City";
const CALENDAR_ID = "primary";
const HOURS = [10, 11, 15];
const OFFER_LIFETIME = 15 * 60 * 1000;

const CREDENTIALS = path.join(__dirname, "credentials.json");
const DB_PATH = path.resolve(__dirname, process.env.NUKMIRIS_DB_PATH || "data/nukmiris-sessions.sqlite");

if (!TOKEN || !PHONE_ID || !VERIFY_TOKEN) {
  throw new Error("Missing WhatsApp configuration. Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_VERIFY_TOKEN; see backend/.env.example.");
}
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error("PORT must be an integer between 0 and 65535.");
}
if (!fs.existsSync(DB_PATH)) {
  throw new Error("Existing Phase 6A.3 database required. Set NUKMIRIS_DB_PATH; no database was created.");
}

let calendar;

// ==================================================
// PHASE 6A.4 — DEVELOPMENT TENANT ROUTING AND SCOPED STORAGE
// Production must route by receiving Meta business phone-number ID,
// never by customer sender phone number. No fallback to a default tenant.
// ==================================================
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");
const requiredTables = [
  "businesses", "business_customers", "dev_test_business_routes",
  "business_customer_sessions", "business_support_conversations",
  "business_support_messages"
];
const presentTables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name));
for (const table of requiredTables) {
  if (!presentTables.has(table)) throw new Error(`Phase 6A prerequisite missing: ${table}`);
}
const routeQuery = db.prepare(`
  SELECT r.business_id, b.business_name
  FROM dev_test_business_routes r JOIN businesses b ON b.business_id = r.business_id
  WHERE r.sender_whatsapp_id = ? AND b.status = 'test'
`);
function businessFor(from) {
  const business = routeQuery.get(from);
  if (!business) throw new Error(`No approved Phase 6A development business mapping for sender ${from}`);
  return business;
}

class BusinessSessions {
  constructor(db) {
    this.find = db.prepare("SELECT session_json FROM business_customer_sessions WHERE business_id=? AND whatsapp_id=?");
    this.save = db.prepare(`INSERT INTO business_customer_sessions
      (business_id,whatsapp_id,session_json,expires_at) VALUES (?,?,?,?)
      ON CONFLICT(business_id,whatsapp_id) DO UPDATE SET
      session_json=excluded.session_json, expires_at=excluded.expires_at`);
    this.remove = db.prepare("DELETE FROM business_customer_sessions WHERE business_id=? AND whatsapp_id=?");
  }
  get(from) {
    const row = this.find.get(businessFor(from).business_id, from);
    return row ? JSON.parse(row.session_json) : undefined;
  }
  set(from, session) {
    if (!Number.isFinite(session.expiresAt)) throw new Error("Session requires expiration");
    this.save.run(businessFor(from).business_id, from, JSON.stringify(session), session.expiresAt);
    return this;
  }
  delete(from) { return this.remove.run(businessFor(from).business_id, from).changes > 0; }
}
const sessions = new BusinessSessions(db);

class BusinessCustomers {
  constructor(db) {
    this.find = db.prepare("SELECT * FROM business_customers WHERE business_id=? AND whatsapp_id=?");
    this.insert = db.prepare(`INSERT OR IGNORE INTO business_customers
      (customer_id,business_id,whatsapp_id,full_name,created_at,updated_at)
      VALUES (?,?,?,?,?,?)`);
  }
  get(from) { return this.find.get(businessFor(from).business_id, from); }
  register(from, name) {
    const now = new Date().toISOString();
    this.insert.run(randomUUID(), businessFor(from).business_id, from, name, now, now);
    return this.get(from);
  }
}
const customers = new BusinessCustomers(db);

class BusinessHumanSupport {
  constructor(db) {
    this.find = db.prepare("SELECT status FROM business_support_conversations WHERE business_id=? AND whatsapp_id=?");
    this.openStatement = db.prepare(`INSERT INTO business_support_conversations
      (business_id,whatsapp_id,customer_id,status,assigned_to,created_at,updated_at)
      VALUES (?,?,?,'waiting',NULL,?,?)
      ON CONFLICT(business_id,whatsapp_id) DO UPDATE SET
      status='waiting', customer_id=excluded.customer_id, updated_at=excluded.updated_at`);
    this.closeStatement = db.prepare(`UPDATE business_support_conversations SET status='closed', updated_at=?
      WHERE business_id=? AND whatsapp_id=?`);
    this.messageStatement = db.prepare(`INSERT OR IGNORE INTO business_support_messages
      (id,business_id,whatsapp_id,direction,message_text,created_at)
      VALUES (?,?,?,'incoming',?,?)`);
    this.touchStatement = db.prepare(`UPDATE business_support_conversations
      SET status='waiting', updated_at=? WHERE business_id=? AND whatsapp_id=?`);
  }
  isOpen(from) {
    const status = this.find.get(businessFor(from).business_id, from)?.status;
    return status === 'waiting' || status === 'in_progress';
  }
  open(from, customerId) {
    const now = new Date().toISOString();
    this.openStatement.run(businessFor(from).business_id, from, customerId || null, now, now);
  }
  saveMessage(from, id, content) {
    const businessId = businessFor(from).business_id;
    const now = new Date().toISOString();
    this.messageStatement.run(id || randomUUID(), businessId, from, content, now);
    this.touchStatement.run(now, businessId, from);
  }
  close(from) {
    this.closeStatement.run(new Date().toISOString(), businessFor(from).business_id, from);
  }
}
const humanSupport = new BusinessHumanSupport(db);

const SCHEDULING_PAUSED = "Las citas están temporalmente deshabilitadas mientras configuramos el calendario de este negocio. Puedes escribir Menu para regresar o Hablar con alguien para recibir ayuda.";

// Locks remain process-local in Phase 5A.
const busyCustomers = new Set();
const lockedSlots = new Set();
const lockedEvents = new Set();
const processedMessages = new Map();


// ==================================================
// GOOGLE CALENDAR CONNECTION
// ==================================================

async function connectCalendar() {
  console.log("Connecting to Google Calendar...");

  const auth = await authenticate({
    scopes: ["https://www.googleapis.com/auth/calendar"],
    keyfilePath: CREDENTIALS
  });

  calendar = google.calendar({
    version: "v3",
    auth
  });

  await calendar.calendarList.list({ maxResults: 1 });

  console.log("Google Calendar connected successfully.");
  console.log("Persistent sessions: SQLite enabled");
  console.log("Customer registry: SQLite enabled");
}

// ==================================================
// DATE AND PHONE UTILITIES
// ==================================================

function formatTime(iso) {
  return DateTime.fromISO(iso)
    .setZone(ZONE)
    .setLocale("es")
    .toFormat("cccc d 'de' LLLL, h:mm a");
}

function keyFor(slot) {
  return `${slot.start}|${slot.end}`;
}

// Normalize Mexican WhatsApp incoming identifiers for outbound messages.
// Keep the original incoming identifier unchanged for SQLite lookups.
function normalizeRecipient(phone) {
  const recipient = String(phone);
  return /^521\d{10}$/.test(recipient)
    ? "52" + recipient.slice(3)
    : recipient;
}

// Format the incoming WhatsApp identifier for display.
// The original identifier remains the database lookup key.
function displayWhatsAppNumber(from) {
  const digits = String(from).replace(/\D/g, "");

  const normalized = /^521\d{10}$/.test(digits)
    ? "52" + digits.slice(3)
    : digits;

  if (/^52\d{10}$/.test(normalized)) {
    return (
      "+52 " +
      normalized.slice(2, 4) + " " +
      normalized.slice(4, 8) + " " +
      normalized.slice(8)
    );
  }

  return "+" + normalized;
}

function validateFullName(input) {
  const name = input.replace(/\s+/g, " ").trim();

  if (
    name.length < 3 ||
    name.length > 120 ||
    !/\p{L}/u.test(name) ||
    /[0-9<>]/.test(name)
  ) {
    return null;
  }

  return name;
}

// ==================================================
// WHATSAPP MESSAGE SENDING
// ==================================================

async function sendMessage(to, body) {
  const url =
    `https://graph.facebook.com/${API_VERSION}/` +
    `${PHONE_ID}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: normalizeRecipient(to),
      type: "text",
      text: {
        preview_url: false,
        body
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `WhatsApp API: ${JSON.stringify(data)}`
    );
  }

  console.log("WhatsApp message accepted by Meta.");
  return data;
}

// ==================================================
// INTERACTIVE WHATSAPP REPLY BUTTONS
// ==================================================

async function sendReplyButtons(to, body, buttons) {
  if (!buttons.length || buttons.length > 3) {
    throw new Error("WhatsApp supports 1 to 3 reply buttons.");
  }
  for (const button of buttons) {
    if (!button.title || button.title.length > 20) {
      throw new Error("WhatsApp button title must be 1 to 20 characters.");
    }
  }

  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizeRecipient(to),
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: buttons.map(button => ({
              type: "reply",
              reply: {
                id: button.id,
                title: button.title
              }
            }))
          }
        }
      })
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`WhatsApp interactive API: ${JSON.stringify(data)}`);
  }
  console.log("WhatsApp interactive buttons accepted by Meta.");
  return data;
}

// Interactive list for 4-10 existing appointments.
async function sendAppointmentList(to, body, rows) {
  if (rows.length < 1 || rows.length > 10) {
    throw new Error("WhatsApp list must contain 1-10 rows.");
  }
  const response = await fetch(
    `https://graph.facebook.com/${API_VERSION}/${PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: normalizeRecipient(to),
        type: "interactive",
        interactive: {
          type: "list",
          body: { text: body },
          action: {
            button: "Ver citas",
            sections: [{ title: "Mis citas", rows }]
          }
        }
      })
    }
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`WhatsApp list API: ${JSON.stringify(data)}`);
  }
  console.log("WhatsApp appointment list accepted by Meta.");
  return data;
}

function slotButtonTitle(iso) {
  // Compact, predictable date/time display, always under 20 characters.
  // Example: "lun 19/10 15:00". The full ISO slot stays in SQLite.
  const label = DateTime.fromISO(iso)
    .setZone(ZONE)
    .setLocale("es")
    .toFormat("ccc dd/LL HH:mm");
  if (label.length > 20) {
    throw new Error(`WhatsApp button title too long: ${label}`);
  }
  return label;
}

// ==================================================
// SIMPLIFIED THREE-BUTTON MAIN MENU
// ==================================================
async function showMainMenu(from) {
  const customer = customers.get(from);
  const firstLine = customer
    ? `Hola ${customer.full_name}, bienvenido a ${businessFor(from).business_name}. ¿En qué podemos ayudarte?`
    : `Hola, bienvenido a ${businessFor(from).business_name}. ¿En qué podemos ayudarte?`;
  const menuId = randomUUID();
  sessions.set(from, {
    mode: "main_menu", menuId, expiresAt: Date.now() + OFFER_LIFETIME
  });
  try {
    await sendReplyButtons(from,
      firstLine + "\n\n" +
      'Escribe "cita" para hacer una cita nueva, o escribe "reagendar" o "cancelar".\n\n' +
      "O escribe tu mensaje para hablar con una persona.",
      [
        { id: `menu:${menuId}:book`, title: "Hacer cita nueva" },
        { id: `menu:${menuId}:manage`, title: "Reagendar / cancelar" },
        { id: `menu:${menuId}:human`, title: "Hablar con alguien" }
      ]
    );
  } catch (error) {
    sessions.delete(from);
    throw error;
  }
}

async function showManageMenu(from) {
  const menuId = randomUUID();
  sessions.set(from, {
    mode: "manage_menu", menuId, expiresAt: Date.now() + OFFER_LIFETIME
  });
  try {
    await sendReplyButtons(from, "¿Qué deseas hacer con tu cita?", [
      { id: `manage:${menuId}:reschedule`, title: "Reagendar tu cita" },
      { id: `manage:${menuId}:cancel`, title: "Cancelar una cita" }
    ]);
  } catch (error) {
    sessions.delete(from);
    throw error;
  }
}

async function beginHumanSupport(from) {
  sessions.delete(from);
  const customer = customers.get(from);
  humanSupport.open(from, customer?.customer_id);
  await sendMessage(from, "Escribe tu mensaje.\n\nPara regresar al menú automático, escribe Menu.");
}

// ==================================================
// CUSTOMER REGISTRATION
// ==================================================

async function beginRegistration(from) {
  sessions.set(from, {
    mode: "registration",
    expiresAt: Date.now() + OFFER_LIFETIME
  });

  try {
    await sendMessage(
      from,
      "¡Bienvenido a NukMiris!\n\n" +
      "Hemos identificado el número de WhatsApp " +
      "desde el que nos escribes:\n\n" +
      `*${displayWhatsAppNumber(from)}*\n\n` +
      "Para registrar tu cita, por favor indícanos " +
      "tu *nombre completo*, incluyendo ambos " +
      "apellidos si los tienes.\n\n" +
      "Ejemplo: María González Soto."
    );
  } catch (error) {
    sessions.delete(from);
    throw error;
  }
}

async function receiveName(from, text, session) {
  if (Date.now() > session.expiresAt) {
    sessions.delete(from);

    await sendMessage(
      from,
      "El registro ha vencido. " +
      "Escribe Cita para comenzar nuevamente."
    );

    return;
  }

  const fullName = validateFullName(text);

  if (!fullName) {
    await sendMessage(
      from,
      "Por favor, escribe tu nombre completo " +
      "(máximo 120 caracteres), incluyendo " +
      "ambos apellidos si los tienes."
    );

    return;
  }

  const customer = customers.register(from, fullName);

  sessions.delete(from);

  console.log(
    "CUSTOMER REGISTERED:",
    customer.customer_id
  );

  await sendMessage(
    from,
    `¡Gracias, ${customer.full_name}!\n\n` +
    "Hemos registrado tus datos:\n\n" +
    `Nombre: ${customer.full_name}\n` +
    `WhatsApp: ${displayWhatsAppNumber(from)}\n\n` +
    "Ahora vamos a buscar los próximos " +
    "horarios disponibles para tu cita."
  );

  await offerSlots(from, "book");
}

// ==================================================
// GOOGLE CALENDAR AVAILABILITY
// ==================================================

async function getBusyPeriods(start, end) {
  throw new Error("Calendar actions disabled during Phase 6A.4 tenant isolation tests");
  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: start,
      timeMax: end,
      timeZone: ZONE,
      items: [{ id: CALENDAR_ID }]
    }
  });

  const result = response.data.calendars?.[CALENDAR_ID];

  if (!result || result.errors?.length) {
    throw new Error("Google Calendar availability error.");
  }

  return result.busy || [];
}

// IMPORTANT RESCHEDULING FIX:
// Do not interpret our own lockedSlots as Calendar conflict.

async function isFreeOnCalendar(slot) {
  const busy = await getBusyPeriods(
    slot.start,
    slot.end
  );

  return busy.length === 0;
}

// ==================================================
// FIND THREE AVAILABLE SLOTS
// ==================================================

async function findSlots() {
  const now = DateTime.now().setZone(ZONE);
  const until = now.plus({ days: 8 });

  const busy = await getBusyPeriods(
    now.toISO(),
    until.toISO()
  );

  const slots = [];

  for (let day = 0; day < 8; day++) {
    const date = now.startOf("day").plus({ days: day });

    if (date.weekday > 5) continue;

    for (const hour of HOURS) {
      const start = date.set({
        hour,
        minute: 0,
        second: 0,
        millisecond: 0
      });

      const end = start.plus({ hours: 1 });

      if (start <= now || end > until) continue;

      const slot = {
        start: start.toISO(),
        end: end.toISO()
      };

      const overlaps = busy.some(period => {
        const first = DateTime
          .fromISO(period.start)
          .toMillis();

        const last = DateTime
          .fromISO(period.end)
          .toMillis();

        return (
          start.toMillis() < last &&
          end.toMillis() > first
        );
      });

      if (
        !overlaps &&
        !lockedSlots.has(keyFor(slot))
      ) {
        slots.push(slot);
      }

      if (slots.length === 3) return slots;
    }
  }

  return slots;
}

// ==================================================
// FIND EXISTING CUSTOMER APPOINTMENTS
// ==================================================

async function findCustomerAppointments(customerId) {
  throw new Error("Calendar actions disabled during Phase 6A.4 tenant isolation tests");
  const now = DateTime.now().setZone(ZONE);

  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: now.toISO(),
    timeMax: now.plus({ days: 45 }).toISO(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
    privateExtendedProperty: [
      `nukmirisCustomerId=${customerId}`
    ]
  });

  return (response.data.items || []).filter(event => {
    return (
      event.status !== "cancelled" &&
      event.start?.dateTime &&
      event.extendedProperties?.private
        ?.nukmirisCustomerId === customerId
    );
  });
}

// ==================================================
// OFFER AVAILABLE APPOINTMENTS
// ==================================================

async function offerSlots(from, mode, originalEvent = null) {
  const slots = await findSlots();

  if (!slots.length) {
    sessions.delete(from);

    await sendMessage(
      from,
      "No encontré horarios disponibles. " +
      "Por favor, intenta nuevamente más tarde."
    );

    return;
  }

  const options = slots
    .map((slot, i) =>
      `${i + 1}. ${formatTime(slot.start)}`
    )
    .join("\n");

  const offerId = randomUUID();
  sessions.set(from, {
    mode,
    slots,
    offerId,
    originalEventId: originalEvent?.id || null,
    originalStart:
      originalEvent?.start?.dateTime || null,
    expiresAt: Date.now() + OFFER_LIFETIME
  });

  let reply;

  if (mode === "reschedule") {
    reply =
      "Encontré tu cita actual:\n\n" +
      formatTime(originalEvent.start.dateTime) +
      "\n\nEstos son los nuevos horarios disponibles:\n\n" +
      options +
      "\n\nResponde 1, 2 o 3 para reagendar.";
  } else {
    const customer = customers.get(from);
    const greeting = customer
      ? `Hola ${customer.full_name}, estos son los próximos horarios disponibles:\n\n`
      : "Hola, estos son los próximos horarios disponibles:\n\n";

    reply =
      greeting +
      options +
      "\n\nResponde 1, 2 o 3 para elegir tu horario.";
  }

  try {
    if (mode === "book" || mode === "reschedule") {
      const customer = customers.get(from);
      const body = mode === "book"
        ? (customer
          ? `Hola ${customer.full_name}, estos son los próximos horarios disponibles. Selecciona uno:`
          : "Hola, estos son los próximos horarios disponibles. Selecciona uno:")
        : ("Tu cita actual:\n" + formatTime(originalEvent.start.dateTime) +
           "\n\nSelecciona un nuevo horario:");
      const prefix = mode === "book" ? "book" : "reschedule";
      await sendReplyButtons(from, body, slots.map((slot, i) => ({
        id: `${prefix}:${offerId}:${i + 1}`,
        title: slotButtonTitle(slot.start)
      })));
    }
  } catch (error) {
    sessions.delete(from);
    throw error;
  }
}

// ==================================================
// CREATE APPOINTMENT WITH CUSTOMER DETAILS
// ==================================================

async function createAppointment(from, slot) {
  throw new Error("Calendar actions disabled during Phase 6A.4 tenant isolation tests");
  const customer = customers.get(from);

  const title = customer
    ? `NukMiris POC - ${customer.full_name}`
    : "NukMiris POC - Cita WhatsApp";

  const description = customer
    ? (
        `Cliente: ${customer.full_name}\n` +
        `WhatsApp: ${displayWhatsAppNumber(from)}\n` +
        "Origen: WhatsApp Automation POC"
      )
    : "Appointment created through NukMiris WhatsApp POC.";

  const event = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: title,
      description,

      start: {
        dateTime: slot.start,
        timeZone: ZONE
      },

      end: {
        dateTime: slot.end,
        timeZone: ZONE
      },

      extendedProperties: {
        private: {
          // Retain original field for old/new appointments.
          nukmirisCustomerId: from,
          nukmirisInternalCustomerId:
            customer?.customer_id || "",
          nukmirisPOC: "true"
        }
      }
    },
    sendUpdates: "none"
  });

  console.log("APPOINTMENT CREATED SUCCESSFULLY");
  console.log("Google Event ID:", event.data.id);

  return event.data;
}

// ==================================================
// RESCHEDULE EXISTING APPOINTMENT
// ==================================================

async function rescheduleAppointment(from, session, slot) {
  throw new Error("Calendar actions disabled during Phase 6A.4 tenant isolation tests");
  const eventId = session.originalEventId;

  if (!eventId) {
    throw new Error("No original appointment was selected.");
  }

  if (lockedEvents.has(eventId)) {
    throw new Error(
      "This appointment is already being updated."
    );
  }

  lockedEvents.add(eventId);

  try {
    const response = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId
    });

    const original = response.data;

    if (
      original.status === "cancelled" ||
      original.extendedProperties?.private
        ?.nukmirisCustomerId !== from ||
      !original.start?.dateTime
    ) {
      throw new Error("Appointment no longer valid.");
    }

    const currentStart = DateTime
      .fromISO(original.start.dateTime)
      .toMillis();

    const offeredStart = DateTime
      .fromISO(session.originalStart)
      .toMillis();

    if (currentStart !== offeredStart) {
      throw new Error(
        "Appointment changed since the offer was made."
      );
    }

    // Preserve the previously tested lock correction.
    if (!(await isFreeOnCalendar(slot))) {
      console.log(
        "New appointment time is no longer available."
      );

      return null;
    }

    const updated = await calendar.events.patch({
      calendarId: CALENDAR_ID,
      eventId,

      requestBody: {
        start: {
          dateTime: slot.start,
          timeZone: ZONE
        },

        end: {
          dateTime: slot.end,
          timeZone: ZONE
        }
      },

      sendUpdates: "none"
    });

    console.log("APPOINTMENT RESCHEDULED SUCCESSFULLY");
    console.log("Google Event ID:", updated.data.id);

    return updated.data;

  } finally {
    lockedEvents.delete(eventId);
  }
}

// ==================================================
// PROCESS APPOINTMENT SELECTION
// ==================================================

async function selectSlot(from, choice) {
  const session = sessions.get(from);

  if (!session) return;

  sessions.delete(from);

  if (Date.now() > session.expiresAt) {
    await sendMessage(
      from,
      "Los horarios han vencido. " +
      "Escribe Cita o Reagendar para consultar nuevamente."
    );

    return;
  }

  const slot = session.slots[Number(choice) - 1];

  if (!slot) {
    await sendMessage(
      from,
      "Selecciona un horario válido."
    );
    return;
  }

  if (DateTime.fromISO(slot.start).toMillis() <= Date.now()) {
    await sendMessage(
      from,
      "Ese horario ya pasó. Consulta nuevos horarios."
    );
    return;
  }

  const lockKey = keyFor(slot);

  if (lockedSlots.has(lockKey)) {
    await sendMessage(
      from,
      "Ese horario está siendo reservado. " +
      "Escribe Cita o Reagendar para consultar otros."
    );

    return;
  }

  lockedSlots.add(lockKey);

  let calendarWriteAttempted = false;

  try {
    if (!(await isFreeOnCalendar(slot))) {
      await sendMessage(
        from,
        "Ese horario ya no está disponible. " +
        "Consulta nuevos horarios."
      );

      return;
    }

    if (session.mode === "reschedule") {
      calendarWriteAttempted = true;

      const updated = await rescheduleAppointment(
        from,
        session,
        slot
      );

      if (!updated) {
        calendarWriteAttempted = false;

        await sendMessage(
          from,
          "Ese horario dejó de estar disponible. " +
          "Escribe Reagendar para consultar otros."
        );

        return;
      }

      await sendMessage(
        from,
        "¡Tu cita fue reagendada exitosamente!\n\n" +
        "Nueva fecha y hora:\n" +
        formatTime(slot.start)
      );

    } else {
      calendarWriteAttempted = true;

      await createAppointment(from, slot);

      await sendMessage(
        from,
        "¡Tu cita está confirmada!\n\n" +
        "Fecha y hora:\n" +
        formatTime(slot.start) +
        "\n\n¡Te esperamos!"
      );
    }

  } catch (error) {
    console.error(
      "Appointment operation error:",
      error.message
    );

    if (calendarWriteAttempted) {
      console.error(
        "Check Google Calendar before retrying. " +
        "The change may have succeeded without " +
        "a WhatsApp confirmation."
      );
    }

  } finally {
    lockedSlots.delete(lockKey);
  }
}

// ==================================================
// START RESCHEDULING
// ==================================================

// ==================================================
// MULTIPLE APPOINTMENT SELECTION
// ==================================================

async function askWhichAppointment(from, appointments, action) {
  const choices = appointments.map(event => ({
    id: event.id,
    start: event.start.dateTime
  }));
  const selectionId = randomUUID();
  const actionName = action === "cancel" ? "cancelar" : "reagendar";

  sessions.set(from, {
    mode: action === "cancel" ? "choose_cancel" : "choose_reschedule",
    appointments: choices,
    selectionId,
    expiresAt: Date.now() + OFFER_LIFETIME
  });

  const body = `Encontré ${choices.length} citas futuras. Selecciona cuál deseas ${actionName}:`;

  try {
    if (choices.length <= 3) {
      await sendReplyButtons(from, body, choices.map((item, index) => ({
        id: `appointment:${selectionId}:${index + 1}`,
        title: slotButtonTitle(item.start)
      })));
    } else if (choices.length <= 10) {
      await sendAppointmentList(from, body, choices.map((item, index) => ({
        id: `appointment:${selectionId}:${index + 1}`,
        title: slotButtonTitle(item.start),
        description: `Cita ${index + 1}`
      })));
    } else {
      // The interactive list API is limited to 10 options.
      // Retain text selection for the uncommon case of more than ten.
      const options = choices.map((item, index) =>
        `${index + 1}. ${formatTime(item.start)}`
      ).join("\n");
      await sendMessage(from, `${body}\n\n${options}\n\nResponde con el número de la cita.`);
    }
  } catch (error) {
    sessions.delete(from);
    throw error;
  }
}

async function offerCancellationConfirmation(from, appointment) {
  if (lockedEvents.has(appointment.id)) {
    await sendMessage(
      from,
      "Tu cita está siendo modificada. " +
      "Intenta nuevamente en unos momentos."
    );
    return;
  }

  const confirmationId = randomUUID();
  sessions.set(from, {
    mode: "cancel",
    confirmationId,
    originalEventId: appointment.id,
    originalStart: appointment.start.dateTime,
    expiresAt: Date.now() + OFFER_LIFETIME
  });

  try {
    await sendReplyButtons(
      from,
      "Encontré tu cita actual:\n\n" +
      formatTime(appointment.start.dateTime) +
      "\n\n¿Deseas cancelar esta cita?",
      [
        { id: `cancel:${confirmationId}:si`, title: "Sí, cancelar" },
        { id: `cancel:${confirmationId}:no`, title: "No, conservar" }
      ]
    );
  } catch (error) {
    sessions.delete(from);
    throw error;
  }
}

async function chooseAppointment(from, input, session) {
  if (Date.now() > session.expiresAt) {
    sessions.delete(from);
    await sendMessage(
      from,
      "La selección ha vencido. Escribe Cancelar o Reagendar " +
      "para consultar nuevamente."
    );
    return;
  }

  const number = Number(input);
  const choice = Number.isSafeInteger(number) && number >= 1
    ? session.appointments[number - 1]
    : null;

  if (!choice) {
    await sendMessage(
      from,
      `Selecciona un número entre 1 y ${session.appointments.length}.`
    );
    return;
  }

  // Consume choice before any Google Calendar operations.
  sessions.delete(from);

  if (lockedEvents.has(choice.id)) {
    await sendMessage(
      from,
      "Esta cita está siendo modificada. Intenta nuevamente."
    );
    return;
  }

  let event;
  try {
    const response = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId: choice.id
    });
    event = response.data;
  } catch (error) {
    if (error.code === 404 || error.response?.status === 404) {
      await sendMessage(
        from,
        "Esta cita ya no existe. Consulta tus citas nuevamente."
      );
      return;
    }
    throw error;
  }

  const currentStart = event.start?.dateTime;
  if (
    event.status === "cancelled" ||
    event.extendedProperties?.private?.nukmirisCustomerId !== from ||
    event.extendedProperties?.private?.nukmirisPOC !== "true" ||
    !currentStart ||
    DateTime.fromISO(currentStart).toMillis() !==
      DateTime.fromISO(choice.start).toMillis() ||
    DateTime.fromISO(currentStart).toMillis() <= Date.now()
  ) {
    await sendMessage(
      from,
      "La cita cambió o ya no está disponible. " +
      "Escribe Cancelar o Reagendar para consultar nuevamente."
    );
    return;
  }

  if (session.mode === "choose_cancel") {
    await offerCancellationConfirmation(from, event);
  } else {
    await offerSlots(from, "reschedule", event);
  }
}

// ==================================================
// START RESCHEDULING
// ==================================================

async function startRescheduling(from) {
  console.log("Looking for customer's appointment...");
  const appointments = await findCustomerAppointments(from);

  if (appointments.length === 0) {
    await sendMessage(
      from,
      "No encontré una cita futura asociada " +
      "a este WhatsApp. Escribe Cita para agendar una nueva."
    );
    return;
  }

  if (appointments.length > 1) {
    await askWhichAppointment(from, appointments, "reschedule");
    return;
  }

  await offerSlots(from, "reschedule", appointments[0]);
}

// ==================================================
// START CANCELLATION
// ==================================================

async function startCancellation(from) {
  console.log("Looking for customer's appointment to cancel...");
  const appointments = await findCustomerAppointments(from);

  if (appointments.length === 0) {
    await sendMessage(
      from,
      "No encontré una cita futura asociada " +
      "a este WhatsApp. Escribe Cita para agendar una nueva."
    );
    return;
  }

  if (appointments.length > 1) {
    await askWhichAppointment(from, appointments, "cancel");
    return;
  }

  await offerCancellationConfirmation(from, appointments[0]);
}

// ==================================================
// PROCESS CANCELLATION CONFIRMATION
// ==================================================

async function confirmCancellation(from, answer) {
  const session = sessions.get(from);

  if (!session || session.mode !== "cancel") return;

  sessions.delete(from);

  if (Date.now() > session.expiresAt) {
    await sendMessage(
      from,
      "La confirmación de cancelación ha vencido. " +
      "Escribe Cancelar para consultar nuevamente."
    );
    return;
  }

  if (answer === "no") {
    await sendMessage(
      from,
      "Tu cita se mantiene sin cambios.\n\n" +
      "Fecha y hora:\n" +
      formatTime(session.originalStart)
    );
    return;
  }

  const eventId = session.originalEventId;

  if (lockedEvents.has(eventId)) {
    await sendMessage(
      from,
      "Tu cita está siendo modificada. " +
      "Escribe Cancelar para volver a intentarlo."
    );
    return;
  }

  lockedEvents.add(eventId);

  let deleteAttempted = false;

  try {
    const response = await calendar.events.get({
      calendarId: CALENDAR_ID,
      eventId
    });

    const current = response.data;

    if (
      current.status === "cancelled" ||
      current.extendedProperties?.private
        ?.nukmirisCustomerId !== from ||
      current.extendedProperties?.private
        ?.nukmirisPOC !== "true" ||
      !current.start?.dateTime
    ) {
      await sendMessage(
        from,
        "Ya no encontré una cita válida para cancelar. " +
        "Escribe Cancelar para consultar nuevamente."
      );
      return;
    }

    const currentStart = DateTime
      .fromISO(current.start.dateTime)
      .toMillis();

    const offeredStart = DateTime
      .fromISO(session.originalStart)
      .toMillis();

    if (
      currentStart !== offeredStart ||
      currentStart <= Date.now()
    ) {
      await sendMessage(
        from,
        "La cita cambió o ya pasó. " +
        "Escribe Cancelar para consultar nuevamente."
      );
      return;
    }

    deleteAttempted = true;

    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId,
      sendUpdates: "none"
    });

    console.log("APPOINTMENT CANCELLED SUCCESSFULLY");
    console.log("Google Event ID:", eventId);

    try {
      await sendMessage(
        from,
        "Tu cita ha sido cancelada exitosamente.\n\n" +
        "Cita cancelada:\n" +
        formatTime(session.originalStart) +
        "\n\nSi deseas programar una nueva cita, " +
        "escribe Cita."
      );
    } catch (messageError) {
      console.error(
        "Cancellation succeeded but WhatsApp confirmation failed:",
        messageError.message
      );
    }

  } catch (error) {
    console.error(
      "Cancellation operation error:",
      error.message
    );

    if (deleteAttempted) {
      console.error(
        "Check Google Calendar before retrying: deletion " +
        "might have succeeded without confirmation."
      );
    } else {
      try {
        await sendMessage(
          from,
          "No pude cancelar tu cita. " +
          "Intenta nuevamente más tarde."
        );
      } catch (messageError) {
        console.error(
          "Could not send cancellation error message:",
          messageError.message
        );
      }
    }

  } finally {
    lockedEvents.delete(eventId);
  }
}

// ==================================================
// DUPLICATE WHATSAPP MESSAGE DETECTION
// ==================================================

function alreadyProcessed(id) {
  if (!id) return false;

  const now = Date.now();

  for (const [key, timestamp] of processedMessages) {
    if (now - timestamp > 60 * 60 * 1000) {
      processedMessages.delete(key);
    }
  }

  if (processedMessages.has(id)) return true;

  processedMessages.set(id, now);

  return false;
}

// ==================================================
// PROCESS WHATSAPP MESSAGES
// ==================================================

async function handleMessage(message) {
  const isText = message.type === "text";
  const isButton = message.type === "interactive" &&
    message.interactive?.type === "button_reply";
  const isList = message.type === "interactive" &&
    message.interactive?.type === "list_reply";
  if (!isText && !isButton && !isList) return;
  if (alreadyProcessed(message.id)) return;

  const from = message.from;
  const text = isText ? (message.text?.body || "").trim() :
    isButton ? (message.interactive?.button_reply?.id || "") :
      (message.interactive?.list_reply?.id || "");
  const command = text.toLowerCase();

  if (busyCustomers.has(from)) {
    console.log("Customer operation already in progress.");
    return;
  }
  busyCustomers.add(from);
  try {
    const business = businessFor(from); // Fail closed for unassigned test numbers.
    console.log("Phase 6A.4 development route:", business.business_id);
    const isAppointmentAction =
      (isText && ["cita", "reagendar", "cancelar"].includes(command)) ||
      ((isButton || isList) && /^(book|reschedule|appointment|cancel|manage):/.test(command)) ||
      (isButton && /^menu:[0-9a-f-]{36}:(book|manage)$/.test(command));
    if (isAppointmentAction) {
      sessions.delete(from);
      await sendMessage(from, SCHEDULING_PAUSED);
      return;
    }
    // Human support is a persistent state, independent of 15-minute sessions.
    // No appointment automation runs until Menu or an eventual operator close.
    if (humanSupport.isOpen(from)) {
      if (isText && command === "menu") {
        humanSupport.close(from);
        await showMainMenu(from);
      } else if (isText && text) {
        humanSupport.saveMessage(from, message.id, text);
        console.log("Business human-support message stored:", businessFor(from).business_id);
      } else {
        await sendMessage(from, "Tu conversación está en atención personal. Escribe tu mensaje o Menu.");
      }
      return;
    }

    const session = sessions.get(from);
    if (session && ["book", "reschedule", "cancel", "choose_cancel", "choose_reschedule", "registration", "manage_menu"].includes(session.mode)) {
      sessions.delete(from);
      await sendMessage(from, SCHEDULING_PAUSED);
      return;
    }
    const activeSession = session && Date.now() <= session.expiresAt;
    const buttonMatch = isButton
      ? /^(book|reschedule):([0-9a-f-]{36}):([1-3])$/.exec(command) : null;
    const validSlotButton = !!(
      buttonMatch && activeSession && session.mode === buttonMatch[1] &&
      session.offerId === buttonMatch[2]
    );
    const appointmentMatch = (isButton || isList)
      ? /^appointment:([0-9a-f-]{36}):([1-9][0-9]*)$/.exec(command) : null;
    const validAppointmentSelection = !!(
      appointmentMatch && activeSession &&
      (session.mode === "choose_cancel" || session.mode === "choose_reschedule") &&
      session.selectionId === appointmentMatch[1] &&
      Number(appointmentMatch[2]) <= session.appointments.length
    );
    const cancellationMatch = isButton
      ? /^cancel:([0-9a-f-]{36}):(si|no)$/.exec(command) : null;
    const validCancellationButton = !!(
      cancellationMatch && activeSession && session.mode === "cancel" &&
      session.confirmationId === cancellationMatch[1]
    );
    const menuMatch = isButton
      ? /^menu:([0-9a-f-]{36}):(book|manage|human)$/.exec(command) : null;
    const validMenuButton = !!(
      menuMatch && activeSession && session.mode === "main_menu" &&
      session.menuId === menuMatch[1]
    );
    const manageMatch = isButton
      ? /^manage:([0-9a-f-]{36}):(reschedule|cancel)$/.exec(command) : null;
    const validManageButton = !!(
      manageMatch && activeSession && session.mode === "manage_menu" &&
      session.menuId === manageMatch[1]
    );

    if ((isButton || isList) && !validSlotButton &&
        !validAppointmentSelection && !validCancellationButton &&
        !validMenuButton && !validManageButton) {
      await sendMessage(from, "Esta opción ya no está vigente. Escribe Hola para ver el menú actual.");
      return;
    }

    // Explicit commands always bypass the menu, except during human support.
    if (isText && command === "hola") {
      await showMainMenu(from);
    } else if ((isText && command === "cita") ||
               (validMenuButton && menuMatch[2] === "book")) {
      sessions.delete(from);
      const customer = customers.get(from);
      if (!customer) await beginRegistration(from);
      else await offerSlots(from, "book");
    } else if ((isText && command === "reagendar") ||
               (validManageButton && manageMatch[2] === "reschedule")) {
      sessions.delete(from);
      await startRescheduling(from);
    } else if ((isText && command === "cancelar") ||
               (validManageButton && manageMatch[2] === "cancel")) {
      sessions.delete(from);
      await startCancellation(from);
    } else if (validMenuButton && menuMatch[2] === "manage") {
      await showManageMenu(from);
    } else if (validMenuButton && menuMatch[2] === "human") {
      await beginHumanSupport(from);
    } else if (isText && command === "menu") {
      await showMainMenu(from);
    } else if (validAppointmentSelection ||
               (isText && activeSession &&
                (session.mode === "choose_cancel" || session.mode === "choose_reschedule") &&
                /^\d+$/.test(command))) {
      await chooseAppointment(from,
        validAppointmentSelection ? appointmentMatch[2] : command, session);
    } else if (validCancellationButton ||
               (isText && activeSession && session.mode === "cancel" &&
                ["si", "sí", "no"].includes(command))) {
      await confirmCancellation(from,
        validCancellationButton ? cancellationMatch[2] :
          (command === "sí" ? "si" : command));
    } else if (validSlotButton ||
               (isText && activeSession &&
                (session.mode === "book" || session.mode === "reschedule") &&
                /^[1-3]$/.test(command))) {
      await selectSlot(from, validSlotButton ? buttonMatch[3] : command);
    } else if (isText && activeSession && session.mode === "registration") {
      await receiveName(from, text, session);
    } else if (isText && text && activeSession && session.mode === "main_menu") {
      // The invitation in the menu explicitly says to type a message to speak
      // to a person. Preserve that first message rather than discarding it.
      await beginHumanSupport(from);
      humanSupport.saveMessage(from, message.id, text);
    } else if (isText && text) {
      // Unrecognized text outside an active workflow opens the main menu.
      await showMainMenu(from);
    }
  } catch (error) {
    console.error("NukMiris processing error:", error.message);
  } finally {
    busyCustomers.delete(from);
  }
}

// ==================================================
// META WEBHOOK VERIFICATION
// ==================================================

app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === VERIFY_TOKEN
  ) {
    return res.status(200).send(
      req.query["hub.challenge"]
    );
  }

  return res.sendStatus(403);
});

// ==================================================
// RECEIVE WHATSAPP WEBHOOK EVENTS
// ==================================================

app.post("/webhook", (req, res) => {
  res.sendStatus(200);

  const changes =
    req.body?.entry?.flatMap(
      entry => entry.changes || []
    ) || [];

  for (const change of changes) {
    const messages = change.value?.messages || [];

    for (const message of messages) {
      handleMessage(message).catch(error => {
        console.error(
          "Webhook error:",
          error.message
        );
      });
    }
  }
});

// ==================================================
// START NUKMIRIS
// ==================================================

async function start() {
  try {
    console.log("Phase 6A.4: Google Calendar connection postponed; all calendar operations blocked.");

    return app.listen(PORT, HOST, () => {
      console.log("--------------------------------");
      console.log("NukMiris WhatsApp + Google Calendar POC");
      console.log("--------------------------------");
      console.log("Webhook server running on port", PORT);
      console.log("Google Calendar: DISABLED (Phase 6A.4 safety gate)");
      console.log("Persistent sessions: SQLite enabled");
      console.log("Customer registry: SQLite enabled");
      console.log("Multiple appointment selection: Enabled");
      console.log("New booking: DISABLED until per-business calendar setup");
      console.log("Appointment rescheduling: DISABLED until per-business calendar setup");
      console.log("Appointment cancellation: DISABLED until per-business calendar setup");
      console.log("Booking trigger: cita");
      console.log("Rescheduling trigger: reagendar");
      console.log("Cancellation trigger: cancelar (SI / NO)");
      console.log("--------------------------------");
      console.log("Waiting for WhatsApp messages...");
    });

  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

module.exports = { app, start, close: () => db.close() };

if (require.main === module) {
  start();
}
