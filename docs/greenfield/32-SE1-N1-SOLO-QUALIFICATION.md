# SE-1 follow-up N1: solo qualification only at creation

Approved scope: owner-authorized N1 correction to [Claude's finding](https://github.com/vanasperena-ux/nukmiris/pull/25#issuecomment-6906440798). Original source `540fc4af57a29eba380c0f53df0bf3ad12093ad7` remains intact, including its [owner-reported Windows functional acceptance](https://github.com/vanasperena-ux/nukmiris/pull/25#issuecomment-6906738033). That report is not a new automated native Windows run. Corrected tested source: **`95b122771b0958c0bc9bda07db1dab14f35aeb67`**. [New evidence](../../vnext/evidence/se1-n1/README.md) is separate from the original evidence.

The bug was in migration 010: its service upsert added the sole default employee's qualification on every save, undoing an owner's removal. New migration **011-solo-qualification-creation-only.sql** replaces only `core.catalog_save`. Under the existing business catalog lock it checks whether `(business_id, service_id)` already exists before the upsert. A missing qualification never means a new service. The creation-only condition guards the existing solo insert. Other validation, replay, locking, employee saves, revisions and history logic are unchanged.

The structural solo definition stays **exactly one employee record**, including inactive records, using the default resource. New service creation may qualify that employee. Editing any existing service never adds/restores qualifications. Inactive services/employees and services with no active qualified employee remain unbookable. Decisions 139 and 147, random allocation and confirmations are unchanged. No N2–N5 work is included.

## Fresh installation and existing SE-1 profiles

- Fresh local/core fixtures run unchanged migrations 001–010, then 011, before seeding/serving the application.
- Existing SE-1 profiles use the existing explicit `upgrade` CLI. It acquires the profile's existing command lock, validates its identity, stops the worker, creates/verifies the coherent SQL/archive/ledger backup, and applies 011 in a transaction. No empty-fixture migrations or initialization are rerun.
- `CREATE OR REPLACE FUNCTION` preserves the existing function OID, owner and ACL. The version comment `SE1_N1_CREATE_ONLY_V1` identifies the applied correction, following the runner's existing feature-probe approach. A second upgrade is a no-op; reapplying 011 also leaves data unchanged. Interrupted/rolled-back DDL leaves the old function intact.
- New source refuses worker startup with `se1_n1_upgrade_required` until 011 is installed. Upgrading never automatically restarts or activates the application. This marker is migration metadata, not a protection against a trusted database administrator changing SQL.
- Profiles without SE-1/catalog 010 do not receive 010 or service initialization through this command. The previous 008/009 upgrade behavior remains. Inert restored profiles remain blocked from activation/ordinary upgrade.
- Migration 011 executes **no table data changes**. All existing qualifications, including ones previously inserted by the bug, remain. The software cannot infer past intent. Any later removal must be the owner's explicit employee-qualification edit. Appointments, snapshots, ledger, identities and uncertain operations are preserved.

## Optional native Windows verification — disposable fixtures only

Do not modify the accepted Windows profile, the original profile or Ana's protected case. The smallest additional check creates its own temporary profiles; it does not need your existing profile path. In a NEW checkout:

```powershell
$Source = '95b122771b0958c0bc9bda07db1dab14f35aeb67'
$Checkout = Join-Path $env:USERPROFILE 'Desktop\NukMiris N1 Review'
if (Test-Path -LiteralPath $Checkout) { throw 'Choose a new directory.' }
git clone --single-branch --branch product/services-employees-local-owner https://github.com/vanasperena-ux/nukmiris.git "$Checkout"
Set-Location -LiteralPath $Checkout
git checkout --detach $Source
Set-Location vnext
npm.cmd ci --ignore-scripts
npm.cmd run test:services:runtime
```

Requires Node 24, Git and Docker Desktop Linux containers. Expected: **2 PASS / 0 FAIL / 0 SKIP**, including `N1Upgrade: PASS`, PostgreSQL 17.11, all 43 core tables preserved, unchanged function permissions, DDL rollback, repeat upgrade, restart and the protected UNKNOWN operation. Stop on any failure and retain output. The core `test:services`/full harness uses Linux Unix sockets; the portable TCP command above is the native Windows check. Native Windows execution of this correction has **not** been performed by Codex.

For a separately owner-authorized, already initialized SE-1 test profile, the supported deployment commands are:

```powershell
# Set $Target only to that explicitly authorized SE-1 profile, never the protected original.
$Instance = (Get-Content -Raw -LiteralPath (Join-Path $Target 'state.json') | ConvertFrom-Json).id
node local/cli.mjs upgrade --state-dir "$Target" --confirm "$Instance"
# Expect appliedMigrations: ["011-solo-qualification-creation-only.sql"], automaticActivation: false.
# Repeat reports alreadyCurrent. The worker stays stopped. Inspect the backup/result first.
# Only when explicitly ready, start that same authorized synthetic profile with its supported port:
# node local/cli.mjs start --state-dir "$Target" --port <its-supported-port>
```

Codex did not execute these commands against the owner's profile. Backups stay private and restore remains inert. No reset, inferred qualification cleanup, profile reinitialization, live providers, cloud, registry activity or merge is authorized by this correction. Keep Draft PR #25 unmerged; stop for owner review and focused N1-only re-verification.
