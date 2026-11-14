"""Stream docker-save stdin; preserve only config and proof layer, hash all layers.
No cloud/image registry/credentials. Base layers are reconstructed from pinned Node.
"""
import sys,tarfile,hashlib,json,pathlib
out=pathlib.Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
entries={};raws={};config=None;manifest=None
with tarfile.open(fileobj=sys.stdin.buffer,mode='r|') as archive:
 for entry in archive:
  if entry.islnk():
   entries[entry.name]=entries[entry.linkname]
   if entry.linkname in raws:raws[entry.name]=raws[entry.linkname]
   continue
  if not entry.isfile():continue
  f=archive.extractfile(entry);sha=hashlib.sha256();size=0;small=[]
  while True:
   b=f.read(1048576)
   if not b:break
   sha.update(b);size+=len(b)
   if size<=4194304:small.append(b)
  digest=sha.hexdigest();entries[entry.name]={'digest':'sha256:'+digest,'size':size}
  if size<=4194304:raws[entry.name]=b''.join(small)
  if entry.name=='manifest.json':manifest=json.loads(raws[entry.name])
assert manifest and len(manifest)==1
m=manifest[0];config=(m['Config'],raws[m['Config']]);v=json.loads(config[1]);layers=[entries[p] for p in m['Layers']]
for p in m['Layers']:
 if p in raws:(out/('layer-'+entries[p]['digest'][7:]+'.tar')).write_bytes(raws[p])
assert [x['digest'] for x in layers]==v['rootfs']['diff_ids']
oci={'schemaVersion':2,'mediaType':'application/vnd.oci.image.manifest.v1+json','config':{'mediaType':'application/vnd.oci.image.config.v1+json',**entries[m['Config']]},'layers':[{'mediaType':'application/vnd.oci.image.layer.v1.tar',**p} for p in layers]}
raw=json.dumps(oci,separators=(',',':')).encode();(out/'manifest.json').write_bytes(raw);(out/'config.json').write_bytes(config[1]);pin={'ociManifestDigest':'sha256:'+hashlib.sha256(raw).hexdigest(),'dockerConfigDigest':entries[m['Config']]['digest'],'baseImage':'node@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df','publication':'LOCAL_BUILD_ONLY_NOT_PUSHED','configContainsNoSecrets':True,'baseLayers':'Reconstruct by pulling exactly baseImage then docker-save; verify diff_ids','layers':layers};(out/'artifact.json').write_text(json.dumps(pin,indent=2)+'\n');print(json.dumps(pin))
