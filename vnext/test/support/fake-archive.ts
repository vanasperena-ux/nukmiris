import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createCipheriv,createDecipheriv,createHmac,randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { canonical,digest,object,text } from '../../src/domain/protocol.js';
import type { ObjectValue,Faults } from '../../src/domain/protocol.js';
import { noFaults } from '../../src/domain/protocol.js';
import type { EvidenceStore,Seal } from '../../src/ports.js';

interface Head { sequence: number; hash: string; mac: string }
interface RecordEntry { key: string; kind: string; keyVersion: string; sequence: number; prev: string; iv: string; tag: string; ciphertext: string; hash: string }
const ROOT='0'.repeat(64);
/** Local crashable stand-in, NOT independent offsite storage or a vendor guarantee. */
export class FakeArchive implements EvidenceStore {
  async lookup(key:string):Promise<Seal|null> { return (await this.records()).find(r=>r.key===key)??null; }
  constructor(readonly directory: string,readonly faults: Faults=noFaults) {
    if (!directory.startsWith('/tmp/nukmiris-wp1-')) throw new Error('fixture_archive_only');
  }
  async init(): Promise<void> {
    await fs.mkdir(path.join(this.directory,'objects'),{recursive:true});
    await fs.mkdir(path.join(this.directory,'custody'),{recursive:true});
    const keys={v1:randomBytes(32).toString('hex')};
    try {await fs.writeFile(path.join(this.directory,'custody/keys.json'),JSON.stringify(keys),{flag:'wx',mode:0o600});} catch(e) {if ((e as NodeJS.ErrnoException).code!=='EEXIST') throw e;}
    const head=await this.makeHead(0,ROOT);
    for (const name of ['head.json','custody/witness.json']) {
      try {await fs.writeFile(path.join(this.directory,name),JSON.stringify(head),{flag:'wx',mode:0o600});} catch(e) {if ((e as NodeJS.ErrnoException).code!=='EEXIST') throw e;}
    }
  }
  private async keys(): Promise<Record<string,string>> {return JSON.parse(await fs.readFile(path.join(this.directory,'custody/keys.json'),'utf8')) as Record<string,string>;}
  private async makeHead(sequence: number,hash: string): Promise<Head> {
    const key=(await this.keys())['v1']; if (!key) throw new Error('head_key_missing');
    return {sequence,hash,mac:createHmac('sha256',Buffer.from(key,'hex')).update(`${sequence}:${hash}`).digest('hex')};
  }
  private async atomic(name: string,value: unknown): Promise<void> {
    const dest=path.join(this.directory,name), temp=dest+'.tmp-'+randomBytes(8).toString('hex');
    const file=await fs.open(temp,'wx',0o600);
    try {await file.writeFile(JSON.stringify(value));await file.sync();} finally {await file.close();}
    await fs.rename(temp,dest);
    const dir=await fs.open(path.dirname(dest),'r');try {await dir.sync();} finally {await dir.close();}
  }
  private async locked<T>(fn:()=>Promise<T>): Promise<T> {
    const lock=path.join(this.directory,'append.lock');
    for(let n=0;;n++) {
      try {await fs.mkdir(lock);break;} catch(e) {if((e as NodeJS.ErrnoException).code!=='EEXIST'||n>=500)throw e;await delay(10);}
    }
    // A crashed owner leaves this lock. Never steal by age. Recovery/hold is explicit.
    try{return await fn();}finally{await fs.rmdir(lock);}
  }
  async records(): Promise<Seal[]> {
    const head=JSON.parse(await fs.readFile(path.join(this.directory,'head.json'),'utf8')) as Head;
    const witness=JSON.parse(await fs.readFile(path.join(this.directory,'custody/witness.json'),'utf8')) as Head;
    if (!Number.isSafeInteger(head.sequence)||head.sequence<0||head.sequence>100000||canonical(object(head))!==canonical(object(witness))
      || canonical(object(head))!==canonical(object(await this.makeHead(head.sequence,head.hash)))) throw new Error('archive_head_unknown');
    const keys=await this.keys(), records:Seal[]=[],seen=new Set<string>();let prev=ROOT;
    for(let n=1;n<=head.sequence;n++) {
      const raw=JSON.parse(await fs.readFile(path.join(this.directory,`objects/${n}.json`),'utf8')) as RecordEntry;
      const {hash,...unsigned}=raw;
      if(raw.sequence!==n||raw.prev!==prev||digest(object(unsigned))!==hash||seen.has(raw.key))throw new Error('archive_chain_invalid');
      const key=keys[raw.keyVersion];if(!key)throw new Error('archive_key_missing');
      const decoder=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(raw.iv,'hex'));
      decoder.setAAD(Buffer.from(canonical({key:raw.key,kind:raw.kind,sequence:n,keyVersion:raw.keyVersion})));decoder.setAuthTag(Buffer.from(raw.tag,'hex'));
      const body=object(JSON.parse(Buffer.concat([decoder.update(Buffer.from(raw.ciphertext,'hex')),decoder.final()]).toString('utf8')));
      records.push({key:raw.key,kind:raw.kind,body,digest:digest(body),sequence:n,hash,keyVersion:raw.keyVersion});seen.add(raw.key);prev=hash;
    }
    if(prev!==head.hash)throw new Error('archive_tail_missing');
    return records;
  }
  async verify(seal:Seal):Promise<void> {
    const actual=(await this.records()).find(r=>r.key===seal.key);
    if (!actual||canonical(object(actual))!==canonical(object(seal)))throw new Error('unverified_seal');
  }
  async ensure(key:string,kind:string,match:ObjectValue,allocate:()=>ObjectValue=()=>({})):Promise<Seal> {
    text(key);text(kind);
    return this.locked(async()=>{
      const records=await this.records(),existing=records.find(r=>r.key===key);
      if(existing) {
        if(existing.kind!==kind||Object.entries(match).some(([k,v])=>canonical(existing.body[k]??null)!==canonical(v)))throw new Error('archive_identity_conflict');
        return existing;
      }
      await this.faults.hit('archive.beforePut');
      const body={...match,...allocate()},sequence=records.length+1,prev=records.at(-1)?.hash??ROOT,keyVersion='v1';
      const keyBytes=(await this.keys())[keyVersion];if(!keyBytes)throw new Error('archive_key_missing');
      const iv=randomBytes(12),encoder=createCipheriv('aes-256-gcm',Buffer.from(keyBytes,'hex'),iv);
      encoder.setAAD(Buffer.from(canonical({key,kind,sequence,keyVersion})));
      const ciphertext=Buffer.concat([encoder.update(canonical(body)),encoder.final()]);
      const unsigned={key,kind,keyVersion,sequence,prev,iv:iv.toString('hex'),tag:encoder.getAuthTag().toString('hex'),ciphertext:ciphertext.toString('hex')};
      const hash=digest(unsigned),entry={...unsigned,hash};
      await this.atomic(`objects/${sequence}.json`,entry);await this.faults.hit('archive.afterObject');
      const head=await this.makeHead(sequence,hash);
      await this.atomic('head.json',head);await this.faults.hit('archive.afterHead');
      await this.atomic('custody/witness.json',head);await this.faults.hit('archive.afterWitness');
      return {key,kind,body,digest:digest(body),sequence,hash,keyVersion};
    });
  }
}
