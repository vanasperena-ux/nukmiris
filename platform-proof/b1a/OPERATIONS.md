# Proposed termination, custody and operational contract

No commands in this document/tool have been executed against GCP. The controller
is a data generator, imports no SDK/network/subprocess executor and rejects all
execution flags. `npm run b1a:fence:dry-run` prints exact ordered commands,
preconditions/evidence checks and abort behavior for the candidate inventory.
Do not paste them into a cloud-authenticated terminal under this authorization.

## Evidence and promotion

- Dedicated independently administered observer pins authenticate Ed25519
  envelopes of types FENCE/ACTIVITY/CLOCK/CANARY/LEDGER for one session. Runtime,
  deployer and gateway must not possess observer signing keys. Fixture public
  keys/signatures demonstrate verifier logic, not actual cloud administration.
- FENCE binds old scope/epoch/revision, deletion receipt, complete zero-instance
  samples after reporting delay, freshness and coverage interval. 404/deletion,
  missing series, traffic0, absent heartbeat or a stopped laptop process alone
  cannot establish physical Cloud Run termination. System logs corroborate where
  available; absence is not fabricated as success.
- Independently measured four-timestamp clock observations name both clocks,
  offset interval, precision, drift and short validity. Supply the derived
  uncertainty explicitly. Conclusive authenticated old-epoch connect/write after
  the fence is VIOLATION before completeness checks. Straddles/stale/missing or
  contradictory inputs are NOT_PROVEN, never a physical-containment claim.
- At least20 distinct frozen-before-connect canaries have independently scheduled
  wake challenges after platform completion+uncertainty. The fake host's complete
  ledger is observed past the measured wake tail. Ledger chain and external head
  must match; any nonce request invalidates retirement. Existing pre-fence bytes
  or accepted effects can arrive later without justifying a new request/retry.
- Controller checks evidence session/scope/predecessor against persisted control
  state, then generation CAS. Any failure leaves dispatch false. Separate
  controller SQL role is privileged to promote; compromise of that identity is
  an explicit trust boundary, not blocked by an in-process API wrapper alone.
- Entry holds session+authority locks through COMMIT; only `CommandComplete
  COMMIT` creates the process-local one-use continuation. CallerUNKNOWN can coexist
  with durableARMED when COMMIT never reached SQL. Only explicit original-ID
  replay of authoritative never-entered ARMED is allowed; ENTERED/UNKNOWN never
  resend. Lost success/DB recovery failure remains held, no invented outcome.

## Identities and connections

Runtime gateway DB/certificate material belongs only to per-epoch effect bundle
secret; ingress/worker/sealer/controller DB secrets have separate accessors.
All role passwords/test TLS keys are generated at runtime and omitted from exports.
Cloud credential bootstrap must use reviewed secret mounts/workload identity, no
ambient ADC or shared administrative account in effect requests. Deployer has
limited actAs but can indirectly run code as a runtime SA; treat it as privileged
and gate pinned images/admission outside CI. It has no custody/observer role.
Kill principal is independently held, cannot silently become the deployer.

Two gateway pools×2 connections, worker2, ingress1, sealer1, controller/probe2 and
reserve3 give13 proposed connections. SQL role caps4/2/1/1/2 bound aggregate pool
use across overshoot; excess admission holds, never admin fallback. Actual
CloudSQL f1 limits/memory/IAM/PSC/CAS-CA compatibility need measurement before use.
No increase in app roles/BYPASSRLS is authorized. Full managed RLS remains MB01.

## Cost stop, restart and abandonment

SQL session deadline≤6hours is immutable; no new entry after expiry. Budget
ENFORCED, unknown control state, reset/monthly CONFIGURED or AWAITING_NEXT_PERIOD
all durably disable dispatch; restarting a process does not re-enable it.
Already-entered effects remain uncertain and require fence/reconciliation, not
blanket declaration of cancellation. `runtime/watchdog.mjs` is an offline tested
supervisor decision engine; the independent future operator must actually execute
fence/export/teardown at the deadline. It is not a running cloud scheduler here.
Loss of supervisor or clock confidence requires an independent kill/cleanup.

`b1a:spend-cap:print` prints the current documented Billing Budgets request body
without credentials/account lookup/API call. Pinned Terraform provider has no
spendCap field. Eligibility/account currency remains unverified. Alerts are
notifications; CloudRun caps are delayed, project/service scoped and cannot stop
SQL/VM/NAT/LB/storage costs or guarantee an account-wide cap. Monthly reset is
never authority to resume effects.

Teardown prints exact disposable projects and dependency-ordered service/PSC/ALB/
SQL commands; inventory includes all119 candidate resources. Export inert coherent
synthetic evidence first; then remove ALL epochs, worker, fake disks/IPs, PSC
consumers/producer, ALB/proxies/NEG/cert, SQL/backups/PITR, NAT/router, DNS/subnets,
firewalls, secrets+versions, KMS versions, buckets+generations, images/builds and
logs/exports. Deleting three dedicated projects is final containment, not proof
of a zero invoice. DirectVPC release can lag; check+2h, billing+48h and next
statement. KMS key rings are not individually deletable; schedule version
destruction and track completion/project deletion. Do not remove old deny before
termination evidence. No broad resource selectors/prunes or owner profile access.
Disable all recreate jobs, retain expiry marker; a reboot/cap reset cannot extend
the experiment. Hard teardown2026-12-17; skip trial window if safe review slips.

Owner decisions still open: organization vs explicitly weaker standalone mode;
actual region/unique IDs; named supervisor/kill/custody/cleanup/billing/backup
humans; measured fence/reporting/wake-tail thresholds; approved gross currency/FX
allocation and exact session start/end; temporary evidence retention/export and
review of inventory deltas. None is inferred from source approval or trial credit.
