# RM-1 — bounded customer communication design

**Design only; no new acknowledgment sender or owner reply inbox is implemented.** Feature Register v1.13 at 6c1cdf67fe49b677a6ba16d964badcbc7318b303, NM-027/030/034/039 and OD-09/10 control this design. The resolved R0 reminder scope and remaining R3 gates are recorded in [checkpoint 1](REQUIREMENTS.md).

## Uncertain customer requests

An acknowledgment must never bypass an earlier entered/UNKNOWN outbound message. The current browser's verification banner is local state, not proof a WhatsApp message was sent. A proposed acknowledgment uses the existing ordered output/one-use dispatcher and a durable unique identity for that uncertainty episode. It may say only the approved nonconfirming NM-030 wording. A booking UNKNOWN alone cannot establish either success or failure, a free slot, permission to retry or safe outbound delivery.

The result must record queued, accepted, blocked or impossible separately; acceptance is not delivered. If channel evidence is uncertain, hold it and expose a business-scoped Needs Attention item. Recovery must reconcile the same attempt read-only; neither restart nor timeout creates a replacement send identity. Human mode remains quiet and retains all inbound support messages. No natural-language escalation or extra appointment summary is added.

Before any bounded implementation, demonstrate the actual output ordering transaction and exact head barriers with entered/UNKNOWN prior output, channel outage, lost response, duplicate input and restart. If a safe path cannot be proved, preserve the hold and report it rather than creating an alternate transport.

## NM-034 support workflow

The desired owner/staff reply channel is the **business's WhatsApp Business app**, per OD-09. Meta Cloud API/app coexistence eligibility, number ownership, inbound/outbound routing and synchronization remain an open provider-feasibility gate. No unrestricted NukMiris web reply interface is presumed as the fallback.

A separately approved internal support queue could expose only the authenticated business's requests with masked customer identity, message history necessary for the case, bot/human state, request time, assignee and unread/open/closed state. Current local authentication is an isolated synthetic owner mechanism; it does not prove production staff authorization.

Authorized owner/designated staff access, assignment/transfer, read state and closure would be audited against the correct business/conversation. Closing a tracking case must not clear UNKNOWN work, resolve a booking outcome or independently re-enable the bot; the accepted customer `menu` behavior remains. A future supported human reply must follow the approved provider window and ownership rules, be distinguishable from a bot reply, and retain delivery uncertainty without automatic repeats.

OD-10 calls for role/event-specific notifications. Channels, permissions, escalation and fallback UX require an owner decision; no email, push, broadcast, employee-wide messaging or unsolicited WhatsApp send is implemented here. Production data retention and message access must be enforced before real customer use.

If the owner authorizes a bounded queue increment later, acceptance must cover business/staff isolation, unauthorized read/write denial, exact conversation ownership, claim/transfer/close races, incoming duplicates/restart, no bot reply during human mode, both directions of the supported reply channel, uncertain send handling and audit integrity. A synthetic queue cannot establish that real WhatsApp coexistence works.
