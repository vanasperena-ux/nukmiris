"""Reconstruct the exact tested Docker image from pinned public base + own layer.
No cloud SDK/API/credentials; does not execute Docker or start a container.
Usage: python assemble-image.py NODE_BASE_DOCKER_SAVE.tar OWN_LAYER.tar OUTPUT.tar
"""
import hashlib,io,json,pathlib,sys,tarfile,tempfile
here=pathlib.Path(__file__).resolve().parent
artifact=json.loads((here/'image-artifact.json').read_text());config=(here/'image-config.json').read_bytes();manifest=(here/'image-manifest.json').read_bytes()
assert 'sha256:'+hashlib.sha256(config).hexdigest()==artifact['dockerConfigDigest']
assert 'sha256:'+hashlib.sha256(manifest).hexdigest()==artifact['ociManifestDigest']
expected=artifact['layers'];own=pathlib.Path(sys.argv[2]);assert 'sha256:'+hashlib.sha256(own.read_bytes()).hexdigest()==expected[-1]['digest']
with tempfile.TemporaryDirectory(prefix='b1a2-image-assembly-') as folder:
 folder=pathlib.Path(folder);found={}
 # Read only archive members; write using computed hashes, never archive paths.
 with tarfile.open(sys.argv[1]) as base:
  selected=json.load(base.extractfile('manifest.json'));assert len(selected)==1
  base_config=json.load(base.extractfile(selected[0]['Config']));assert base_config['rootfs']['diff_ids']==[v['digest'] for v in expected[:-1]]
  for name,item in zip(selected[0]['Layers'],expected[:-1]):
   target=folder/item['digest'][7:];h=hashlib.sha256();size=0
   with base.extractfile(name) as source,target.open('wb') as out:
    while True:
     data=source.read(1048576)
     if not data:break
     h.update(data);size+=len(data);out.write(data)
   assert 'sha256:'+h.hexdigest()==item['digest'] and size==item['size'];found[item['digest']]=target
 found[expected[-1]['digest']]=own
 config_name=artifact['dockerConfigDigest'][7:]+'.json';layers=[v['digest'][7:]+'/layer.tar' for v in expected]
 descriptor=json.dumps([{'Config':config_name,'RepoTags':['nukmiris-b1a2-local:reconstructed'],'Layers':layers}],separators=(',',':')).encode()
 with pathlib.Path(sys.argv[3]).open('xb') as handle,tarfile.open(fileobj=handle,mode='w') as out:
  for name,data in [(config_name,config),('manifest.json',descriptor)]:
   info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644;out.addfile(info,io.BytesIO(data))
  for name,item in zip(layers,expected):
   info=tarfile.TarInfo(name);info.size=item['size'];info.mode=0o644
   with found[item['digest']].open('rb') as source:out.addfile(info,source)
print(json.dumps({'exactDockerImageId':artifact['dockerConfigDigest'],'canonicalOciManifest':artifact['ociManifestDigest'],'layerHashesVerified':len(expected),'cloudAccess':False}))
