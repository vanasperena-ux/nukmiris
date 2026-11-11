# INC1 decisions — before implementation

Owner authorization: uploaded INC1 charter,2026-11-11 America/Mexico_City.
Baseline: accepted executable b4d0be0cb98c7f2b69be318e18b93f4de102c511,
tree03d08322e27d9d54485fa887b482743fe076556b; PR18 publication2307980;
PR19/provider decision d3fa65192374ca206ff1f6d166a789c295a15e97.
Google Cloud remains preferred; no provider comparison is reopened.

**MB-03 decision (selected before gateway code):** the permit-creating transaction
and COMMIT run inside the gateway process. A non-serializable one-use continuation
is created only after that COMMIT response succeeds. No attempt ticket or permit
is returned to the caller. A durable ENTERED row is never a resumable permission.
Lost COMMIT response, process death, timeout or lost provider response cannot
recreate that continuation. Each logical operation has one immutable attempt in
this deliberately minimal proof schema; no replacement-operation/rearm feature.

Use separate local PostgreSQL17.11 schema/database/container, local HTTPS fake
provider process and independent wake/supervisor process. Each scenario has its
own authority scope; epochs/revisions are immutable gateway deployment labels.
No accepted app migration, role, local profile or data is reused or imported.
Stored binding fields are immutable; gateway/worker roles have narrow functions,
not direct mutation grants or BYPASSRLS. This is not a solution to MB-01 for B1b.

Raw TLS HTTP/1.1 opens a fresh literal-loopback connection per attempt with runtime
generated pinned test trust, no connection agent, pool, redirects or retries. The
absolute effect deadline precedes the handler timeout, is checked at continuation
boundaries and aborts the socket. Timers cannot run while frozen; preserve this
limit and F13. SQL epoch denial and heartbeat silence do not prove physical death.

The provider's append-only hash chain records its own connection/TLS/request/
acceptance events. A separately retained supervisor checkpoint anchors verification
against rehashing/truncation. Keys are ephemeral and never published. This local
experimental trust model is not production custody009/011/017.

The classifier uses connection/write **intervals**, clock uncertainty, independent
process-exit or future platform evidence. Missing/stale/ambiguous evidence yields
NOT_PROVEN. A received response is separate from provider acceptance; no response
never means rejected. Pre-fence bytes may arrive later. Intentionally unsafe
keep-alive and live-old-process counterexamples must remain reproducible.

All IaC/operational artifacts are plan/print-only and blocked from application.
No Cloud SQL probe is executed on a real service. Historical planning/cost evidence
remains unchanged; new calculations are an additive artifact here. C-1/C-2 are
addressed only for owner-authorized INC1; C-3–14 and all provisioning, REAL, COMM,
name-confirmation, OPS01 and archive gates remain. Stop at Draft PR/review handoff.
