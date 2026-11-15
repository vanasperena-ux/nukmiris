"""Fail-closed PC-1 image policy. No deployment or exception-approval capability.

All retained OS packages and all application dependencies are conservatively
reachable. This increment accepts no severe-finding exceptions. A future unused
package exception needs a separate dated, individual review, not a CLI flag.
"""
import collections
import datetime as dt
import re


def need(condition, message):
    if not condition:
        raise ValueError(message)


def timestamp(value):
    parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    need(parsed.tzinfo is not None, 'timestamp_timezone_required')
    return parsed


def version(value):
    need(re.fullmatch(r'v?\d+\.\d+\.\d+', value) is not None, 'invalid_node_version')
    return tuple(map(int, value.lstrip('v').split('.')))


def evaluate(policy, artifact, scan, sbom, probe, receipt, now):
    """Inputs must first be bound to actual artifact bytes by scan-image.py."""
    reasons, inventory = [], []
    try:
        age = (now - timestamp(policy['reviewedAt'])).total_seconds()
        need(0 <= age <= policy['maxPolicyAgeHours'] * 3600, 'node_security_policy_stale_or_future')
        need(policy['reachableOSPolicy'] == 'ALL_RETAINED_OS_PACKAGES_POTENTIALLY_REACHABLE',
             'unsupported_reachability_policy')
        need(policy['exceptions'] == [], 'exceptions_require_separate_individual_security_review')
        need(artifact['base'] == policy['base'] and artifact['baseConfigId'] == policy['baseConfigId'], 'base_policy_mismatch')
        need(artifact['imageConfigId'] not in policy['permanentlyDeniedImageIds'], 'permanently_local_test_only_image')
        need(receipt['scannerVersion'] == policy['scannerVersion'] and
             receipt['scannerBinarySha256'] == policy['scannerBinarySha256'], 'scanner_identity_mismatch')
        need(receipt['scanExitCode'] == 0 and receipt['sbomExitCode'] == 0, 'scanner_execution_failed')
        need(receipt['integrityVerified'] is True, 'artifact_or_scan_integrity_insufficient')
        need(receipt['databaseRepository'] == policy['databaseRepository'], 'database_origin_mismatch')
        need(re.fullmatch('[a-f0-9]{64}', receipt['databaseSha256']) is not None, 'database_integrity_missing')
        db = receipt['databaseMetadata']
        need(db['Version'] == 2, 'database_schema_unsupported')
        for field in ['UpdatedAt', 'DownloadedAt']:
            age = (now - timestamp(db[field])).total_seconds()
            need(0 <= age <= policy['maxDatabaseAgeHours'] * 3600, 'database_stale_or_future: ' + field)
        need(timestamp(db['NextUpdate']) > now, 'database_update_due')
        for field in ['scanStartedAt', 'scanFinishedAt']:
            age = (now - timestamp(receipt[field])).total_seconds()
            need(0 <= age <= policy['maxDatabaseAgeHours'] * 3600, 'scan_stale_or_future')
        need(scan['SchemaVersion'] == 2 and scan['ArtifactType'] == 'container_image', 'scan_schema_or_type_invalid')
        need(scan['Trivy']['Version'] == policy['scannerVersion'], 'report_scanner_version_mismatch')
        need(scan['Metadata']['ImageID'] == artifact['imageConfigId'], 'scan_image_identity_mismatch')
        expected_layers = [row['digest'] for row in artifact['layerDigests']]
        need(scan['Metadata']['DiffIDs'] == expected_layers, 'scan_layer_identity_mismatch')
        need(scan['Metadata']['OS'] == {'Family': 'debian', 'Name': policy['debianVersion']}, 'os_coverage_missing')
        props = sbom['metadata']['component']['properties']
        need(sbom['bomFormat'] == 'CycloneDX' and sbom['specVersion'] == '1.6', 'sbom_format_invalid')
        need([p['value'] for p in props if p['name'] == 'aquasecurity:trivy:ImageID'] == [artifact['imageConfigId']], 'sbom_image_identity_mismatch')
        need(sorted(p['value'] for p in props if p['name'] == 'aquasecurity:trivy:DiffID') == sorted(expected_layers), 'sbom_layer_identity_mismatch')
        need(version(probe['node']) >= version(policy['minimumNodeVersion']) and version(probe['node'])[0] == 24,
             'node_below_explicit_security_floor')
        need(probe['node'] == 'v' + policy['nodeVersion'] and probe['nodeSha256'] == policy['nodeBinarySha256'], 'node_binary_provenance_mismatch')
        need(probe['versions']['openssl'] == policy['openSSLVersion'] and probe['sharedOpenSSL'] is False,
             'openssl_provenance_mismatch')
        need(probe['uid'] == 1000 and probe['gid'] == 1000, 'nonroot_identity_mismatch')
        need(probe['debian'] == policy['debianVersion'], 'runtime_os_mismatch')
        need(len(probe['tooling']) >= 20 and all(p['present'] is False for p in probe['tooling']), 'runtime_tooling_present_or_incomplete_probe')
        packages = []
        need({r['Type'] for r in scan['Results']} == {'debian', 'node-pkg'}, 'scan_package_ecosystem_coverage_missing')
        for result in scan['Results']:
            need(result.get('Misconfigurations') is None, 'unexpected_scan_kind')
            need(isinstance(result['Packages'], list) and result['Packages'], 'package_attribution_missing')
            for pkg in result['Packages']:
                need(pkg['Identifier']['PURL'] and pkg['Name'] and pkg['Version'], 'package_identifier_missing')
                packages.append((result['Type'], pkg))
        os_packages = {p['Name']: p for kind, p in packages if kind == 'debian'}
        app_packages = {p['Name']: p['Version'] for kind, p in packages if kind == 'node-pkg'}
        need(len(os_packages) == 14, 'unexpected_os_package_inventory')
        need(app_packages == receipt['expectedApplicationPackages'] and len(app_packages) == 14, 'application_dependency_coverage_mismatch')
        purls = {p['Identifier']['PURL'] for _, p in packages}
        need(purls == {c['purl'] for c in sbom['components'] if c.get('purl')}, 'sbom_package_inventory_mismatch')
        need(not receipt['nativeAddonPaths'], 'native_addon_requires_new_reachability_review')
        mappings = {row['path']: row for row in receipt['loadedFileAttribution']}
        need(len(mappings) == len(probe['loadedFiles']) and mappings, 'loaded_file_attribution_missing')
        for file in probe['loadedFiles']:
            row = mappings[file['path']]
            need(row['sha256'] == file['sha256'] and row['archiveSha256'] == file['sha256'], 'loaded_file_archive_integrity_mismatch')
            if file['path'] == '/nodejs/bin/node':
                need(row['package'] == 'OFFICIAL_NODE_BINARY' and file['sha256'] == policy['nodeBinarySha256'], 'node_attribution_invalid')
            else:
                pkg = os_packages[row['package']]
                need(file['path'] in pkg['InstalledFiles'], 'loaded_file_package_owner_mismatch')
        for result in scan['Results']:
            known = {p['ID']: p for p in result['Packages']}
            for finding in result.get('Vulnerabilities') or []:
                pkg = known[finding['PkgID']]
                need(finding['PkgName'] == pkg['Name'] and finding['InstalledVersion'] == pkg['Version'] and
                     finding['PkgIdentifier']['PURL'] == pkg['Identifier']['PURL'], 'finding_attribution_mismatch')
                severity = finding['Severity']
                need(severity in ['UNKNOWN','LOW','MEDIUM','HIGH','CRITICAL'], 'unrecognized_severity')
                row = {k: finding.get(k) for k in ['VulnerabilityID','PkgName','InstalledVersion','FixedVersion','Status','Severity']}
                row['reachability'] = 'APPLICATION_DEPENDENCY' if result['Type'] == 'node-pkg' else 'POTENTIALLY_RUNTIME_OS'
                row['fixable'] = bool(finding.get('FixedVersion'))
                inventory.append(row)
                if severity in ['HIGH','CRITICAL']:
                    if row['fixable']:
                        reasons.append('fixable_severe: ' + finding['VulnerabilityID'] + '/' + pkg['Name'])
                    reasons.append('runtime_severe: ' + finding['VulnerabilityID'] + '/' + pkg['Name'])
    except (KeyError, TypeError, ValueError, IndexError) as error:
        reasons.append('insufficient_or_invalid_evidence: ' + str(error))
    counts = collections.Counter(row['Severity'] for row in inventory)
    return {'verdict': 'HOLD' if reasons else 'PASS_LOCAL_PENDING_INDEPENDENT_REVIEW',
            'reasons': reasons, 'vulnerabilityCounts': dict(counts), 'findings': inventory,
            'fixableCriticalHigh': sum(r['fixable'] and r['Severity'] in ['CRITICAL','HIGH'] for r in inventory),
            'runtimeCriticalHigh': sum(r['Severity'] in ['CRITICAL','HIGH'] for r in inventory),
            'exceptions': [], 'productionOrCloudAuthorization': False,
            'severityPolicy': 'Trivy vendor-selected Severity; all raw CVSS/vendor data retained, no ignore rules',
            'reachabilityPolicy': 'all retained OS packages and application dependencies conservatively reachable'}
