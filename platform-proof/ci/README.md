# Local CI recipe; no cloud apply workflow

This directory is documentation, not an activated repository Actions workflow.
On a Linux Node24 host with local Docker and OpenSSL, run `npm ci --ignore-scripts`,
`npm run check`, then `npm test` from platform-proof. Use an unprivileged task
environment without cloud/provider credentials. Docker permissions grant local
host control: use a disposable CI runner, not the owner's runtime machine.

For IaC syntax/schema only: Terraform1.17.2, Google provider8.11.0,
`terraform init -backend=false -input=false`, `terraform validate -json` in
planning/terraform. Package/provider downloads are public tooling downloads, not
provider account access. Do not run plan/apply/destroy or enable APIs. Every
resource depends on an unsatisfiable authorization gate and uses an invalid static
provider token; no ADC or owner credential is requested. No automatic cloud jobs
or secrets were added. A separately reviewed source change is needed for B1a.
