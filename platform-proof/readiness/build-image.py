"""Deterministic local-only image assembly. Never pushes or reads registry credentials.
Build inputs: exact Git source, immutable linux/amd64 Node base, lockfile-resolved
npm dependencies (fresh offline ci), and this recipe. Does not rebuild old evidence.
"""
import argparse,hashlib,io,json,os,pathlib,re,subprocess,tarfile,tempfile
BASE='node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df'
ROOTS=['src','b1a/runtime','b1a2/runtime','package.json','package-lock.json']
def digest(data):return hashlib.sha256(data).hexdigest()
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),ensure_ascii=False).encode()
def member(t,name,data,mode=0o644,uid=0):
    info=tarfile.TarInfo(name);info.size=len(data);info.mode=mode;info.uid=info.gid=uid;info.mtime=0
    t.addfile(info,io.BytesIO(data))
def docker(args):
    env={k:v for k,v in os.environ.items() if not k.startswith(('DOCKER_','GOOGLE_','GCLOUD_','CLOUDSDK_'))}
    return subprocess.check_output(['docker','--host=unix:///var/run/docker.sock','--config','/tmp/nukmiris-readiness-docker-config',*args],env=env,timeout=180)
def build(repo,source,out,cache,base_archive):
    out=pathlib.Path(out).resolve();out.mkdir(mode=0o700,parents=True,exist_ok=True)
    assert str(out).startswith('/tmp/nukmiris-readiness-'),'owned /tmp output required'
    tree=subprocess.check_output(['git','rev-parse',source+'^{tree}'],cwd=repo,text=True).strip()
    inspect=json.loads(docker(['image','inspect',BASE]))[0]
    assert inspect['Os']=='linux' and inspect['Architecture']=='amd64'
    assert BASE.removeprefix('node@') in [v.split('@')[-1] for v in inspect['RepoDigests']]
    if not base_archive.exists():docker(['image','save','--output',str(base_archive),BASE])
    with tarfile.open(base_archive) as b:
        manifest=json.load(b.extractfile('manifest.json'))[0];base_config_bytes=b.extractfile(manifest['Config']).read();config=json.loads(base_config_bytes)
        assert 'sha256:'+digest(base_config_bytes)==inspect['Id']
        base_layers=[b.extractfile(name).read() for name in manifest['Layers']]
    assert ['sha256:'+digest(x) for x in base_layers]==config['rootfs']['diff_ids']
    with tempfile.TemporaryDirectory(prefix='nukmiris-readiness-context-') as temp:
        context=pathlib.Path(temp)
        archive=subprocess.check_output(['git','archive',source,*['platform-proof/'+p for p in ROOTS]],cwd=repo)
        with tarfile.open(fileobj=io.BytesIO(archive)) as t:t.extractall(context,filter='data')
        proof=context/'platform-proof'
        env={k:v for k,v in os.environ.items() if not k.lower().startswith(('npm_','google_','gcloud_','cloudsdk_'))};env.update({'npm_config_userconfig':'/dev/null','npm_config_globalconfig':'/dev/null'})
        install=subprocess.run(['npm','ci','--ignore-scripts','--omit=dev','--offline','--cache='+str(cache),'--no-audit','--no-fund'],cwd=proof,env=env,check=True,capture_output=True,text=True,timeout=60)
        (out/'npm-ci.log').write_text(install.stdout+install.stderr)
        paths=sorted(p for p in proof.rglob('*') if not p.is_dir());files=[];layer=out/'source-layer.tar'
        with tarfile.open(layer,'w',format=tarfile.USTAR_FORMAT) as t:
            for p in paths:
                assert p.is_file() and not p.is_symlink(),'regular source/dependency files only'
                name=p.relative_to(proof).as_posix();data=p.read_bytes()
                assert name=='package.json' or name=='package-lock.json' or name.startswith(('src/','b1a/runtime/','b1a2/runtime/','node_modules/'))
                assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',data),name
                assert not re.search(rb'"type"\s*:\s*"service_account"',data),name
                assert not re.search(r'\.(?:pem|key|p12|pfx|sqlite|db|jsonl)$',name),name
                mode=0o755 if p.stat().st_mode&0o111 else 0o644
                member(t,'proof/'+name,data,mode,1000)
                files.append({'path':name,'sha256':digest(data),'bytes':len(data),'mode':oct(mode),'origin':'npm-ci-lockfile' if name.startswith('node_modules/') else source})
        own=layer.read_bytes();diff='sha256:'+digest(own)
        config['created']='1970-01-01T00:00:00Z';config.pop('container',None);config.pop('container_config',None)
        envvars=dict(v.split('=',1) for v in config['config'].get('Env',[]));envvars.update({'B1A2_MODE':'INERT_UNCONFIGURED','B1A2_ROLE':'gateway','PORT':'8080'})
        config['config'].update({'User':'node','WorkingDir':'/proof','Env':[k+'='+v for k,v in sorted(envvars.items())],'Entrypoint':['node','b1a2/runtime/entrypoint.mjs'],'Cmd':None,'Labels':{'nukmiris.scope':'LOCAL_SYNTHETIC_SOURCE_CANDIDATE','nukmiris.source':source}})
        config['rootfs']['diff_ids'].append(diff);config.setdefault('history',[]).append({'created':'1970-01-01T00:00:00Z','created_by':'NukMiris canonical source-only layer V1'})
        cfg=canonical(config);cfgid=digest(cfg);layers=base_layers+[own]
        descriptors=[{'mediaType':'application/vnd.oci.image.layer.v1.tar','digest':'sha256:'+digest(x),'size':len(x)} for x in layers]
        oci={'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':{'mediaType':'application/vnd.oci.image.config.v1+json','digest':'sha256:'+cfgid,'size':len(cfg)},'layers':descriptors};ocibytes=canonical(oci)
        # Canonical Docker load archive; base bytes unchanged, no registry push.
        image=out/'candidate.docker.tar';names=[digest(x)+'/layer.tar' for x in layers]
        with tarfile.open(image,'w',format=tarfile.USTAR_FORMAT) as t:
            member(t,cfgid+'.json',cfg)
            member(t,'manifest.json',canonical([{'Config':cfgid+'.json','RepoTags':[],'Layers':names}]))
            for name,data in zip(names,layers):member(t,name,data)
        (out/'config.json').write_bytes(cfg);(out/'oci-manifest.json').write_bytes(ocibytes)
        report={'scope':'NEW_LOCAL_CANDIDATE_NO_REGISTRY_PUSH','testedSource':source,'testedTree':tree,'base':BASE,'basePlatform':'linux/amd64','baseConfigId':inspect['Id'],'imageConfigId':'sha256:'+cfgid,'canonicalUncompressedOciManifestDigest':'sha256:'+digest(ocibytes),'registryDigest':None,'layerDigests':descriptors,'sourceLayerDigest':diff,'dockerArchiveSha256':digest(image.read_bytes()),'sourceManifestSha256':digest(canonical(files)),'files':files,'scan':{'allOwnFilesScanned':len(files),'privateKeyMarkers':0,'serviceAccountJson':0,'keyDatabaseLedgerFiles':0,'customerDataRootsIncluded':False,'rootPolicy':ROOTS+['fresh-lockfile-node_modules'],'scope':'OWN_APPLICATION_LAYER_AND_CONFIG; base separately pinned public Node image, not a forensic audit of every upstream byte'},'recipeVersion':1}
        (out/'artifact.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['files','layerDigests']}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--repo',required=True);p.add_argument('--source',required=True);p.add_argument('--out',required=True);p.add_argument('--cache',required=True);p.add_argument('--base-archive',required=True);a=p.parse_args()
    assert re.fullmatch('[a-f0-9]{40}',a.source),'exact commit required'
    build(a.repo,a.source,a.out,a.cache,pathlib.Path(a.base_archive))
