-- Synthetic test schema only; not a live migration.
PRAGMA foreign_keys = ON;

-- From nukmiris-phase6A1-business-foundation.js
CREATE TABLE IF NOT EXISTS businesses (
        business_id TEXT PRIMARY KEY,
        business_name TEXT NOT NULL,
        business_type TEXT NOT NULL,
        time_zone TEXT NOT NULL DEFAULT 'America/Mexico_City',
        status TEXT NOT NULL DEFAULT 'test' CHECK(status IN ('test','active','inactive')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS business_settings (
        business_id TEXT PRIMARY KEY,
        working_days_json TEXT NOT NULL,
        opening_time TEXT,
        closing_time TEXT,
        appointment_duration_minutes INTEGER NOT NULL CHECK(appointment_duration_minutes > 0),
        buffer_minutes INTEGER,
        start_interval_minutes INTEGER,
        breaks_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        FOREIGN KEY (business_id) REFERENCES businesses(business_id)
      );

      -- Development-only routing: customer WhatsApp sender -> mock business.
      -- This is NOT business-number routing and MUST NOT be used in production.
      CREATE TABLE IF NOT EXISTS dev_test_business_routes (
        sender_whatsapp_id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        notes TEXT NOT NULL,
        FOREIGN KEY (business_id) REFERENCES businesses(business_id)
      );

-- From nukmiris-phase6A2-business-customers.js
CREATE TABLE IF NOT EXISTS business_customers (
        customer_id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        whatsapp_id TEXT NOT NULL,
        full_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (business_id) REFERENCES businesses(business_id),
        UNIQUE (business_id, whatsapp_id)
      );
      CREATE INDEX IF NOT EXISTS idx_business_customers_business
        ON business_customers(business_id);

-- From nukmiris-phase6A3-business-conversations-sessions.js
CREATE TABLE IF NOT EXISTS business_customer_sessions (
        business_id TEXT NOT NULL,
        whatsapp_id TEXT NOT NULL,
        session_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        PRIMARY KEY (business_id, whatsapp_id),
        FOREIGN KEY (business_id) REFERENCES businesses(business_id)
      );
      CREATE INDEX IF NOT EXISTS idx_business_sessions_expiration
        ON business_customer_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS business_support_conversations (
        business_id TEXT NOT NULL,
        whatsapp_id TEXT NOT NULL,
        customer_id TEXT,
        status TEXT NOT NULL CHECK(status IN ('waiting','in_progress','closed')),
        assigned_to TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (business_id, whatsapp_id),
        FOREIGN KEY (business_id) REFERENCES businesses(business_id),
        FOREIGN KEY (customer_id) REFERENCES business_customers(customer_id)
      );
      CREATE INDEX IF NOT EXISTS idx_business_support_queue
        ON business_support_conversations(business_id, status, updated_at);

      CREATE TABLE IF NOT EXISTS business_support_messages (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        whatsapp_id TEXT NOT NULL,
        direction TEXT NOT NULL,
        message_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (business_id, whatsapp_id)
          REFERENCES business_support_conversations(business_id, whatsapp_id)
      );
      CREATE INDEX IF NOT EXISTS idx_business_support_message_history
        ON business_support_messages(business_id, whatsapp_id, created_at);
