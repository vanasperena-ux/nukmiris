# B1a-2 source acceptance matrix

Exact tested source/tree and commands are recorded in `evidence/publication.json`; no source acceptance or cloud approval is inferred from this matrix. Existing full/fault/concurrency suites are retained and extended, not replaced by mocks. Source changes remain solely within `platform-proof/`.

| Requirement | Automated evidence |
| --- | --- |
| D-1 10s/150s/10min authenticated old initiation | `test/b1a2-time.test.mjs`: VIOLATION with complete/incomplete unrelated metrics |
| D-1 distant horizon, bounded drift, straddling, missing/copied/conflicting clocks | same; `test/b1a-classifier.test.mjs`, existing signed evidence tests |
| D-2 positive realistic latency | `test/b1a2-retirement.test.mjs`, `test/b1a2-observer.test.mjs`:60s sampling,120s visibility, active+idle,>=20 native parked processes, independent mTLS ledger and signed clocks |
| D-2 physical bound versus reporting, absent/deferred deletion, gaps/nonzero/stale metrics, incomplete wake/tail | retirement negative cases; delayed pre-fence application remains distinct from new initiation |
| D-3 independent kill and narrow traffic actAs | `test/b1a2-ops.test.mjs`: remove traffic/delete/firewall/actAs grants → blocking error; exact lowercase `run.workerpools.delete` |
| D-3 failure independent from controller/deployer | `test/b1a2-controller.test.mjs`: unresolved prior intent and unavailable SQL cannot block independent service-delete request |
| P-1 inert identity/session/epoch/revision/expiry/image/mount/DB/revocation | `test/b1a2-startup.test.mjs`, `test/b1a2-preparation.test.mjs`, `test/b1a2-sql.test.mjs`; copied identity capability rejected; native restricted SQL/timers/lease state |
| P-1 full assembled chain and explicit enable | same: verified four-role bootstrap, committed admission and immutable custody, worker, COMMIT-bound gateway, mTLS fake; exactly one effect; restart/holds preserve identity |
| P-1 authority unavailable | native expired SQL lease cannot renew or enter; heartbeat/billing tests stop renewal and never recreate authority |
| P-2 complete immutable API receipts, raw provenance, no caller source boolean | `test/b1a2-api.test.mjs`, observer tests; copied receipt/missing metric series rejected; real local Google-shaped endpoints only |
| P-2 independent canary source | native `/proc` stopped/start identity and separate waker; caller-supplied `independent:true` cannot become signed evidence; signed stale/copy cases hold |
| P-2 exact preflight | `test/b1a2-preflight.test.mjs`: enabled APIs, exact image/identity/private egress and owner-described regional quota evidence; missing/wrong/unknown holds |
| P-3 seven-step sequence, durable interruption and recovery | controller tests: lost advance acknowledgement, original intent read-back, no second advance/replay/promotion, emergency remains separate |
| P-3 all inventory teardown/permissions | controller/teardown tests: dependency graph covers140 addresses, exact authority/scopes, independently administered final cleanup principal, no wildcard delete; original state IDs pinned; replacement/unknown/permission failure holds |
| P-3 independent deletion evidence | teardown tests: embedded NAT checked on parent router,403 not absence, state removal not cloud absence, missing key-version retirement holds; KMS metadata remains residual |
| P-4 real fake provider TLS/control/export | provider tests: mTLS1.3, authorized role/epoch/payload, unauthorized identity/source denied, own fsynced effect ledger; immutable export through observer route |
| P-4 packaging | native Docker build from pinned Node digest, exact config/OCI manifest, read-only non-root container health200/readiness503 and cloud-activation rejection; raw logs and reconstructed source layer published separately |
| P-4 modeled fencing | network model denies new revoked-epoch connects, existing sockets survive until explicit termination; **not real Google Cloud enforcement** |
| P-5 currency and units | input tests: USD20 illustrative20.50 FX→MXN410; stale/missing FX, inconsistent local units and unsupported account inputs reject |
| P-5 control/failure events | billing tests and native SQL:50/75 alert only;90/100/enforced/reset/delay/pause/restart/suspension/recovery/expiry hold; failed journal cannot prevent hold; failed SQL triggers independent kill, never false committed claim |
| P-6 sealer simplification and retention | Terraform validate; generated inventory/static tests;30 removals, runtime sealer/private SQL/same-project IAM, no custody serving network or TLS private key state; one-day/no final or retained backups B1a only |
| P-7 exact input validation | input tests: null owner template and synthetic fixture cannot become real-account authorization; exact projects/identities/names/networks/windows/operators/images/budget required |
| Source/historical protection | `b1a2/check.mjs`: accepted127-file manifest, all original107 INC1/B1a evidence/planning files, protected application/legacy trees, source scope and secret scan |

Original B1a exhaustive point/control/provider campaign, asynchronous schedules, SIGKILL, actual COMMIT-ack loss, PG native TLS, direct-kill measurements, uncertainty handling and diagnostic tests remain mandatory. Original randomized18/27 coverage and independent Claude campaigns are never relabeled as this increment's exhaustive evidence.

Do not interpret local `EVIDENCE_READY`, static IAM coverage or Terraform `validate` as proof of actual Google Cloud instance termination, effective permissions, private networking, quota eligibility, billing control or teardown. Exact source acceptance is requested from Claude; every cloud/account/production authorization gate remains closed.
