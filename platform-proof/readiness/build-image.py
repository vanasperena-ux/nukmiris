"""PC-1 canonical local image assembly followed by a mandatory security gate.
Historical G-1 recipes/evidence remain at their original commits. Assembly is
not acceptance. No registry write, credentials, cloud or deployment capability.
"""
import argparse, base64, gzip, hashlib, io, json, os, pathlib, re, subprocess, sys, tarfile, tempfile
ROOTS = ['src', 'b1a/runtime', 'b1a2/runtime', 'package.json', 'package-lock.json']
PRIVATE_KEY = re.compile(rb'-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----')
DENIED_SUFFIX = re.compile(r'\.(?:pem|key|p12|pfx|sqlite|db|jsonl)$', re.I)

def need(ok, message):
    if not ok: raise ValueError(message)

def unoptimized():
    need(sys.flags.optimize == 0 and __debug__, 'optimized_python_prohibited')

def digest(data): return hashlib.sha256(data).hexdigest()
def canonical(value): return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()

def member(archive, name, data, mode=0o644, uid=0):
    info = tarfile.TarInfo(name)
    info.size, info.mode, info.uid, info.gid, info.mtime = len(data), mode, uid, uid, 0
    archive.addfile(info, io.BytesIO(data))

def docker(args):
    config = pathlib.Path('/tmp/nukmiris-readiness-docker-config')
    need(config.is_dir() and not config.is_symlink() and not any(config.iterdir()), 'fresh_empty_docker_config_required')
    env = {k:v for k,v in os.environ.items() if not k.startswith(('DOCKER_', 'GOOGLE_', 'GCLOUD_', 'CLOUDSDK_'))}
    return subprocess.check_output(['docker', '--host=unix:///var/run/docker.sock', '--config',
        '/tmp/nukmiris-readiness-docker-config', *args], env=env, timeout=300)

def validate_file(name, data, regular=True):
    need(regular, 'regular_files_only: ' + name)
    p = pathlib.PurePosixPath(name)
    need(not p.is_absolute() and '..' not in p.parts and p.as_posix() == name, 'unsafe_source_path: ' + name)
    need(name in ('package.json','package-lock.json') or name.startswith(('src/','b1a/runtime/','b1a2/runtime/','node_modules/')), 'source_root_denied: ' + name)
    need(not PRIVATE_KEY.search(data), 'private_key_marker: ' + name)
    need(not re.search(rb'"type"\s*:\s*"service_account"', data), 'service_account_marker: ' + name)
    need(not DENIED_SUFFIX.search(name), 'key_or_data_file: ' + name)

def validate_lock(lock):
    deps = {p:v for p,v in lock.get('packages',{}).items() if p}
    need(len(deps) == 14, 'unexpected_dependency_set')
    for path, value in deps.items():
        need(path.startswith('node_modules/') and '..' not in pathlib.PurePosixPath(path).parts, 'invalid_dependency_path')
        need(value.get('resolved','').startswith('https://registry.npmjs.org/') and not value.get('hasInstallScript') and not value.get('link'), 'untrusted_dependency_origin')
        integrity = value.get('integrity','')
        need(re.fullmatch(r'sha512-[A-Za-z0-9+/]+={0,2}', integrity) is not None, 'missing_lockfile_integrity')
        need(len(base64.b64decode(integrity[7:],validate=True)) == 64, 'invalid_lockfile_integrity')
    return deps

def base_inputs(archive, expected_config):
    with tarfile.open(archive) as outer:
        manifests = json.load(outer.extractfile('manifest.json'))
        need(len(manifests) == 1, 'single_base_manifest_required')
        manifest = manifests[0]
        config_bytes = outer.extractfile(manifest['Config']).read()
        need('sha256:'+digest(config_bytes) == expected_config, 'base_config_identity_mismatch')
        config = json.loads(config_bytes)
        need(config.get('os') == 'linux' and config.get('architecture') == 'amd64', 'base_platform_mismatch')
        layers = []
        for path in manifest['Layers']:
            data = outer.extractfile(path).read()
            if data.startswith(b'\x1f\x8b'): data = gzip.decompress(data)
            layers.append(data)
    need(['sha256:'+digest(v) for v in layers] == config['rootfs']['diff_ids'], 'base_layer_digest_mismatch')
    return config, layers

def compatibility(layers):
    # Public base account files only. Never copy the host's /etc/passwd.
    found = {}
    for data in layers:
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            for entry in archive:
                name = entry.name.lstrip('./')
                if name in ('etc/passwd','etc/group'):
                    need(entry.isfile(), 'base_account_not_regular')
                    found[name] = archive.extractfile(entry).read()
    need(set(found) == {'etc/passwd','etc/group'}, 'base_account_files_missing')
    for name,data in found.items():
        for line in data.decode().splitlines():
            fields = line.split(':')
            need(fields[0] != 'node' and fields[2] != '1000', 'base_account_collision')
    found['etc/passwd'] += b'node:x:1000:1000:Node runtime:/home/node:/sbin/nologin\n'
    found['etc/group'] += b'node:x:1000:\n'
    return found

def assemble(repo, source, out, cache, base_archive):
    """Assembly only. The public CLI always runs scan-image.py afterwards."""
    unoptimized()
    need(re.fullmatch('[a-f0-9]{40}',source) is not None, 'exact_commit_required')
    repo,out = pathlib.Path(repo).resolve(),pathlib.Path(out).resolve()
    need(str(out).startswith('/tmp/nukmiris-pc1-'), 'owned_tmp_output_required')
    out.mkdir(mode=0o700, parents=True, exist_ok=True)
    need(not list(out.iterdir()), 'fresh_empty_build_output_required')
    git = lambda *a: subprocess.check_output(['git','-C',str(repo),*a])
    tree = git('rev-parse',source+'^{tree}').decode().strip()
    for relative in ['platform-proof/readiness/build-image.py','platform-proof/pc1/image-policy.json',
                     'platform-proof/pc1/scan-image.py','platform-proof/pc1/security_gate.py','platform-proof/pc1/probe-runtime.mjs']:
        need(git('show',source+':'+relative) == (repo/relative).read_bytes(), 'recipe_not_from_exact_source: '+relative)
    policy = json.loads((repo/'platform-proof/pc1/image-policy.json').read_text())
    base = policy['base']
    need('@sha256:' in base, 'immutable_base_required')
    inspect = json.loads(docker(['image','inspect',base]))[0]
    need(inspect['Id'] == policy['baseConfigId'], 'base_inspect_identity_mismatch')
    need(base in inspect.get('RepoDigests',[]), 'base_repository_digest_mismatch')
    if not base_archive.exists(): docker(['image','save','--output',str(base_archive),base])
    config,base_layers = base_inputs(base_archive,policy['baseConfigId'])
    accounts = compatibility(base_layers)
    with tempfile.TemporaryDirectory(prefix='nukmiris-pc1-context-') as temporary:
        context = pathlib.Path(temporary)
        data = git('archive',source,*['platform-proof/'+p for p in ROOTS])
        with tarfile.open(fileobj=io.BytesIO(data)) as archive:
            need(all(v.isfile() or v.isdir() for v in archive), 'git_source_symlink_or_special_file')
            archive.extractall(context, filter='data')
        proof = context/'platform-proof'
        validate_lock(json.loads((proof/'package-lock.json').read_text()))
        env = {k:v for k,v in os.environ.items() if not k.lower().startswith(('npm_','node_','google_','gcloud_','cloudsdk_'))}
        for key in ['user','global']:
            path = context/('empty-'+key+'.npmrc');path.write_text('')
            env['npm_config_'+key+'config'] = str(path)
        need(subprocess.check_output(['node','--version'],env=env).decode().strip() == 'v'+policy['nodeVersion'], 'host_node_version_mismatch')
        need(subprocess.check_output(['npm','--version'],env=env).decode().strip() == policy['npmVersion'], 'host_npm_version_mismatch')
        install = subprocess.run(['npm','ci','--ignore-scripts','--omit=dev','--offline','--cache='+str(cache),'--no-audit','--no-fund'],cwd=proof,env=env,capture_output=True,text=True,timeout=120)
        (out/'npm-ci.log').write_text(install.stdout+install.stderr)
        need(install.returncode == 0, 'fresh_offline_dependency_install_failed')
        files,entries = [],{}
        for path in sorted(proof.rglob('*')):
            need(not path.is_symlink(), 'source_symlink_denied')
            if path.is_dir(): continue
            name,data = path.relative_to(proof).as_posix(),path.read_bytes()
            validate_file(name,data,path.is_file())
            mode = 0o755 if path.stat().st_mode&0o111 else 0o644
            entries['proof/'+name] = (data,mode,1000)
            files.append({'path':name,'sha256':digest(data),'bytes':len(data),'mode':oct(mode),'origin':'npm-ci-lockfile' if name.startswith('node_modules/') else source})
        for name,data in accounts.items(): entries[name] = (data,0o644,0)
        layer = out/'source-layer.tar'
        with tarfile.open(layer,'w',format=tarfile.USTAR_FORMAT) as archive:
            for name,(data,mode,uid) in sorted(entries.items()): member(archive,name,data,mode,uid)
        own = layer.read_bytes();diff = 'sha256:'+digest(own)
        config['created'] = '1970-01-01T00:00:00Z'
        config.pop('container',None);config.pop('container_config',None)
        envvars = dict(v.split('=',1) for v in config['config'].get('Env',[]))
        envvars.update({'B1A2_MODE':'INERT_UNCONFIGURED','B1A2_ROLE':'gateway','PORT':'8080',
                       'PATH':'/nodejs/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'})
        config['config'].update({'User':'node','WorkingDir':'/proof','Env':[k+'='+v for k,v in sorted(envvars.items())],
            'Entrypoint':['node','b1a2/runtime/entrypoint.mjs'],'Cmd':None,
            'Labels':{'nukmiris.scope':'PC1_LOCAL_SYNTHETIC_UNACCEPTED_CANDIDATE','nukmiris.source':source}})
        config['rootfs']['diff_ids'].append(diff)
        config.setdefault('history',[]).append({'created':'1970-01-01T00:00:00Z','created_by':'NukMiris canonical source-only layer PC1 V2'})
        cfg = canonical(config);cfgid = digest(cfg);layers = base_layers+[own]
        descriptors = [{'mediaType':'application/vnd.oci.image.layer.v1.tar','digest':'sha256:'+digest(v),'size':len(v)} for v in layers]
        oci = canonical({'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json',
                         'config':{'mediaType':'application/vnd.oci.image.config.v1+json','digest':'sha256:'+cfgid,'size':len(cfg)},'layers':descriptors})
        image = out/'candidate.docker.tar';names = [digest(v)+'/layer.tar' for v in layers]
        with tarfile.open(image,'w',format=tarfile.USTAR_FORMAT) as archive:
            member(archive,cfgid+'.json',cfg)
            member(archive,'manifest.json',canonical([{'Config':cfgid+'.json','RepoTags':[],'Layers':names}]))
            for name,data in zip(names,layers): member(archive,name,data)
        (out/'config.json').write_bytes(cfg);(out/'oci-manifest.json').write_bytes(oci)
        report = {'scope':'PC1_LOCAL_CANDIDATE_NOT_CLOUD_AUTHORIZATION','testedSource':source,'testedTree':tree,
                  'base':base,'basePlatform':'linux/amd64','baseConfigId':inspect['Id'],'imageConfigId':'sha256:'+cfgid,
                  'canonicalUncompressedOciManifestDigest':'sha256:'+digest(oci),'registryDigest':None,'layerDigests':descriptors,
                  'sourceLayerDigest':diff,'dockerArchiveSha256':digest(image.read_bytes()),'sourceManifestSha256':digest(canonical(files)),
                  'files':files,'compatibilityFiles':[{'path':n,'sha256':digest(d),'uid':0,'mode':'0o644'} for n,d in sorted(accounts.items())],
                  'securityAcceptance':'PENDING_MANDATORY_SCAN','recipeVersion':2}
        (out/'artifact.json').write_text(json.dumps(report,indent=2)+'\n')
        return report

def main():
    unoptimized()  # Before parsing/output creation; also rejects -O/-OO.
    parser = argparse.ArgumentParser()
    for name in ['repo','source','out','cache','base-archive','trivy','trivy-cache']: parser.add_argument('--'+name,required=True)
    args = parser.parse_args()
    report = assemble(args.repo,args.source,args.out,args.cache,pathlib.Path(args.base_archive))
    scan = pathlib.Path(args.repo).resolve()/'platform-proof/pc1/scan-image.py'
    subprocess.run([sys.executable,'-I',str(scan),'--build',args.out,'--repo',args.repo,
                    '--trivy',args.trivy,'--trivy-cache',args.trivy_cache],check=True)
    print(json.dumps({k:v for k,v in report.items() if k not in ['files','layerDigests']}))

if __name__ == '__main__': main()
