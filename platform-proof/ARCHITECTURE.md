# Mechanism, trust model and explicit limits

## Source authority

Base PR19 `d3fa65192374ca206ff1f6d166a789c295a15e97`; PR18 publication
`23079800b825502cf290c5a61ee32c2e3c256dd6`, design `bc1dc2f…`.
[Claude INC1/MB-01–12/C-1–14](https://github.com/vanasperena-ux/nukmiris/pull/18#issuecomment-6756171002),
[provider review](https://github.com/vanasperena-ux/nukmiris/pull/19#issuecomment-6757066205).
ADR Revision3 at `ad705c8cf666ae4ec617e00cae37eaad7f3f4511`, file
`docs/greenfield/12-ADR-005-GCP-CLOUD-ARCHITECTURE.md`, SHA256
`c3bfc7acb209ccd5fe946063f94f03ea06fc518c2f75d8b20277d5ce83e8babc`.
PR6 review branch `83907db61daa929fa91ed9301c75b92eaa5f5436` includes reviews03/04/05,
all nine redlines and DR-01–12. Feature Register v1.4 at
`59cde023d2dff088161c1d01bd76c1099386e13f` remains unmodified.

The accepted executable commit/tree are b4d0be0cb98c7f2b69be318e18b93f4de102c511 /
03d08322e27d9d54485fa887b482743fe076556b. The new proof changes the new branch's
root tree additively; it does not change that historical tree or any accepted
executable file. The 127-file accepted manifest and protected subtree OIDs are
checked. Historical planning/ADR files, PR16 and owner profiles are untouched.

## Local data flow

A local test operator creates a new authority scope; a separate worker role
plans an immutable operation/attempt/payload/deadline binding. A loopback
service-authenticated caller submits IDs only. `proof.enter` locks the authority
and attempt and marks ENTERED inside the **gateway's** transaction. Only its
successful COMMIT response creates a one-use closure in that process continuation.
This selects MB-03's preferred design before implementation. The caller never
receives a permit. Serialized ENTERED/UNKNOWN/APPLIED rows cannot recreate one.

The gateway consumes once, checks the digest, creates one fresh raw TLS1.3 socket,
pins the runtime-generated local certificate, sends one HTTP/1.1 request with
Connection:close, waits for a binding-matched positive response and records APPLIED.
The request is fragmented to inject a genuine incomplete-body write. There is no
agent, pooling, HTTP2, redirect or automatic resend. Database reconnects used to
record UNKNOWN never grant another effect permission. An operation has exactly
one attempt in this deliberately stricter minimal schema; no rearm API exists.

Role grants are separated: worker can plan but cannot enter/finish; gateway can
enter/finish but cannot plan, rearm or mutate tables. Neither runtime role owns
objects, has BYPASSRLS or uses accepted application roles. The fixture superuser
is a disposable **test operator**, never proposed as a Cloud SQL runtime identity.
This proof is scope-isolated, not an implementation of application tenant RLS.
MB-01/Cloud SQL IAM/session_user/owner-membership compatibility remains open.

`proof.enter` holds the scope share lock through COMMIT. Retirement ordered first
denies entry; entry committed first may continue under old authority. This latter
case is the F13 residual and is preserved in the test evidence. **SQL epoch change
is not physical containment.** A killed post-COMMIT process leaves ENTERED held;
the fixture's explicit recovery changes only uncertainty to UNKNOWN, never rearm.
A failed uncertainty write also remains ENTERED/held for recovery. No inference
that no request was sent follows from either state.

## Ledger and evidence

The independent local HTTPS process fsyncs a hash-chained append-only JSONL ledger
before recording an effect/response. Connection IDs correlate TCP acceptance,
TLS, request/body completion, epoch/revision, operation/attempt, expected and actual
digest, effect, response loss/rejection and timestamps. A supervisor receives
records and retains checkpoint heads separately; a changed/reordered/truncated or
rehash-rewritten ledger fails against its original checkpoint. Existing ledger
files cannot be opened for replacement. Partial/missing files fail verification.
A rolled-back **checkpoint plus ledger** is outside this experimental trust model:
this is not production independent custody009/011/017, index-extension proof or
protected archive repair. No remote witness timeout or custody gate is closed.

Provider metadata headers are test correlation data, **not authenticated cloud
instance identity**. Loopback processes and their test supervisor are trusted;
malicious local root can rewrite all evidence. Cloud B1a must add authenticated
per-epoch fake-host identity, independent administration and evidence roots.
No packet capture is claimed: acceptance and TLS timing are server observations,
not kernel SYN timing. Client write/arrival intervals and ±2ms uncertainty are
reported separately; wall-clock steps on a distributed platform need measurement.

Classifier PRE_FENCE means initiation preceded a verified fence; bytes/effects
may arrive later. VIOLATION means new connection/write began conclusively after
that fence. Straddling intervals, missing/stale/incomplete platform metrics,
SQL-only retirement or heartbeat silence produce NOT_PROVEN. Cloud evidence
inputs are fixture-only unit tests; `sourceVerified` must later come from a real
independent oracle, not a user-provided assertion. No cloud classifier PASS is
reported. Actual local exit observations are explicitly labeled local.

## What this cannot prove

Deadlines precede inbound timeouts and are checked before connect/TLS/write,
between body fragments and after resume; a timer destroys the socket while the
process runs. A frozen process cannot run timers. A SIGSTOP can occur between any
last check and its syscall, and kernel-buffered bytes survive process scheduling.
No finite local test closes that check/syscall window or guarantees zero late
physical effects. Only independently verified termination addresses the old
process; a request accepted before termination can still apply later. The delayed
provider test reproduces that case. Keep UNKNOWN protections; never turn a timeout
or missing ledger arrival into proof of provider rejection.

Cloud Run CPU throttling/lifecycle, network/IAM propagation, revision/tag removal,
metrics delay, termination, cold sealer ACK behavior, remote custody, actual SQL
limits and budget-pause/monthly-resume inertness remain **unexecuted B1 gates**.
The plan keeps an instance-billed gateway. Calendar operation-derived event IDs
remain duplicate-reduction/reconciliation aids, never guaranteed idempotency;
If-Match and deleted-event reinsertion need real-provider proof later. Commercial
business-integration token fencing is unresolved (MB-08); no automatic OAuth grant
revocation per deployment. Mandatory explicit customer-name confirmation, owner
identity allowlists, transport-receipt consent, REAL/OPS01 nine cases/10k and
independent chain AND index extension gates all remain before real activation.
Services, Embedded Signup v4/coexistence and commercial onboarding are deferred.
