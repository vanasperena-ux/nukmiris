# L1 availability simulator and transcript oracle — implemented scope

Authorized immediately by the owner's direction and [Claude L0b GO WITH CONDITIONS](https://github.com/vanasperena-ux/nukmiris/pull/10#issuecomment-6649052579).
C1 is implemented separately in Draft PR #11; **independent C1 acceptance is still
required before L2 interactive booking**. This increment supplies a synthetic,
read-only calendar model and deterministic reference transcript, not a durable
conversation server, UI or outbound provider integration.

## Calendar/domain behavior

One requested service defines duration/buffer; no array of services, service picker,
employee picker or extra confirmation step is introduced. Business/employee hours,
breaks, qualification, employee absences, scoped overlapping calendar events and
UNKNOWN events constrain slots. Half-open intervals and configured buffers preserve
exact boundaries. Unassigned events conservatively block every employee; identified
events block their employee only. Cancelled events are ignored only when explicitly
classified CANCELLED in the synthetic snapshot. Unknown resource/scope/schema fails
closed. The first deterministic eligible employee supplies each displayed time.

The search follows the accepted v0.8.1 policy: first30 local calendar days, extend
only new15-day batches until three available dates or365-day horizon. It carries
busy history/buffers over batch boundaries, supports a specific structured date
and later date pages, honors the business IANA zone, and rejects nonexistent DST
wall-clock starts instead of silently shifting them. Luxon3.7.2 and types3.7.1 are
exactly pinned with npm integrity locks, matching the baseline's time library.

All pages must bind the requested tenant/calendar/range, stable snapshot and valid
complete terminal page. Page/token cycles, >100pages, changed snapshots, conflicting
IDs, malformed/missing data, timeout and failed reads produce AvailabilityHeldError.
They never become empty/free. Reads share a total caller budget (default1000ms,
configurable1–10000ms), without automatic retry or mutation. Synchronous CPU cannot
be preempted by JS timers; elapsed budget is rechecked after each batch as well.
Final slot selection re-reads the chosen date rather than trusting the old offer.
This availability observation does not reserve capacity; L2 must use the accepted
SQL guard/reservation protocol under current state before any effect.

## Frozen conversation reference

The oracle keeps the accepted two suggested slots + Más opciones, next two + Elegir
fecha, three-date pages, Más fechas/Fechas anteriores, and two-time pages with Más
horarios/Elegir otra fecha. Copy is taken from the accepted backend availability
menu, not rewritten into an extra confirmation flow. Only actually displayed action
IDs are accepted, bound to tenant/view revision with the15-minute lifetime.

Known customer slot selection emits BOOK_REQUEST immediately; a new customer gets
"Para reservar este horario, indícanos tu nombre completo." only after selecting
that slot. The reference name-captured event rechecks availability then emits the
same BOOK_REQUEST. No calendar mutation, fake send or success confirmation is
performed by this oracle. Menu invalidates prior actions; human mode owns ordinary
pending input until Menu (O6). O5's sealed-reducer trust boundary is unchanged.

The oracle takes structured ISO dates/name-captured events. Actual accepted natural
language date parsing, full name validation, durable action/name state, navigation
output contexts and sole-dispatcher replies belong to L2 before interactive use.
The displayed date prompt is frozen reference copy; this increment does not claim
a live text parser. No49/49 P0 or37/37 journey completion is claimed.

## Acceptance, reproducible transcript and O3

From vnext with Node24/npm11 and the pinned PG17.11 Docker harness:

```sh
npm ci --ignore-scripts
npm run typecheck
npm run check:scope
npm run test:l1
npm run demo:transcript
npm test
npm run test:fault
npm run test:concurrency
```

The transcript command prints deterministic synthetic reference steps with zero
provider calls/calendar mutations; it is not an interactive booking application.
The L1 suite includes all52 C1/O2/O4 cases (real priority/entry/crash schedules),
plus calendar completeness, tenant, pagination, buffer, hours, employee, horizon,
DST, fresh slot, human, stale/foreign/expired action, known/new customer and date
navigation tests. Thirty differential cases execute the byte-preserved accepted
v0.8.1 pure availability engine through a Luxon-only sandbox, comparing actual slot
start/end meaning across five zones, DST dates, durations, breaks and buffers.
No v0.8.1 app starts, database or credentials are accessed.

O3 measures six concurrent real-PG preparations competing for three slots with
normal3s lock timeout, and forced50ms/3000ms lock timeouts. Reports separate resource
conflict counts, terminal LOCK_TIMEOUT and end-to-end preparation latency (custody
and terminal reduction included, **not isolated lock wait**). A rejected original
input cannot retry; a new customer request can progress without an operator. These
host observations are not production/Windows SLOs or population failure rates.
L2 must tell the customer to choose again after a terminal lock timeout; it must
not claim success or retry the same sealed plan. Exact measurements/source hashes
and suite results are in vnext/evidence/wp2-l1/.

## Unchanged gates and next code

Runtime TCP/UTC/bootstrap is a separate Draft PR, both stacked on C1. Native Windows
execution/storage/performance/N6 remains NOT RUN here. L2 needs independent C1
acceptance, review of these increments, then durable conversation/action state,
validated name/date handling, typed ordered navigation replies and a minimal local
browser/fake-calendar viewer using these read-only availability checks plus the
existing reservation/sole-dispatcher/result mechanisms. First known/new booking,
then move/cancel. One service per appointment and direct slot commit remain binding.

X1/F13, independent chain AND index extension verification009/production017,
repair011/N2/N3, A2 quarantine, A3 remote/multi-worker,013/016 and OPS01 remain open.
No merge, real Meta/Google, GCP, deployment, cutover or v0.8.1/data change.
