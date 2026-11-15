"""Local negative tests. Synthetic reports are test fixtures, never scan evidence."""
import copy
import datetime as dt
import hashlib
import importlib.util
import io
import json
import pathlib
import subprocess
import sys
import tarfile
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
PROOF = HERE.parent


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


builder = load('pc1_builder_test', PROOF / 'readiness/build-image.py')
gate = load('pc1_gate_test', HERE / 'security_gate.py')
operator = load('pc1_operator_test', HERE / 'operator/windows-wsl2/operator_checks.py')


def fixture():
    policy = json.loads((HERE / 'image-policy.json').read_text())
    now = dt.datetime.fromisoformat(policy['reviewedAt'].replace('Z','+00:00')) + dt.timedelta(minutes=1)
    at = now.isoformat()
    artifact = {'base':policy['base'],'baseConfigId':policy['baseConfigId'],'imageConfigId':'sha256:'+'a'*64,
                'layerDigests':[{'digest':'sha256:'+'b'*64}]}
    lock = json.loads((PROOF / 'package-lock.json').read_text())
    expected = {k.removeprefix('node_modules/'):v['version'] for k,v in lock['packages'].items() if k}
    expected[lock['packages']['']['name']] = lock['packages']['']['version']
    os_packages = [{'ID':n+'@1','Name':n,'Version':'1','Identifier':{'PURL':'pkg:deb/debian/'+n+'@1'},
                    'InstalledFiles':['/usr/lib/libc.so.6'] if i==0 else []}
                   for i,n in enumerate(['libc6']+['test-package-'+str(i) for i in range(13)])]
    app_packages = [{'ID':n+'@'+v,'Name':n,'Version':v,'Identifier':{'PURL':'pkg:npm/'+n+'@'+v}}
                    for n,v in expected.items()]
    scan = {'SchemaVersion':2,'Trivy':{'Version':policy['scannerVersion']},'ArtifactType':'container_image',
            'Metadata':{'ImageID':artifact['imageConfigId'],'DiffIDs':['sha256:'+'b'*64],
                        'OS':{'Family':'debian','Name':policy['debianVersion']}},
            'Results':[{'Type':'debian','Packages':os_packages},{'Type':'node-pkg','Packages':app_packages}]}
    sbom = {'bomFormat':'CycloneDX','specVersion':'1.7','metadata':{'component':{'properties':[
        {'name':'aquasecurity:trivy:ImageID','value':artifact['imageConfigId']},
        {'name':'aquasecurity:trivy:DiffID','value':'sha256:'+'b'*64}]}},
        'components':[{'purl':p['Identifier']['PURL']} for p in os_packages+app_packages]}
    probe = {'node':'v'+policy['nodeVersion'],'nodeSha256':policy['nodeBinarySha256'],
             'versions':{'openssl':policy['openSSLVersion']},'sharedOpenSSL':False,'uid':1000,'gid':1000,
             'debian':policy['debianVersion'],'tooling':[{'present':False} for _ in range(20)],
             'loadedFiles':[{'path':'/nodejs/bin/node','sha256':policy['nodeBinarySha256']},
                            {'path':'/usr/lib/libc.so.6','sha256':'c'*64}]}
    receipt = {'scannerVersion':policy['scannerVersion'],'scannerBinarySha256':policy['scannerBinarySha256'],
               'scanExitCode':0,'sbomExitCode':0,'integrityVerified':True,'databaseRepository':policy['databaseRepository'],
               'databaseSha256':'d'*64,'databaseMetadata':{'Version':2,'UpdatedAt':at,'DownloadedAt':at,
               'NextUpdate':(now+dt.timedelta(hours=1)).isoformat()},'scanStartedAt':at,'scanFinishedAt':at,
               'expectedApplicationPackages':expected,'nativeAddonPaths':[], 'loadedFileAttribution':[
                   {'path':f['path'],'sha256':f['sha256'],'archiveSha256':f['sha256'],
                    'package':'OFFICIAL_NODE_BINARY' if i==0 else 'libc6'} for i,f in enumerate(probe['loadedFiles'])]}
    return [policy,artifact,scan,sbom,probe,receipt,now]


def severe(data, kind=0, fixed=True):
    pkg = data[2]['Results'][kind]['Packages'][0]
    data[2]['Results'][kind]['Vulnerabilities'] = [{'VulnerabilityID':'CVE-SYNTHETIC-TEST',
        'PkgID':pkg['ID'],'PkgName':pkg['Name'],'InstalledVersion':pkg['Version'],
        'PkgIdentifier':pkg['Identifier'],'Severity':'HIGH','FixedVersion':'2' if fixed else '', 'Status':'affected'}]


class BuildValidation(unittest.TestCase):
    def test_valid_runtime_file(self):
        builder.validate_file('b1a2/runtime/synthetic.mjs',b'export const x = 1;')

    def test_private_key_headers_normal_and_optimized(self):
        for optimize in [[],['-O'],['-OO']]:
            for kind in ['', 'RSA ', 'EC ', 'OPENSSH ', 'ENCRYPTED ', 'DSA ', 'FOO42 ', 'X509 ']:
                with self.subTest(optimize=optimize,kind=kind):
                    code = "import runpy; m=runpy.run_path("+repr(str(PROOF/'readiness/build-image.py'))+"); m['validate_file']('src/x.mjs',"+repr(('-----BEGIN '+kind+'PRIVATE KEY-----').encode())+")"
                    result = subprocess.run([sys.executable,'-I',*optimize,'-c',code],capture_output=True,text=True)
                    self.assertNotEqual(result.returncode,0)
                    self.assertIn('private_key_marker',result.stderr)

    def test_cli_rejects_optimization_before_any_action(self):
        for optimize in ['-O','-OO']:
            result = subprocess.run([sys.executable,'-I',optimize,str(PROOF/'readiness/build-image.py'),'--help'],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('optimized_python_prohibited',result.stderr)

    def test_no_security_asserts(self):
        import ast
        for name in [PROOF/'readiness/build-image.py',HERE/'scan-image.py',HERE/'security_gate.py']:
            self.assertFalse(any(isinstance(n,ast.Assert) for n in ast.walk(ast.parse(name.read_text()))),str(name))

    def test_bad_roots_paths_data_and_symlinks(self):
        for name,data,regular in [('src/../secret',b'',True),('/src/x',b'',True),('src//x',b'',True),
             ('test/key.mjs',b'',True),('src/a.KEY',b'',True),('src/a.db',b'',True),('src/link',b'',False),
             ('src/x.mjs',b'{"type":"service_account"}',True)]:
            with self.subTest(name=name):
                with self.assertRaises(ValueError): builder.validate_file(name,data,regular)

    def test_lockfile_integrity_and_origin(self):
        lock = json.loads((PROOF/'package-lock.json').read_text())
        builder.validate_lock(lock)
        path = next(k for k in lock['packages'] if k)
        for field,value in [('integrity','sha512-AA=='),('resolved','https://example.com/pkg.tgz'),('hasInstallScript',True),('link',True)]:
            d = copy.deepcopy(lock);d['packages'][path][field]=value
            with self.assertRaises(ValueError): builder.validate_lock(d)

    def test_archive_configuration_and_layer_integrity(self):
        data = b'not-a-real-layer'; config = {'os':'linux','architecture':'amd64','rootfs':{'diff_ids':['sha256:'+builder.digest(data)]}}
        cfg = builder.canonical(config)
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory)/'base.tar'
            def write(layer):
                with tarfile.open(path,'w') as t:
                    builder.member(t,'manifest.json',builder.canonical([{'Config':'config.json','Layers':['layer.tar']}]))
                    builder.member(t,'config.json',cfg);builder.member(t,'layer.tar',layer)
            write(data)
            builder.base_inputs(path,'sha256:'+builder.digest(cfg))
            with self.assertRaisesRegex(ValueError,'base_config_identity_mismatch'): builder.base_inputs(path,'sha256:'+'0'*64)
            write(b'corrupted')
            with self.assertRaisesRegex(ValueError,'base_layer_digest_mismatch'): builder.base_inputs(path,'sha256:'+builder.digest(cfg))

    def test_explicit_commit_and_output_scope_validation(self):
        with self.assertRaisesRegex(ValueError,'exact_commit_required'): builder.assemble('.', 'HEAD', '/tmp/x', '', pathlib.Path('/tmp/x'))
        with self.assertRaisesRegex(ValueError,'owned_tmp_output_required'): builder.assemble('.', 'a'*40, '/tmp/unowned', '', pathlib.Path('/tmp/x'))


class VulnerabilityGate(unittest.TestCase):
    def test_valid_complete_scan_is_only_local_candidate(self):
        result = gate.evaluate(*fixture())
        self.assertEqual(result['verdict'],'PASS_LOCAL_PENDING_INDEPENDENT_REVIEW',result)
        self.assertIs(result['productionOrCloudAuthorization'],False)

    def test_scanner_success_with_fixable_high_is_hold(self):
        data=fixture();severe(data)
        result=gate.evaluate(*data)
        self.assertEqual(result['verdict'],'HOLD');self.assertEqual(result['fixableCriticalHigh'],1)
        self.assertTrue(any('fixable_severe' in x for x in result['reasons']))

    def test_nonfixable_runtime_and_application_severe_are_hold(self):
        for kind in [0,1]:
            data=fixture();severe(data,kind,False)
            self.assertEqual(gate.evaluate(*data)['verdict'],'HOLD')

    def test_zero_cve_scan_does_not_hide_old_node(self):
        data=fixture();data[4]['node']='v24.19.0'
        self.assertIn('node_below_explicit_security_floor',gate.evaluate(*data)['reasons'][0])

    def test_debian_epoch_release_and_purl_are_bound_without_dropping_findings(self):
        data=fixture();pkg=data[2]['Results'][0]['Packages'][0]
        old=pkg['Identifier']['PURL'];pkg.update(Version='2.41',Release='12+deb13u4',Epoch=1)
        pkg['ID']='libc6@1:2.41-12+deb13u4';pkg['Identifier']['PURL']='pkg:deb/debian/libc6@1%3A2.41-12%2Bdeb13u4'
        for c in data[3]['components']:
            if c['purl']==old:c['purl']=pkg['Identifier']['PURL']
        severe(data);finding=data[2]['Results'][0]['Vulnerabilities'][0]
        finding.update(InstalledVersion='1:2.41-12+deb13u4',Severity='MEDIUM')
        result=gate.evaluate(*data);self.assertEqual(result['verdict'],'PASS_LOCAL_PENDING_INDEPENDENT_REVIEW',result)
        self.assertEqual(result['vulnerabilityCounts'],{'MEDIUM':1})
        self.assertEqual(gate.purl_version('pkg:deb/debian/libc6@2.41-12%2Bdeb13u4?epoch=1'),'1:2.41-12+deb13u4')
        with self.assertRaises(ValueError):gate.purl_version('pkg:deb/debian/libc6@1%3A2.41?epoch=1')
        finding['Severity']='HIGH';self.assertEqual(gate.evaluate(*data)['verdict'],'HOLD')
        finding['InstalledVersion']='2.41';self.assertIn('finding_attribution_mismatch',gate.evaluate(*data)['reasons'][0])

    def test_missing_corrupt_stale_or_untrusted_evidence_fails_closed(self):
        mutations = [
            lambda d:d[5].update(scanExitCode=1), lambda d:d[5].update(sbomExitCode=1),
            lambda d:d[5].update(integrityVerified=False), lambda d:d[5].update(databaseSha256=''),
            lambda d:d[5].update(scannerBinarySha256='0'*64),lambda d:d[5].update(scannerVersion='0.1'),
            lambda d:d[5].update(databaseRepository='untrusted'),
            lambda d:d[5]['databaseMetadata'].update(UpdatedAt='2026-01-01T00:00:00Z'),
            lambda d:d[5]['databaseMetadata'].update(DownloadedAt='2099-01-01T00:00:00Z'),
            lambda d:d[5]['databaseMetadata'].update(NextUpdate=d[6].isoformat()),
            lambda d:d[0].update(reviewedAt='2026-01-01T00:00:00Z'),
            lambda d:d[0].update(reviewedAt='2099-01-01T00:00:00Z'),
            lambda d:d[0].update(exceptions=[{'CVE':'SYNTHETIC','expires':'2099-01-01'}]),
            lambda d:d[2]['Metadata'].update(ImageID='wrong'),lambda d:d[2]['Metadata'].update(DiffIDs=[]),
            lambda d:d[2]['Metadata'].update(OS={}), lambda d:d[2].update(Results=[]),
            lambda d:d[3].update(components=[]),lambda d:d[3]['metadata']['component'].update(properties=[]),
            lambda d:d[4].update(nodeSha256='wrong'),lambda d:d[4]['versions'].update(openssl='old'),
            lambda d:d[4].update(uid=0),lambda d:d[4]['tooling'][0].update(present=True),
            lambda d:d[5].update(loadedFileAttribution=[]),
            lambda d:d[5]['loadedFileAttribution'][1].update(archiveSha256='wrong'),
            lambda d:d[5]['loadedFileAttribution'][1].update(package='unknown'),
            lambda d:d[5].update(expectedApplicationPackages={}),lambda d:d[5].update(nativeAddonPaths=['/proof/x.node']),
            lambda d:d[1].update(imageConfigId=d[0]['permanentlyDeniedImageIds'][0]),
        ]
        for i,mutation in enumerate(mutations):
            with self.subTest(counterexample=i):
                data=fixture();mutation(data);self.assertEqual(gate.evaluate(*data)['verdict'],'HOLD')

    def test_finding_cannot_omit_or_forge_attribution(self):
        for field,value in [('PkgID','unknown'),('PkgName','wrong'),('InstalledVersion','wrong'),('Severity','PASS')]:
            data=fixture();severe(data);data[2]['Results'][0]['Vulnerabilities'][0][field]=value
            self.assertEqual(gate.evaluate(*data)['verdict'],'HOLD')


class OperatorAndFailureEvidence(unittest.TestCase):
    def test_missing_windows_receipt_cannot_be_complete(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);path=root/'host.json';path.write_text('{}')
            with self.assertRaisesRegex(ValueError,'windows_host_receipt'):operator.host(path,root/'out.json')

    def test_restricted_powershell_receipt_is_valid_without_policy_change(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory);path=root/'host.json'
            v={'windowsCaption':'Windows 11 Pro','os64Bit':True,'windowsVersion':'10.0','windowsBuild':'test',
               'selectedDistro':'Ubuntu-test','wslVersion':'UNIT TEST','dockerDesktopVersion':'UNIT TEST',
               'operatorMachineLabel':'SYNTHETIC_UNIT_TEST_NOT_HOST_EVIDENCE','capturedAtUtc':dt.datetime.now(dt.timezone.utc).isoformat(),
               'selectedDockerImageStore':'classic','captureMethod':'INTERACTIVE_POWERSHELL_NO_POLICY_CHANGE',
               'executionPolicy':[{'Scope':'LocalMachine','ExecutionPolicy':'Restricted'}]}
            path.write_text(json.dumps(v),encoding='utf-8-sig');operator.host(path,root/'out.json')
            self.assertEqual(json.loads((root/'out.json').read_text())['executionPolicy'],v['executionPolicy'])
            v['selectedDockerImageStore']='unknown';path.write_text(json.dumps(v))
            with self.assertRaisesRegex(ValueError,'docker_store_choice'):operator.host(path,root/'wrong.json')

    def test_incomplete_scan_keeps_hold_and_raw_diagnostics(self):
        with tempfile.TemporaryDirectory(prefix='nukmiris-pc1-negative-') as directory:
            result=subprocess.run([sys.executable,'-I',str(HERE/'scan-image.py'),'--build',directory,
                '--repo',str(PROOF.parent),'--trivy','/nonexistent','--trivy-cache','/nonexistent'],capture_output=True,text=True)
            self.assertEqual(result.returncode,1)
            report=json.loads((pathlib.Path(directory)/'security/security-evaluation.json').read_text())
            self.assertEqual(report['verdict'],'HOLD')
            self.assertTrue((pathlib.Path(directory)/'security/scan-receipt.json').is_file())

    def test_checksums_and_failure_package_support_unicode_and_spaces(self):
        with tempfile.TemporaryDirectory(prefix='nukmiris-pc1-espacio-ñ-') as directory:
            root=pathlib.Path(directory);results=root/'results';results.mkdir()
            data=root/'original bytes.bin';data.write_bytes(b'synthetic bytes only')
            checksum=operator.sha(data);sums=root/'checksums.txt';sums.write_text(checksum+'  original bytes.bin\n')
            # Official downloadable filenames contain no spaces; result paths may.
            official=root/'archive.tar';official.write_bytes(data.read_bytes());sums.write_text(checksum+'  archive.tar\n')
            operator.checksum(official,'archive.tar',sums,checksum)
            (results/'failed-scan.json').write_text('{"finding":"PRESERVE_UNIT_TEST"}')
            operator.package(root,'synthetic-failure',1)
            summary=json.loads((results/'summary.json').read_text())
            self.assertEqual(summary['status'],'INCOMPLETE_HOLD_PRESERVE_FINDINGS')
            self.assertTrue((results/'failed-scan.json').exists())
            import zipfile
            archive=next(root.glob('*-results.zip'))
            with zipfile.ZipFile(archive) as z:self.assertIn('results/failed-scan.json',z.namelist())


if __name__=='__main__':
    unittest.main(verbosity=2)
