# Database evidence archive publication withheld

The code and readable test logs are published; compressed SQL/state evidence is
retained locally. Automatic approval review rejected uploading the full SQL
snapshot archive twice (including after all-member inspection), then rejected the
remediation trace archive. Its stated reason: potential database-content disclosure
and insufficient authorization for these specific payloads to the public repository.
No alternate encoding or indirect publication is used. The remaining compressed
state bundles are held with them pending specific authorization.

- Destination requiring approval: public `vanasperena-ux/nukmiris`, Draft PR #4.
- Local retained directory: `/workspace/work/wp1-remediation/withheld/`.
- Exact filenames, sizes and SHA-256 values: [withheld artifact manifest](withheld-artifact-manifest.json).
- 187 SQL snapshots (99 full / 88 fault) were inspected: [all-member inventory](snapshot-content-inspection.json).
- Full/fault test logs, per-snapshot hashes, database inventory, source hashes and
  baseline counterexamples remain readable in this evidence package.

Earlier accepted blob uploads have not been attached as substitutes for the
rejected state content. Publication of the retained bundle requires specific owner
approval for these artifacts and destination, followed by automatic approval review.
CP1/CP2 remain open for independent verification. This restriction affects artifact
publication, not the actual 88/78 passing tests or their recorded results.
