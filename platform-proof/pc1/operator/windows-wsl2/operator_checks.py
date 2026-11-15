"""Independent operator inspections; never copied into the image. No uploads."""
import datetime as dt
import hashlib
import importlib.util
import json
import pathlib
import re
import shutil
import subprocess
import sys
import zipfile


def need(ok, message):
    if not ok:
        raise ValueError(message)


def sha(path):
    h=hashlib.sha256()
    with pathlib.Path(path).open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):
            h.update(block)
    return h.hexdigest()


def save(path, value):
    pathlib.Path(path).write_text(json.dumps(value,indent=2)+'\n')


def reference(kit):
    value=json.loads((pathlib.Path(kit)/'reference.json').read_text())
    need(re.fullmatch('[a-f0-9]{40}',value['source']) and re.fullmatch('[a-f0-9]{40}',value['tree']), 'missing_exact_pc1_reference')
    need(value['imageConfigId'] != 'sha256:1931766e764e9b400e3781796fa416421dda01fc992d69c4933295f29c30f888', 'historical_image_permanently_local_test_only')
    return value


def host(path, destination):
    v=json.loads(pathlib.Path(path).read_text(encoding='utf-8-sig'))
    need('Windows 11' in v.get('windowsCaption','') and v.get('os64Bit') is True,'windows_host_receipt_missing_or_wrong_os')
    for field in ['windowsVersion','windowsBuild','selectedDistro','wslVersion','dockerDesktopVersion','operatorMachineLabel','capturedAtUtc']:
        need(isinstance(v.get(field),str) and v[field].strip() and 'UNATTESTED' not in v[field], 'incomplete_windows_receipt: '+field)
    need(v.get('selectedDockerImageStore') in ['classic','containerd'],'docker_store_choice_required')
    need(v.get('captureMethod') == 'INTERACTIVE_POWERSHELL_NO_POLICY_CHANGE', 'unsupported_host_receipt_capture')
    captured=dt.datetime.fromisoformat(v['capturedAtUtc'].replace('Z','+00:00'))
    need(captured.tzinfo is not None and 0 <= (dt.datetime.now(dt.timezone.utc)-captured).total_seconds() <= 86400,'host_receipt_stale_or_future')
    allowed=['windowsCaption','windowsVersion','windowsBuild','os64Bit','selectedDistro','wslVersion',
             'dockerDesktopVersion','operatorMachineLabel','capturedAtUtc','selectedDockerImageStore','executionPolicy','captureMethod']
    save(destination,{k:v.get(k) for k in allowed})


def source(repo, kit, results):
    repo,results=pathlib.Path(repo),pathlib.Path(results)
    ref=reference(kit)
    git=lambda *a:subprocess.check_output(['git','-C',str(repo),*a])
    need(git('rev-parse','HEAD').decode().strip()==ref['source'],'source_commit_mismatch')
    need(git('rev-parse','HEAD^{tree}').decode().strip()==ref['tree'],'source_tree_mismatch')
    need(not git('diff','HEAD','--name-only').strip(),'tracked_source_modified')
    need(not git('ls-files','--others','--exclude-standard').strip(),'untracked_source_files')
    lock=json.loads((repo/'platform-proof/package-lock.json').read_text())
    need(len(lock['packages'])==15,'dependency_inventory_changed')
    save(results/'source-integrity.json',{'status':'PASS','source':ref['source'],'tree':ref['tree'],
         'lockfileSha256':sha(repo/'platform-proof/package-lock.json'),'builderSha256':sha(repo/'platform-proof/readiness/build-image.py'),
         'provenance':'UNSIGNED_LOCAL_OPERATOR_RECORD_NOT_SLSA_ATTESTATION'})


def check_build(repo, kit, run):
    repo,run=pathlib.Path(repo),pathlib.Path(run)
    ref=reference(kit);results=run/'results';rows=[]
    spec=importlib.util.spec_from_file_location('pc1_operator_archive_inspection',repo/'platform-proof/pc1/scan-image.py')
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    for label in ['a','b']:
        build=run/('build-'+label)
        artifact=json.loads((build/'artifact.json').read_text())
        need(artifact['testedSource']==ref['source'] and artifact['testedTree']==ref['tree'],'build_source_mismatch')
        comparisons={}
        for key,filename,prefix in [('sourceLayerDigest','source-layer.tar','sha256:'),('imageConfigId','config.json','sha256:'),
                 ('canonicalUncompressedOciManifestDigest','oci-manifest.json','sha256:'),('dockerArchiveSha256','candidate.docker.tar','')]:
            actual=prefix+sha(build/filename)
            comparisons[key]={'actual':actual,'expected':ref[key],'match':actual==ref[key]}
            save(results/'digest-comparison.json',{'status':'CHECKING_OR_STOPPED','builds':rows+[{'build':label,'comparisons':comparisons}]})
            need(actual==ref[key]==artifact[key],'digest_mismatch: '+label+'/'+key)
        module.verify_archive(build,artifact)
        security=json.loads((build/'security/security-evaluation.json').read_text())
        need(security['verdict']=='PASS_LOCAL_PENDING_INDEPENDENT_REVIEW','mandatory_security_gate_not_passed')
        target=results/('build-'+label);target.mkdir(exist_ok=True)
        for name in ['artifact.json','config.json','oci-manifest.json','npm-ci.log']:
            shutil.copyfile(build/name,target/name)
        shutil.copytree(build/'security',target/'security',dirs_exist_ok=True)
        rows.append({'build':label,'comparisons':comparisons,'gate':security['verdict']})
    need((run/'build-a/artifact.json').read_bytes()==(run/'build-b/artifact.json').read_bytes(),'two_build_manifests_differ')
    save(results/'digest-comparison.json',{'status':'PASS_LOCAL_SECOND_HOST_REVIEW_PENDING','builds':rows,
         'registryDigest':None,'freshIndependentNpmInstalls':2,'imageArchivesIncluded':False})


def checksum(archive, name, checksums, pinned):
    matches=[line.split()[0] for line in pathlib.Path(checksums).read_text().splitlines()
             if len(line.split())==2 and line.split()[1].lstrip('*')==name]
    need(len(matches)==1 and matches[0]==pinned==sha(archive),'upstream_or_policy_checksum_mismatch')
    print(json.dumps({'file':name,'sha256':pinned,'verification':'pinned checksum and official HTTPS checksum; no signed publisher attestation claimed'}))


def smoke(repo, logdir):
    # Preserve and reuse the accepted detailed verdict checks, not its old build hashes.
    path=pathlib.Path(repo)/'platform-proof/readiness/operator/windows-wsl2/operator_checks.py'
    spec=importlib.util.spec_from_file_location('accepted_smoke_verdict_checks',path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    module.smoke(pathlib.Path(logdir))


def package(run, stage, rc):
    run=pathlib.Path(run);results=run/'results';results.mkdir(exist_ok=True)
    # Only explicit non-secret output trees enter the package. Never include
    # home, npm cache, TLS fixture folders, image archives or credential configs.
    for label in ['a','b']:
        build=run/('build-'+label)
        if not build.exists():continue
        target=results/('build-'+label);target.mkdir(exist_ok=True)
        for name in ['artifact.json','config.json','oci-manifest.json','npm-ci.log']:
            if (build/name).exists():shutil.copyfile(build/name,target/name)
        if (build/'security').exists():shutil.copytree(build/'security',target/'security',dirs_exist_ok=True)
    def read(name):
        try:return json.loads((results/name).read_text())
        except (OSError,ValueError):return {'status':'NOT_EXECUTED_OR_INCOMPLETE'}
    summary={'procedure':'PC1_SECOND_MACHINE_HARDENED_CANDIDATE','lastStage':stage,'exitCode':rc,
             'status':'COMPLETE_REVIEW_PENDING' if rc==0 else 'INCOMPLETE_HOLD_PRESERVE_FINDINGS',
             'windowsHostReceipt':read('windows-host.json'),'sourceIntegrity':read('source-integrity.json'),
             'digestComparison':read('digest-comparison.json'),'cloudRegistryOrProviderActivation':False,
             'independentAcceptance':'PENDING_OWNER_AND_CLAUDE','provenance':'UNSIGNED_OPERATOR_RECORD_NOT_SLSA',
             'hostIndependence':'operator attestation and host receipt; not cryptographic remote attestation'}
    save(results/'summary.json',summary)
    save(results/'provenance.json',{'type':'UNSIGNED_LOCAL_BUILD_RECORD','summary':summary,
         'securityReceipts':['build-a/security/scan-receipt.json','build-b/security/scan-receipt.json'],
         'commands':'commands.jsonl','registryDigest':None,'signingCredentialsGenerated':False})
    files=sorted(p for p in results.rglob('*') if p.is_file() and p.name!='SHA256SUMS.txt')
    need(all(not p.is_symlink() for p in files),'package_symlink_denied')
    (results/'SHA256SUMS.txt').write_text(''.join(sha(p)+'  '+p.relative_to(results).as_posix()+'\n' for p in files))
    archive=run/(run.name+'-results.zip')
    with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED) as z:
        for p in sorted(results.rglob('*')):
            if p.is_file():z.write(p,'results/'+p.relative_to(results).as_posix())
    archive.with_suffix('.zip.sha256').write_text(sha(archive)+'  '+archive.name+'\n')
    print(json.dumps({'resultsArchive':str(archive),'sha256':sha(archive),'status':summary['status']}))


if __name__=='__main__':
    need(sys.flags.optimize==0 and __debug__,'optimized_python_prohibited')
    mode,*args=sys.argv[1:]
    if mode=='pins':
        v=reference(args[0]);print(v['source']);print(v['imageConfigId']);print(v['base'])
    elif mode=='host':host(*args)
    elif mode=='source':source(*args)
    elif mode=='build':check_build(*args)
    elif mode=='checksum':checksum(*args)
    elif mode=='smoke':smoke(*args)
    elif mode=='package':package(args[0],args[1],int(args[2]))
    elif mode=='record':
        path,label,start,end,rc,*argv=args
        with pathlib.Path(path).open('a') as f:f.write(json.dumps({'stage':label,'startedAt':start,'endedAt':end,'exitCode':int(rc),'argv':argv})+'\n')
    else:raise ValueError('unknown_mode')
