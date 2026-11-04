import http from 'node:http';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {canonical,digest,object} from '../../src/domain/protocol.js';
import type {Envelope,SyntheticProvider,AppliedProof} from '../../src/ports.js';

export class FakeProviderServer {
  readonly server:http.Server;
  url='';
  loseResponse=false;
  beforeResponse:((envelope:Envelope,proof:AppliedProof)=>Promise<void>)|undefined;
  private chain:Promise<unknown>=Promise.resolve();
  constructor(readonly directory:string) {
    if(!directory.startsWith('/tmp/nukmiris-wp1-'))throw new Error('fixture_provider_only');
    this.server=http.createServer((req,res)=>{this.chain=this.chain.then(()=>this.handle(req,res)).catch(()=>{res.destroy();});});
  }
  async start():Promise<this> {
    await fs.mkdir(this.directory,{recursive:true});await fs.writeFile(path.join(this.directory,'calls.jsonl'),'');
    await new Promise<void>((resolve,reject)=>{this.server.once('error',reject);this.server.listen(0,'127.0.0.1',resolve);});
    const address=this.server.address();if(!address||typeof address==='string')throw new Error('fixture_listen');
    this.url=`http://127.0.0.1:${address.port}`;return this;
  }
  async calls():Promise<Envelope[]> {
    return (await fs.readFile(path.join(this.directory,'calls.jsonl'),'utf8')).split('\n').filter(Boolean).map(l=>JSON.parse(l) as Envelope);
  }
  private async handle(req:http.IncomingMessage,res:http.ServerResponse):Promise<void> {
    if(req.method==='POST'&&req.url==='/submit') {
      const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
      const envelope=object(JSON.parse(Buffer.concat(chunks).toString('utf8'))) as Envelope;
      if(envelope.payloadDigest!==digest(envelope.payload))throw new Error('fixture_payload_mismatch');
      // Count EVERY invocation, even if identical. Provider-side deduplication
      // must not hide an application double-submission bug.
      const file=await fs.open(path.join(this.directory,'calls.jsonl'),'a');
      try {await file.write(canonical(envelope)+'\n');await file.sync();}finally{await file.close();}
      const proof:AppliedProof={businessId:envelope.businessId,attemptId:envelope.attemptId,payloadDigest:envelope.payloadDigest,remoteId:envelope.remoteId};
      await this.beforeResponse?.(envelope,proof);
      if(this.loseResponse){res.destroy();return;}
      res.setHeader('content-type','application/json');res.end(JSON.stringify(proof));return;
    }
    if(req.method==='POST'&&req.url==='/read-only') {
      const chunks:Buffer[]=[];for await(const part of req)chunks.push(Buffer.from(part));
      const wanted=JSON.parse(Buffer.concat(chunks).toString('utf8')) as Envelope;
      const found=(await this.calls()).find(c=>canonical(c)===canonical(wanted));
      res.setHeader('content-type','application/json');res.end(JSON.stringify(found?{businessId:found.businessId,attemptId:found.attemptId,payloadDigest:found.payloadDigest,remoteId:found.remoteId}:null));return;
    }
    res.writeHead(404);res.end();
  }
  async close():Promise<void> {this.server.closeAllConnections();await new Promise<void>(resolve=>this.server.close(()=>resolve()));await this.chain;}
}
export class FakeProviderClient implements SyntheticProvider {
  readonly mode='WP1_SYNTHETIC_ONLY' as const;
  constructor(readonly url:string) {if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(url))throw new Error('loopback_only');}
  private async request(route:string,envelope:Envelope):Promise<AppliedProof|null> {
    return new Promise((resolve,reject)=>{
      // Exactly one request invocation; no redirect/retry library or SDK.
      const req=http.request(this.url+route,{method:'POST',headers:{'content-type':'application/json'},timeout:3000},res=>{
        const chunks:Buffer[]=[];res.on('data',c=>chunks.push(Buffer.from(c)));res.on('end',()=>{
          try {if(res.statusCode!==200)throw new Error('fake_rejected');resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as AppliedProof|null);}catch(e){reject(e);}
        });
      });
      req.once('timeout',()=>req.destroy(new Error('fake_timeout')));req.once('error',reject);req.end(JSON.stringify(envelope));
    });
  }
  async submitOnce(envelope:Envelope):Promise<AppliedProof> {const r=await this.request('/submit',envelope);if(!r)throw new Error('fake_no_proof');return r;}
  async readOnly(envelope:Envelope):Promise<AppliedProof|null> {return this.request('/read-only',envelope);}
}
