"""Operator-side inspection only. Never imported by or copied into the image."""
import argparse,collections,datetime,hashlib,io,json,pathlib,re,subprocess,sys,tarfile,zipfile
SOURCE='9b526c048d5df1b3fbcf03e8f33c3ba53979b492'
TREE='74801a03193011c24385d6ff36fb60178d61f107'
EVIDENCE='d6dc74b6efa2c103a83f188465d8e426502822d7'
EVIDENCE_TREE='71e654fa01161e4a88f1dbb67ef5ae157a11a395'
EXPECTED={'sourceLayerDigest':'sha256:6b18c59d7cf8ea39b77cd5a7f46e87656dd87326009e8900b94604cf7c297ed3','imageConfigId':'sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888','canonicalUncompressedOciManifestDigest':'sha256:2f4f4b87448651dc8aef36de244771c33c96edf421983e066ef2375fd4713e80','dockerArchiveSha256':'21679e621c173331df503c9ce7326457884a596955e18869502fdf58c0ab8484','sourceManifestSha256':'aed8880aad1c9d25b8718cb7ed7f7080229836c4e082ebab2f5225df91d511a4'}
def need(ok,message):
    if not ok:raise RuntimeError(message)
def sha(b):return hashlib.sha256(b).hexdigest()
def file_sha(p):
    h=hashlib.sha256()
    with pathlib.Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
    return h.hexdigest()
def save(p,v):pathlib.Path(p).write_text(json.dumps(v,indent=2)+'\n',encoding='utf-8')
def git(repo,*args):return subprocess.check_output(['git','-C',str(repo),*args])
def original(repo,results):
    need(git(repo,'rev-parse','HEAD').decode().strip()==SOURCE,'wrong detached source commit')
    need(git(repo,'rev-parse',SOURCE+'^{tree}').decode().strip()==TREE,'source tree mismatch')
    need(git(repo,'rev-parse',EVIDENCE+'^{tree}').decode().strip()==EVIDENCE_TREE,'reference evidence tree mismatch')
    need(not git(repo,'diff','HEAD','--name-only').strip(),'tracked source modified')
    need(not git(repo,'ls-files','--others','--exclude-standard').strip(),'untracked source files present')
    prefix='platform-proof/readiness/evidence/'
    for name in ['image/artifact.json','image/reassembly.json','source-publication.json','environment.json']:
        p=results/'reference'/pathlib.Path(name).name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(git(repo,'show',EVIDENCE+':'+prefix+name))
    a=json.loads((results/'reference/artifact.json').read_text())
    for k,v in EXPECTED.items():need(a[k]==v,'published reference conflicts with fixed '+k)
    pub=json.loads((results/'reference/source-publication.json').read_text())
    for row in pub['files']:
        data=(repo/row['path']).read_bytes();need(sha(data)==row['sha256'],'source byte mismatch '+row['path']);need(git(repo,'rev-parse',SOURCE+':'+row['path']).decode().strip()==row['gitBlobId'],'source Git blob mismatch')
    own=[r for r in a['files'] if r['origin']==SOURCE];need(len(own)==47,'wrong reference own-source count')
    for r in own:need(sha((repo/'platform-proof'/r['path']).read_bytes())==r['sha256'],'own runtime source mismatch '+r['path'])
    lock=json.loads((repo/'platform-proof/package-lock.json').read_text());deps=[]
    for path,v in lock['packages'].items():
        if not path:continue
        need(v.get('resolved','').startswith('https://registry.npmjs.org/'),'nonpublic dependency origin')
        need(v.get('integrity','').startswith('sha512-'),'lockfile SRI absent')
        deps.append({'path':path,'version':v['version'],'resolved':v['resolved'],'integrity':v['integrity']})
    need(len(deps)==14,'unexpected dependency set');save(results/'lockfile-sri.json',deps)
    save(results/'source-integrity.json',{'status':'PASS','source':SOURCE,'tree':TREE,'evidence':EVIDENCE,'evidenceTree':EVIDENCE_TREE,'changedSourceFilesChecked':len(pub['files']),'ownRuntimeFilesChecked':len(own),'lockfileSha256':file_sha(repo/'platform-proof/package-lock.json'),'f2AcceptedSourceUnmodified':True,'builderGitBlobId':git(repo,'rev-parse',SOURCE+':platform-proof/readiness/build-image.py').decode().strip(),'builderSha256':file_sha(repo/'platform-proof/readiness/build-image.py'),'baseImage':a['base']})
def check_archive(archive,name,checksums):
    matches=[]
    for line in pathlib.Path(checksums).read_text().splitlines():
        cols=line.split()
        if len(cols)==2 and cols[1].lstrip('*')==name:matches.append(cols[0])
    need(len(matches)==1 and re.fullmatch('[a-f0-9]{64}',matches[0]),'missing or ambiguous upstream checksum')
    need(file_sha(archive)==matches[0],'upstream archive checksum mismatch')
    print(json.dumps({'file':name,'sha256':matches[0],'verification':'official HTTPS checksum; not independent signed publisher attestation'}))
def check_build(repo,a_path,b_path,results):
    ref=json.loads((results/'reference/artifact.json').read_text());reports=[]
    keypat=re.compile(rb'-----BEGIN [A-Z ]*PRIVATE KEY-----')
    deny=re.compile(r'\.(?:pem|key|p12|pfx|sqlite|db|jsonl)$')
    for label,path in [('a',a_path),('b',b_path)]:
        
        for filename in ['artifact.json','config.json','oci-manifest.json','npm-ci.log']:
            if (path/filename).is_file():
                (results/('build-'+label)).mkdir(exist_ok=True);(results/('build-'+label)/filename).write_bytes((path/filename).read_bytes())
        a=json.loads((path/'artifact.json').read_text());need(a['testedSource']==SOURCE and a['testedTree']==TREE,'build source pin mismatch')
        checks={}
        for k,filename in [('sourceLayerDigest','source-layer.tar'),('imageConfigId','config.json'),('canonicalUncompressedOciManifestDigest','oci-manifest.json'),('dockerArchiveSha256','candidate.docker.tar')]:
            measured=file_sha(path/filename);measured=('sha256:'+measured) if k!='dockerArchiveSha256' else measured
            checks[k]={'actual':measured,'expected':EXPECTED[k],'match':measured==EXPECTED[k]}
            save(results/'digest-comparison.json',{'status':'CHECKING_OR_STOPPED','source':SOURCE,'tree':TREE,'results':reports+[{'build':label,'digests':checks}]})
            need(measured==EXPECTED[k],'digest mismatch '+label+' '+k+' actual='+measured+' expected='+EXPECTED[k])
        need(a['files']==ref['files'],'source/dependency file manifest mismatch '+label)
        need(a['layerDigests']==ref['layerDigests'],'upstream/own layer descriptor mismatch '+label)
        need(a['sourceManifestSha256']==EXPECTED['sourceManifestSha256'],'manifest digest mismatch')
        expected={r['path']:r for r in ref['files']};seen=set();findings=[]
        with tarfile.open(path/'source-layer.tar') as t:
            for m in t:
                need(m.isfile() and not m.issym() and not m.islnk(),'unexpected source-layer entry type')
                need(m.name.startswith('proof/') and '..' not in pathlib.PurePosixPath(m.name).parts,'unsafe source-layer path')
                name=m.name.removeprefix('proof/');need(name in expected and name not in seen,'unknown or duplicate source-layer path');seen.add(name)
                row=expected[name];data=t.extractfile(m).read();need(len(data)==row['bytes'] and sha(data)==row['sha256'],'file hash mismatch '+name)
                need(m.uid==1000 and m.gid==1000 and m.mtime==0 and oct(m.mode)==row['mode'],'metadata mismatch '+name)
                if keypat.search(data):findings.append({'path':name,'finding':'PRIVATE_KEY_HEADER','sha256':sha(data)})
                if re.search(rb'"type"\s*:\s*"service_account"',data):findings.append({'path':name,'finding':'SERVICE_ACCOUNT_JSON','sha256':sha(data)})
                if deny.search(name):findings.append({'path':name,'finding':'KEY_OR_DATA_FILENAME','sha256':sha(data)})
        save(results/('independent-own-layer-scan-'+label+'.json'),{'filesChecked':len(seen),'scope':'all own-layer files; upstream base separately pinned','pattern':'-----BEGIN [A-Z ]*PRIVATE KEY-----','assertStatementsUsed':False,'findings':findings})
        need(len(seen)==188 and not findings,'unexpected own-layer contents or secret/data finding')
        cfg=json.loads((path/'config.json').read_text());oci=json.loads((path/'oci-manifest.json').read_text())
        need(cfg['config']['User']=='node' and cfg['config']['Entrypoint']==['node','b1a2/runtime/entrypoint.mjs'],'non-inert image configuration')
        need('B1A2_MODE=INERT_UNCONFIGURED' in cfg['config']['Env'] and cfg['config']['Labels']['nukmiris.source']==SOURCE,'image startup/source label mismatch')
        with tarfile.open(path/'candidate.docker.tar') as t:
            manifest=json.load(t.extractfile('manifest.json'));need(len(manifest)==1,'unexpected image count')
            entry=manifest[0];need(sha(t.extractfile(entry['Config']).read())==EXPECTED['imageConfigId'][7:],'Docker config bytes differ')
            need(len(entry['Layers'])==len(oci['layers']),'Docker layer count mismatch')
            for name,descriptor,diff_id in zip(entry['Layers'],oci['layers'],cfg['rootfs']['diff_ids']):
                data=t.extractfile(name).read();need('sha256:'+sha(data)==descriptor['digest']==diff_id and len(data)==descriptor['size'],'Docker layer hash/size mismatch')
        for filename in ['artifact.json','config.json','oci-manifest.json','npm-ci.log']:
            (results/('build-'+label)).mkdir(exist_ok=True);(results/('build-'+label)/filename).write_bytes((path/filename).read_bytes())
        reports.append({'build':label,'status':'PASS','digests':checks,'ownFiles':188})
    save(results/'digest-comparison.json',{'status':'PASS','source':SOURCE,'tree':TREE,'sameHostRepeat':True,'secondHostAttestation':'operator must confirm this machine differs from Codex host','results':reports})
def smoke(logs):
    rows=[]
    for name in ['inert-smoke','startup-smoke','fake-smoke']:
        objects=[]
        for line in (logs/(name+'.log')).read_text().splitlines():
            try:v=json.loads(line)
            except ValueError:continue
            if isinstance(v,dict):objects.append(v)
        rows.append((name,objects))
    need(any(v.get('health')==200 and v.get('ready')==503 and v.get('liveActivationBlocked') is True for v in rows[0][1]),'missing inert smoke verdict')
    need(any(all(v.get(k) is True for k in ['missingIdentityRejected','copiedIdentityRejected','invalidEpochRejected','expiredSessionRejected','expiredIdentityRejected','missingSecretsRejected','revokedAuthorizationHeld']) for v in rows[1][1]),'missing startup negative verdict')
    need(any(v.get('syntheticEffects')==1 and v.get('nonRootUser')=='node' and all(v.get(k) is True for k in ['unknownIdentityRejected','unauthorizedSourceRejected','exportedLedgerVerified']) for v in rows[2][1]),'missing mTLS verdict')
    need(any(v.get('containerRemoved') is True and v.get('fixtureDirectoryRemoved') is True for v in rows[2][1]),'cleanup not proved')
    print(json.dumps({'status':'PASS','syntheticOnly':True,'packagedSqlRevocation':'readiness stub; no actual PostgreSQL test in this procedure'}))
def package(run,stage,rc):
    results=run/'results';results.mkdir(exist_ok=True);counts=collections.Counter();scan='NOT_EXECUTED'
    report=results/'vulnerabilities.json'
    if report.exists():
        try:
            v=json.loads(report.read_text())
            for r in v.get('Results',[]):
                for issue in r.get('Vulnerabilities') or []:counts[issue.get('Severity','UNKNOWN')]+=1
            scan='REPORT_GENERATED_REVIEW_REQUIRED'
        except (ValueError,TypeError):scan='INCOMPLETE_OR_INVALID_REPORT'
    db=[]
    for p in sorted((run/'trivy-cache').rglob('*')) if (run/'trivy-cache').exists() else []:
        if p.is_file() and p.name in ['trivy.db','metadata.json']:
            row={'path':str(p.relative_to(run)),'bytes':p.stat().st_size,'sha256':file_sha(p)}
            if p.name=='metadata.json':
                try:row['metadata']=json.loads(p.read_text())
                except ValueError:row['metadata']='INVALID_JSON'
            db.append(row)
    summary={'procedure':'ORIGINAL_ACCEPTED_SOURCE_SECOND_HOST_CHECK','source':SOURCE,'tree':TREE,'referenceEvidence':EVIDENCE,'lastStage':stage,'exitCode':rc,'completion':'LOCAL_CHECKS_COMPLETE_REVIEW_PENDING' if rc==0 else 'INCOMPLETE_STOP_REVIEW_REQUIRED','vulnerabilityScan':scan,'vulnerabilityCountsByFinding':dict(counts),'highCriticalFindings':counts['HIGH']+counts['CRITICAL'],'scanApproval':'NOT_GRANTED','databaseFiles':db,'registryDigest':None,'imageArchivesIncluded':False,'privateFixtureDirectoriesIncluded':False,'provenance':'unsigned operator-generated local record, not a SLSA attestation','cloudOrRegistryActivation':'NOT_AUTHORIZED','F2':'accepted recipe unchanged; Python -I without -O; separate explicit post-build inspection; hardening remains separate','independentAcceptance':'PENDING_CLAUDE_REVIEW'}
    save(results/'summary.json',summary)
    def read_report(name):
        p=results/name
        if not p.exists():return {'status':'NOT_EXECUTED'}
        try:return json.loads(p.read_text(encoding='utf-8-sig'))
        except ValueError:return {'status':'INVALID_OR_INCOMPLETE_JSON','sha256':file_sha(p)}
    provenance={'type':'UNSIGNED_OPERATOR_LOCAL_BUILD_RECORD_NOT_SLSA','sourceIntegrity':read_report('source-integrity.json'),'referenceEvidenceCommit':EVIDENCE,'digestComparison':read_report('digest-comparison.json'),'windowsHostReceipt':read_report('windows-host.json'),'linuxHostReceipt':read_report('preflight.json'),'toolchain':read_report('logs/exact-toolchain.log'),'scannerBinary':read_report('logs/scanner-checksum.log'),'scannerVersionReceipt':'logs/scanner-version.log','scannerDatabaseRepository':'ghcr.io/aquasecurity/trivy-db:2','scannerDatabaseFiles':db,'dependencyIntegrityReceipt':'lockfile-sri.json','commandsReceipt':'commands.jsonl','commandsSha256':file_sha(results/'commands.jsonl') if (results/'commands.jsonl').exists() else None,'operatorSecondHostClaim':'Self-reported MachineLabel; requires owner/Claude review, not a cryptographic host attestation','registryPush':False,'registryDigest':None,'sourceHardeningApplied':False,'publisherSignatureAssurance':'Tool downloads checked against their official HTTPS checksum files; no independent publisher attestation is claimed'}
    save(results/'provenance.json',provenance)
    paths=sorted(p for p in results.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt');need(all(not p.is_symlink() for p in paths),'refusing report symlink')
    (results/'SHA256SUMS.txt').write_text(''.join(file_sha(p)+'  '+p.relative_to(results).as_posix()+'\n' for p in paths),encoding='utf-8')
    archive=run/(run.name+'-results.zip')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(results.rglob('*')):
            if p.is_file():z.write(p,'results/'+p.relative_to(results).as_posix())
    archive.with_suffix('.zip.sha256').write_text(file_sha(archive)+'  '+archive.name+'\n')
    print(json.dumps({'resultsArchive':str(archive),'sha256':file_sha(archive),'summary':summary},indent=2))
def main():
    mode=sys.argv[1];args=sys.argv[2:]
    if mode=='source':original(pathlib.Path(args[0]),pathlib.Path(args[1]))
    elif mode=='checksum':check_archive(*args)
    elif mode=='build':check_build(*map(pathlib.Path,args))
    elif mode=='smoke':smoke(pathlib.Path(args[0]))
    elif mode=='record':
        path,label,started,ended,elapsed,rc,*argv=args
        with pathlib.Path(path).open('a') as f:f.write(json.dumps({'stage':label,'startedAtUtc':started,'endedAtUtc':ended,'elapsedSeconds':elapsed,'exitCode':int(rc),'argv':argv})+'\n')
    elif mode=='package':package(pathlib.Path(args[0]),args[1],int(args[2]))
    else:raise RuntimeError('unknown operator inspection mode')
if __name__=='__main__':main()
