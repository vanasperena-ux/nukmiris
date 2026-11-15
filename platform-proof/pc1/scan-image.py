"""Mandatory offline scanner/runtime proof for an exact locally assembled image.
Every failure preserves logs and a HOLD receipt. It never pushes an image or
contacts a cloud account. Public DB download is a separate explicit operator step.
"""
import argparse
import datetime as dt
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import subprocess
import sys
import tarfile

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('pc1_security_gate', HERE / 'security_gate.py')
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)


def sha(path):
    h = hashlib.sha256()
    with pathlib.Path(path).open('rb') as file:
        for block in iter(lambda: file.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def save(path, value):
    pathlib.Path(path).write_text(json.dumps(value, indent=2) + '\n')


def utc():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def verify_archive(build, artifact):
    for filename, key, prefix in [('candidate.docker.tar','dockerArchiveSha256',''),
                                   ('source-layer.tar','sourceLayerDigest','sha256:'),
                                   ('config.json','imageConfigId','sha256:'),
                                   ('oci-manifest.json','canonicalUncompressedOciManifestDigest','sha256:')]:
        gate.need(prefix + sha(build / filename) == artifact[key], 'artifact_digest_mismatch: ' + filename)
    config = json.loads((build / 'config.json').read_text())
    gate.need(config['config']['User'] == 'node' and config['config']['Entrypoint'] == ['node','b1a2/runtime/entrypoint.mjs'], 'direct_nonroot_entrypoint_required')
    gate.need(config['config']['Labels']['nukmiris.source'] == artifact['testedSource'], 'source_config_binding_mismatch')
    regular, links = {}, {}
    native = []
    with tarfile.open(build / 'candidate.docker.tar') as outer:
        manifest = json.load(outer.extractfile('manifest.json'))
        gate.need(len(manifest) == 1 and not manifest[0]['RepoTags'], 'untagged_single_image_required')
        manifest = manifest[0]
        actual_config = outer.extractfile(manifest['Config']).read()
        gate.need(actual_config == (build / 'config.json').read_bytes(), 'archive_config_mismatch')
        layers = []
        for name in manifest['Layers']:
            data = outer.extractfile(name).read()
            layers.append('sha256:' + hashlib.sha256(data).hexdigest())
            with tarfile.open(fileobj=io.BytesIO(data)) as layer:
                for entry in layer:
                    path = '/' + entry.name.lstrip('./')
                    gate.need('/../' not in path, 'unsafe_archive_path')
                    gate.need('/.wh.' not in path, 'unexpected_whiteout_requires_review')
                    if entry.isfile():
                        regular[path] = hashlib.sha256(layer.extractfile(entry).read()).hexdigest()
                        links.pop(path, None)
                        if path.endswith('.node'):
                            native.append(path)
                    elif entry.issym() or entry.islnk():
                        links[path] = entry.linkname
                        regular.pop(path, None)
        gate.need(layers == config['rootfs']['diff_ids'] == [r['digest'] for r in artifact['layerDigests']], 'archive_layer_mismatch')
    import re
    tool_paths = [p for p in regular.keys() | links.keys() if
                  re.search(r'/(?:bin/)?(?:npm|npx|corepack|yarn|yarnpkg)$', p) or
                  re.search(r'/node_modules/(?:npm|corepack|yarn)(?:/|$)', p) or
                  re.search(r'^/opt/yarn(?:/|-)', p)]
    gate.need(not tool_paths, 'runtime_package_manager_files_present: ' + repr(tool_paths[:10]))
    return regular, links, native


def main():
    gate.need(sys.flags.optimize == 0 and __debug__, 'optimized_python_prohibited')
    parser = argparse.ArgumentParser()
    for name in ['build','repo','trivy','trivy-cache']:
        parser.add_argument('--' + name, required=True)
    args = parser.parse_args()
    build, repo = pathlib.Path(args.build).resolve(), pathlib.Path(args.repo).resolve()
    out = build / 'security'
    out.mkdir(mode=0o700, exist_ok=False)
    result = {'verdict':'HOLD','reasons':['verification_not_completed'],'productionOrCloudAuthorization':False}
    receipt = {'scanStartedAt':utc()}
    env = {k:v for k,v in os.environ.items() if not k.lower().startswith(
        ('trivy_','docker_','google_','gcloud_','cloudsdk_','node_','npm_'))}
    env.update({'DOCKER_CONFIG':'/tmp/nukmiris-readiness-docker-config'})
    def run(label, argv, timeout=300):
        completed = subprocess.run(argv, env=env, capture_output=True, timeout=timeout)
        (out / (label + '.stdout.log')).write_bytes(completed.stdout)
        (out / (label + '.stderr.log')).write_bytes(completed.stderr)
        receipt.setdefault('commands', []).append({'label':label,'argv':argv,'exitCode':completed.returncode})
        return completed
    try:
        docker_config = pathlib.Path('/tmp/nukmiris-readiness-docker-config')
        gate.need(docker_config.is_dir() and not docker_config.is_symlink() and not any(docker_config.iterdir()), 'fresh_empty_docker_config_required')
        policy = json.loads((repo / 'platform-proof/pc1/image-policy.json').read_text())
        artifact = json.loads((build / 'artifact.json').read_text())
        for relative in ['platform-proof/pc1/image-policy.json','platform-proof/pc1/security_gate.py',
                         'platform-proof/pc1/scan-image.py','platform-proof/pc1/probe-runtime.mjs']:
            committed = subprocess.check_output(['git','-C',str(repo),'show',artifact['testedSource']+':'+relative])
            gate.need(committed == (repo / relative).read_bytes(), 'scanner_recipe_source_mismatch')
        regular, links, native = verify_archive(build, artifact)
        trivy = str(pathlib.Path(args.trivy).resolve())
        receipt['scannerBinarySha256'] = sha(trivy)
        gate.need(receipt['scannerBinarySha256'] == policy['scannerBinarySha256'], 'scanner_binary_not_pinned')
        vr = run('scanner-version',[trivy,'--version','--format','json'])
        gate.need(vr.returncode == 0, 'scanner_version_failed')
        receipt['scannerVersion'] = json.loads(vr.stdout)['Version']
        dbroot = pathlib.Path(args.trivy_cache).resolve()
        dbpath, metapath = dbroot / 'db/trivy.db', dbroot / 'db/metadata.json'
        receipt.update({'databaseSha256':sha(dbpath),'databaseMetadata':json.loads(metapath.read_text()),
                        'databaseMetadataSha256':sha(metapath),'databaseRepository':policy['databaseRepository']})
        now = dt.datetime.now(dt.timezone.utc)
        for key in ['UpdatedAt','DownloadedAt']:
            gate.need(0 <= (now - gate.timestamp(receipt['databaseMetadata'][key])).total_seconds() <= policy['maxDatabaseAgeHours']*3600, 'database_not_fresh')
        scanargs = [trivy,'image','--input',str(build / 'candidate.docker.tar'),'--cache-dir',str(dbroot),
                    '--config','','--module-dir',str(out / 'empty-modules'),'--offline-scan',
                    '--skip-db-update','--skip-java-db-update','--skip-check-update','--skip-vex-repo-update',
                    '--skip-version-check','--disable-telemetry','--ignorefile','','--secret-config','',
                    '--scanners','vuln','--pkg-types','os,library','--list-all-pkgs','--exit-code','0',
                    '--no-progress','--timeout','5m']
        for label, fmt, filename in [('scan','json','vulnerabilities.json'),('sbom','cyclonedx','sbom.cdx.json')]:
            completed = run(label,scanargs + ['--format',fmt,'--output',str(out / filename)])
            receipt[label + 'ExitCode'] = completed.returncode
            gate.need(completed.returncode == 0, label + '_execution_failed')
            receipt[filename + 'Sha256'] = sha(out / filename)
        gate.need(receipt['databaseSha256'] == sha(dbpath) and receipt['databaseMetadataSha256'] == sha(metapath), 'database_changed_during_scan')
        d = ['docker','--host=unix:///var/run/docker.sock','--config','/tmp/nukmiris-readiness-docker-config']
        gate.need(run('image-load', d + ['load','--input',str(build / 'candidate.docker.tar')]).returncode == 0, 'image_load_failed')
        probe_path = repo / 'platform-proof/pc1/probe-runtime.mjs'
        pr = run('runtime-probe',d + ['run','--rm','--network','none','--read-only','--cap-drop=ALL',
                 '--security-opt=no-new-privileges','--entrypoint','node','-v',str(probe_path)+':/pc1-probe.mjs:ro',
                 artifact['imageConfigId'],'/pc1-probe.mjs'])
        gate.need(pr.returncode == 0, 'runtime_probe_failed')
        probe = json.loads(pr.stdout)
        save(out / 'runtime-probe.json', probe)
        scan = json.loads((out / 'vulnerabilities.json').read_text())
        sbom = json.loads((out / 'sbom.cdx.json').read_text())
        owners = {}
        for result_ in scan.get('Results', []):
            if result_.get('Type') == 'debian':
                for pkg in result_['Packages']:
                    for name in pkg.get('InstalledFiles', []):
                        owners.setdefault(name, []).append(pkg['Name'])
        attribution = []
        for row in probe['loadedFiles']:
            name = row['path']
            package = 'OFFICIAL_NODE_BINARY' if name == '/nodejs/bin/node' else owners.get(name, [])
            gate.need(isinstance(package,str) or len(package) == 1, 'ambiguous_or_unknown_loaded_file: '+name)
            attribution.append({'path':name,'sha256':row['sha256'],'archiveSha256':regular.get(name),
                                'package':package if isinstance(package,str) else package[0]})
        lock = json.loads(subprocess.check_output(['git','-C',str(repo),'show',artifact['testedSource']+':platform-proof/package-lock.json']))
        expected = {p.removeprefix('node_modules/'):v['version'] for p,v in lock['packages'].items() if p}
        receipt.update({'loadedFileAttribution':attribution,'nativeAddonPaths':native,'expectedApplicationPackages':expected,
                        'integrityVerified':True,'scanFinishedAt':utc(),'registryPush':False,'registryDigest':None})
        result = gate.evaluate(policy,artifact,scan,sbom,probe,receipt,dt.datetime.now(dt.timezone.utc))
    except Exception as error:
        result = {'verdict':'HOLD','reasons':[type(error).__name__ + ': ' + str(error)],'productionOrCloudAuthorization':False}
    finally:
        receipt['finishedAt'] = utc()
        save(out / 'scan-receipt.json',receipt)
        save(out / 'security-evaluation.json',result)
    print(json.dumps({k:v for k,v in result.items() if k != 'findings'}))
    if result['verdict'] != 'PASS_LOCAL_PENDING_INDEPENDENT_REVIEW':
        raise SystemExit(1)


if __name__ == '__main__':
    main()
