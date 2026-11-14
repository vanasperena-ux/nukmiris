"""Verify an exported own source layer against the current checkout; audit keys."""
import json,tarfile,pathlib,hashlib,sys,re
p=pathlib.Path(sys.argv[1]);a=json.loads((p/'artifact.json').read_text());layer=p/('layer-'+a['layers'][-1]['digest'][7:]+'.tar');root=pathlib.Path(__file__).resolve().parents[2];verified=[];audited=[]
with tarfile.open(layer) as t:
 for e in t:
  if not e.isfile():continue
  assert e.name.startswith('proof/') and '..' not in pathlib.PurePosixPath(e.name).parts,e.name
  name=e.name.removeprefix('proof/');data=t.extractfile(e).read()
  assert not re.search(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',data),e.name
  audited.append({'path':name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data)})
  if name.startswith(('src/','b1a/runtime/','b1a2/runtime/')) or name in ['package.json','package-lock.json']:
   assert data==(root/name).read_bytes(),name;verified.append(name)
assert len(verified)>39
(p/'runtime-source-verification.json').write_text(json.dumps({'matchedSourceFiles':verified,'sourceLayerDigest':a['layers'][-1]['digest'],'allMatched':True,'archiveFilesAudited':audited,'privateKeyMaterial':'NONE'},indent=2)+'\n')
print(json.dumps({'matchedRuntimeFiles':len(verified),'archiveFilesAudited':len(audited),'ociManifestDigest':a['ociManifestDigest'],'allMatched':True}))
