import { DatabaseSync, backup } from 'node:sqlite';
import { closeSync, openSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, type KeyObject } from 'node:crypto';
import { canonical, depth, digest, object, text, noFaults, type ObjectValue, type Faults } from '../../domain/protocol.js';
import type { EvidenceStore, Seal } from '../../ports.js';
import { AuthenticatedTree } from './authenticated-tree.js';
import { ArchiveMutex, ArchiveBusyError, ArchivePendingError, ArchiveHeldError, archiveError } from './availability.js';
import { authenticate, emptyHead, headDigest, same, ZERO, type ArchiveWitness, type Checkpoint, type Head, type RepairPermit } from './protocol.js';

interface Entry {
  sequence:number; tenant:string; keyHash:string; keyVersion:string; prev:string;
  iv:string; tag:string; ciphertext:string; mac:string; hash:string;
}
interface Meta { head:Head; pending:{base:Head; epoch:number} | null }
export interface ArchiveConfig {
  file:string; archiveId:string; witness:ArchiveWitness; witnessKey:KeyObject;
  authenticationKey:Buffer; encryptionKeys:ReadonlyMap<string,Buffer>; activeKey:string;
  tenants:readonly string[]; capacity?:number; faults?:Faults;
  /** Independently retained floor, if available. Never obtained from the archive file. */
  minimumCheckpoint?:Checkpoint;
  /** Existing local directory; forensic data/keys must never be published as evidence. */
  forensicDirectory?:string;
}
export interface ArchiveInput { key:string; kind:string; match:ObjectValue; allocate?:()=>ObjectValue }
const schema = `
 CREATE TABLE meta(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL);
 CREATE TABLE records(sequence INTEGER PRIMARY KEY, tenant TEXT NOT NULL, key_hash TEXT NOT NULL, value TEXT NOT NULL, UNIQUE(tenant,key_hash));
 CREATE TABLE nodes(key TEXT PRIMARY KEY,value TEXT NOT NULL) WITHOUT ROWID;
 CREATE TABLE repair_nodes(key TEXT PRIMARY KEY,value TEXT NOT NULL) WITHOUT ROWID;
 CREATE TABLE repair_case(id INTEGER PRIMARY KEY,value TEXT NOT NULL);
 CREATE TRIGGER records_no_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT,'append_only'); END;
 CREATE TRIGGER records_no_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT,'append_only'); END;
 CREATE TRIGGER repair_no_update BEFORE UPDATE ON repair_case BEGIN SELECT RAISE(ABORT,'append_only'); END;
 CREATE TRIGGER repair_no_delete BEFORE DELETE ON repair_case BEGIN SELECT RAISE(ABORT,'append_only'); END;`;

/** Bounded synthetic local adapter. No provider, production custody or automatic repair. */
export class IndexedArchive {
  private readonly db:DatabaseSync;
  private readonly allowed:Set<string>;
  private readonly config:ArchiveConfig;
  private floor:Checkpoint | undefined;
  private readonly faults:Faults;
  private readonly mutex=new ArchiveMutex();
  readonly metrics={lookups:0,nodeReads:0,decryptions:0,fullAudits:0};
  private constructor(config:ArchiveConfig, create:boolean) {
    text(config.archiveId);
    if(config.authenticationKey.length!==32 || !config.encryptionKeys.size || !config.tenants.length) throw new Error('archive_configuration');
    if(config.capacity!==undefined&&(!Number.isSafeInteger(config.capacity)||config.capacity<1||config.capacity>1_100_000))throw new Error('archive_capacity_configuration');
    for(const key of config.encryptionKeys.values()) if(key.length!==32) throw new Error('archive_configuration');
    // Copy caller-owned key material and grants; later mutation cannot widen a facade.
    this.config={...config,authenticationKey:Buffer.from(config.authenticationKey),encryptionKeys:new Map([...config.encryptionKeys].map(([v,k])=>[v,Buffer.from(k)]))};
    this.allowed=new Set(config.tenants.map(text)); this.faults=config.faults??noFaults; this.floor=config.minimumCheckpoint;
    if(create) closeSync(openSync(config.file,'wx',0o600)); // Never recreate a lost archive on open.
    else closeSync(openSync(config.file,'r'));
    this.db=new DatabaseSync(config.file);
    try {
      this.db.exec('PRAGMA busy_timeout=250; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;');
      if(create) { this.db.exec(schema); this.setMeta({head:emptyHead(config.archiveId),pending:null}); }
    }catch(e){this.db.close();throw archiveError(e);}
  }
  static async create(config:ArchiveConfig):Promise<IndexedArchive> {
    const a=new IndexedArchive(config,true);
    try { await a.serialized(async()=>{const c=await a.checkpoint();if(c.mode!=='NORMAL'||!same(c.head,emptyHead(config.archiveId)))throw new Error('archive_initial_checkpoint');});return a; }
    catch(e) { a.close(); throw e; }
  }
  static async open(config:ArchiveConfig):Promise<IndexedArchive> {
    const a=new IndexedArchive(config,false);
    try { await a.serialized(()=>a.healthy()); return a; } catch(e) { a.close(); throw e; }
  }
  /** Held archives can only be opened with an externally signed repair fence. */
  static async repair(config:ArchiveConfig,permit:RepairPermit):Promise<{archive:IndexedArchive;repaired:number}> {
    const a=new IndexedArchive(config,false);
    try {const repaired=await a.repair(permit);return {archive:a,repaired};}catch(e){a.close();throw e;}
  }
  /** Operator capability, not exposed by a tenant facade; shares its instance's connection mutex. */
  async repair(permit:RepairPermit):Promise<number> {
    return this.serialized(async()=>{
      const fence=authenticate(permit.fenced,this.config.witnessKey,this.config.archiveId);
      if(fence.mode!=='REPAIR'||!same(await this.checkpoint(),fence))throw new Error('archive_repair_fence');
      // Completed backups are coherent. A killed backup can leave a partial final-name
      // copy: N2 remains a production repair gate (atomic publication + signed digest).
      const forensic=join(this.config.forensicDirectory??dirname(this.config.file),basename(this.config.file)+'.forensic-'+fence.epoch);
      closeSync(openSync(forensic+'.sqlite','wx',0o600));
      writeFileSync(forensic+'.checkpoint.json',JSON.stringify(permit.fenced),{flag:'wx',mode:0o600});
      await backup(this.db,forensic+'.sqlite');
      return this.rebuild(permit);
    });
  }
  close():void {
    if(this.mutex.active)throw new ArchiveBusyError('INSTANCE_ACTIVE');
    this.db.close();
  }
  private async serialized<T>(work:()=>Promise<T>):Promise<T> {
    try{return await this.mutex.run(work);}catch(e){throw archiveError(e);}
  }
  private meta():Meta {
    const row=this.db.prepare('SELECT value FROM meta WHERE id=1').get() as {value:string}|undefined;
    if(!row) throw new Error('archive_meta_missing');
    const m=JSON.parse(row.value) as Meta;
    if(m.head.archiveId!==this.config.archiveId) throw new Error('archive_identity'); return m;
  }
  private setMeta(meta:Meta):void {this.db.prepare('INSERT INTO meta VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(JSON.stringify(meta));}
  private async checkpoint():Promise<Checkpoint> {
    const c=authenticate(await this.config.witness.read(),this.config.witnessKey,this.config.archiveId), f=this.floor;
    if(f&&(c.epoch<f.epoch||c.head.size<f.head.size||(c.head.size===f.head.size&&!same(c.head,f.head)))) throw new Error('archive_witness_rollback');
    this.floor=c; return c;
  }
  private check(meta:Meta,c:Checkpoint):void {
    if(c.mode!=='NORMAL')throw new ArchiveHeldError('REPAIR_FENCE');
    if(meta.pending)throw new ArchivePendingError();
    if(!same(meta.head,c.head))throw new ArchiveHeldError('CHECKPOINT_MISMATCH');
    const row=this.db.prepare('SELECT value FROM repair_case ORDER BY id DESC LIMIT 1').get() as {value:string}|undefined;
    const last=row?this.repairDecision(JSON.parse(row.value) as ObjectValue).hash:ZERO;
    if(last!==c.repairDigest)throw new Error('archive_repair_audit_head');
  }
  private repairDecision(value:ObjectValue):{hash:string;previous:string} {
    const {digest:hash,mac,...decision}=value;
    const expected=createHmac('sha256',this.config.authenticationKey).update(canonical(decision)).digest('hex');
    if(mac!==expected||hash!==digest({...decision,mac})||decision['archiveId']!==this.config.archiveId)throw new Error('archive_repair_audit_authentication');
    return {hash:text(hash),previous:text(decision['previousRepair'])};
  }
  private auditRepairs(anchor:string,allowPending:boolean):string {
    let last=ZERO,anchored=anchor===ZERO,id=0;
    for(const row of this.db.prepare('SELECT id,value FROM repair_case ORDER BY id').iterate() as Iterable<{id:number;value:string}>) {
      const d=this.repairDecision(JSON.parse(row.value) as ObjectValue);
      if(row.id!==++id||d.previous!==last)throw new Error('archive_repair_audit_chain');
      last=d.hash;if(last===anchor)anchored=true;
    }
    if(!anchored||(!allowPending&&last!==anchor))throw new Error('archive_repair_audit_missing');return last;
  }
  private async healthy():Promise<void> {const c=await this.checkpoint(); this.check(this.meta(),c);}
  scope(tenant:string):EvidenceStore & {ensureBatch(inputs:readonly ArchiveInput[]):Promise<Seal[]>} {
    if(!this.allowed.has(tenant)) throw new Error('archive_tenant_denied');
    return Object.freeze({
      businessId:tenant,
      ensure:(key:string,kind:string,match:ObjectValue,allocate?:()=>ObjectValue)=>this.serialized(()=>this.append(tenant,[{key,kind,match,...(allocate?{allocate}:{})}])).then(s=>s[0]!),
      ensureBatch:(inputs:readonly ArchiveInput[])=>this.serialized(()=>this.append(tenant,inputs)),
      lookup:(key:string)=>this.serialized(()=>this.lookup(tenant,key)),
      verify:(seal:Seal)=>this.serialized(async()=>{const actual=await this.lookup(tenant,seal.key);if(!actual||!same(actual,seal))throw new Error('unverified_seal');}),
      records:()=>this.serialized(()=>this.records(tenant))
    });
  }
  private keyHash(tenant:string,key:string):string {return digest({tenant,key});}
  private decode(entry:Entry):Seal {
    const {hash,mac,...unsigned}=entry;
    const expected=createHmac('sha256',this.config.authenticationKey).update(canonical(object(unsigned))).digest('hex');
    if(mac!==expected||hash!==digest({...unsigned,mac})) throw new Error('archive_record_authentication');
    const key=this.config.encryptionKeys.get(entry.keyVersion); if(!key) throw new Error('archive_key_missing');
    const decoder=createDecipheriv('aes-256-gcm',key,Buffer.from(entry.iv,'hex'));
    decoder.setAAD(Buffer.from(canonical({archiveId:this.config.archiveId,tenant:entry.tenant,keyHash:entry.keyHash,sequence:entry.sequence,keyVersion:entry.keyVersion,prev:entry.prev})));
    decoder.setAuthTag(Buffer.from(entry.tag,'hex')); this.metrics.decryptions++;
    const value=object(JSON.parse(Buffer.concat([decoder.update(Buffer.from(entry.ciphertext,'hex')),decoder.final()]).toString('utf8')));
    const stableKey=text(value['key']),kind=text(value['kind']),body=object(value['body']);
    if(this.keyHash(entry.tenant,stableKey)!==entry.keyHash) throw new Error('archive_identity');
    this.bodyTenant(entry.tenant,body);
    return {key:stableKey,kind,body,digest:digest(body),sequence:entry.sequence,hash,keyVersion:entry.keyVersion};
  }
  private entry(sequence:number):Entry {
    const row=this.db.prepare('SELECT tenant,key_hash,value FROM records WHERE sequence=?').get(sequence) as {tenant:string;key_hash:string;value:string}|undefined;
    if(!row)throw new Error('archive_record_missing');
    const e=JSON.parse(row.value) as Entry;
    if(e.sequence!==sequence||e.tenant!==row.tenant||e.keyHash!==row.key_hash)throw new Error('archive_record_identity'); return e;
  }
  private find(tree:AuthenticatedTree,head:Head,tenant:string,key:string):Seal|null {
    const keyHash=this.keyHash(tenant,key),found=tree.find(head.root,keyHash);
    if(!found)return null;
    if(found.sequence<1||found.sequence>head.size)throw new Error('archive_index_sequence');
    const e=this.entry(found.sequence);
    if(e.tenant!==tenant||e.keyHash!==keyHash||e.hash!==found.entry)throw new Error('archive_index_record_mismatch');
    return this.decode(e);
  }
  private bodyTenant(tenant:string,body:ObjectValue):void {
    depth(body);
    const visit=(value:unknown):void=>{
      if(Array.isArray(value)){for(const item of value)visit(item);}
      else if(value&&typeof value==='object')for(const [key,item] of Object.entries(value)) {
        if(key==='businessId'&&item!==tenant)throw new Error('archive_foreign_body');visit(item);
      }
    };
    visit(body);
  }
  private async lookup(tenant:string,key:string):Promise<Seal|null> {
    text(key); const c=await this.checkpoint(); this.db.exec('BEGIN');
    try {
      const m=this.meta(); this.check(m,c); const tree=new AuthenticatedTree(this.db);
      const found=this.find(tree,m.head,tenant,key);this.metrics.lookups++;this.metrics.nodeReads+=tree.reads;
      this.db.exec('COMMIT');return found;
    } catch(e) {this.db.exec('ROLLBACK');throw e;}
  }
  private async append(tenant:string,inputs:readonly ArchiveInput[]):Promise<Seal[]> {
    if(!inputs.length||inputs.length>1000)throw new Error('archive_batch_bound');
    for(const input of inputs) {text(input.key);text(input.kind);depth(input.match);this.bodyTenant(tenant,input.match);}
    const c=await this.checkpoint();this.db.exec('BEGIN IMMEDIATE');let committed=false;
    let next:Head;const result:Seal[]=[];
    try {
      const m=this.meta();this.check(m,c);next=structuredClone(m.head);const tree=new AuthenticatedTree(this.db);
      for(const input of inputs) {
        const existing=this.find(tree,next,tenant,input.key);
        if(existing) {
          if(existing.kind!==input.kind||Object.entries(input.match).some(([k,v])=>!Object.hasOwn(existing.body,k)||canonical(existing.body[k]!)!==canonical(v)))throw new Error('archive_identity_conflict');
          result.push(existing);continue;
        }
        if(next.size>=(this.config.capacity??1_100_000))throw new Error('archive_capacity_hold');
        const allocation=input.allocate?.()??{};
        for(const [k,v] of Object.entries(input.match))if(k in allocation&&canonical(allocation[k]!)!==canonical(v))throw new Error('archive_allocation_conflict');
        const body={...input.match,...allocation};depth(body);this.bodyTenant(tenant,body);
        const plaintext=canonical({key:input.key,kind:input.kind,body});
        if(Buffer.byteLength(plaintext)>1_048_576)throw new Error('archive_record_bound');
        const keyVersion=this.config.activeKey,key=this.config.encryptionKeys.get(keyVersion);
        if(!key)throw new Error('archive_key_missing');
        const sequence=next.size+1,prev=next.tip,keyHash=this.keyHash(tenant,input.key),iv=randomBytes(12);
        const encoder=createCipheriv('aes-256-gcm',key,iv);
        encoder.setAAD(Buffer.from(canonical({archiveId:this.config.archiveId,tenant,keyHash,sequence,keyVersion,prev})));
        const ciphertext=Buffer.concat([encoder.update(plaintext),encoder.final()]);
        const unsigned={sequence,tenant,keyHash,keyVersion,prev,iv:iv.toString('hex'),tag:encoder.getAuthTag().toString('hex'),ciphertext:ciphertext.toString('hex')};
        const mac=createHmac('sha256',this.config.authenticationKey).update(canonical(unsigned)).digest('hex');
        const hash=digest({...unsigned,mac}),entry={...unsigned,mac,hash};
        this.db.prepare('INSERT INTO records VALUES(?,?,?,?)').run(sequence,tenant,keyHash,JSON.stringify(entry));
        next={archiveId:this.config.archiveId,size:sequence,tip:hash,root:tree.insert(next.root,keyHash,sequence,hash)};
        result.push({key:input.key,kind:input.kind,body,digest:digest(body),sequence,hash,keyVersion});
      }
      tree.flush();this.metrics.nodeReads+=tree.reads;
      if(same(next,m.head)){this.db.exec('COMMIT');return result;}
      this.setMeta({head:next,pending:{base:m.head,epoch:c.epoch}});
      await this.faults.hit('archive.beforeDataCommit');this.db.exec('COMMIT');committed=true;
    } catch(e) {if(!committed)this.db.exec('ROLLBACK');throw e;}
    await this.faults.hit('archive.afterDataCommit');
    const signed=await this.config.witness.advance(c,next!);
    const advanced=authenticate(signed,this.config.witnessKey,this.config.archiveId);
    if(advanced.mode!=='NORMAL'||advanced.epoch!==c.epoch||!same(advanced.head,next!)||advanced.repairDigest!==c.repairDigest)throw new Error('archive_advance_unknown');
    this.floor=advanced;await this.faults.hit('archive.afterWitnessCommit');
    // Re-check the fence after the external CAS. An operator fence must hold the archive.
    const current=await this.checkpoint(); if(!same(current,advanced))throw new Error('archive_fenced');
    this.confirm(next!);await this.faults.hit('archive.afterConfirm');return result;
  }
  private confirm(head:Head):void {
    this.db.exec('BEGIN IMMEDIATE');
    try {const m=this.meta();if(!same(m.head,head))throw new Error('archive_confirm_mismatch');this.setMeta({head,pending:null});this.db.exec('COMMIT');}
    catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  /** Cold completeness audit only. Normal dispatch/verification never scans history. */
  private async records(tenant:string):Promise<Seal[]> {
    const c=await this.checkpoint();this.db.exec('BEGIN');
    try {
      const m=this.meta();this.check(m,c);const out:Seal[]=[],tree=new AuthenticatedTree(this.db);let prev=ZERO;
      this.auditRepairs(c.repairDigest,false);
      this.metrics.fullAudits++;
      for(let sequence=1;sequence<=m.head.size;sequence++) {
        const e=this.entry(sequence),s=this.decode(e),node=tree.find(m.head.root,e.keyHash);
        if(e.prev!==prev||!node||node.sequence!==sequence||node.entry!==e.hash)throw new Error('archive_audit_invalid');
        prev=e.hash;if(e.tenant===tenant)out.push(s);
        if(sequence%1000===0)tree.flush(); // Clears read cache; no writes in a read-only audit.
      }
      if(prev!==m.head.tip||(this.db.prepare('SELECT count(*) AS n FROM records').get() as {n:number}).n!==m.head.size)throw new Error('archive_tail_invalid');
      this.db.exec('COMMIT');return out;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  private async rebuild(permit:RepairPermit):Promise<number> {
    const fence=authenticate(permit.fenced,this.config.witnessKey,this.config.archiveId),current=await this.checkpoint();
    if(fence.mode!=='REPAIR'||!same(current,fence))throw new Error('archive_repair_fence');
    this.db.exec('BEGIN IMMEDIATE');let committed=false;let rebuilt:Head;let repairDigest:string;
    try {
      const m=this.meta();
      const previousRepair=this.auditRepairs(fence.repairDigest,true);
      if(!Number.isSafeInteger(m.head.size)||m.head.size<fence.head.size||m.head.size>(this.config.capacity??1_100_000))throw new Error('archive_repair_rollback');
      if(m.head.size>fence.head.size&&(!m.pending||!same(m.pending.base,fence.head)||m.pending.epoch>=fence.epoch))throw new Error('archive_unanchored_tail');
      this.db.exec('DELETE FROM repair_nodes');const tree=new AuthenticatedTree(this.db,'repair_nodes');rebuilt=emptyHead(this.config.archiveId);
      if(fence.head.size===0&&!same(fence.head,rebuilt))throw new Error('archive_repair_prefix');
      for(let sequence=1;sequence<=m.head.size;sequence++) {
        const e=this.entry(sequence);this.decode(e);
        if(e.prev!==rebuilt.tip)throw new Error('archive_repair_chain');
        rebuilt={archiveId:this.config.archiveId,size:sequence,tip:e.hash,root:tree.insert(rebuilt.root,e.keyHash,sequence,e.hash)};
        if(sequence===fence.head.size&&!same(rebuilt,fence.head))throw new Error('archive_repair_prefix');
        if(sequence%1000===0)tree.flush();
      }
      tree.flush();
      if(!same(rebuilt,m.head)||(this.db.prepare('SELECT count(*) AS n FROM records').get() as {n:number}).n!==rebuilt.size)throw new Error('archive_repair_tail');
      const decision={archiveId:this.config.archiveId,epoch:fence.epoch,before:headDigest(fence.head),after:headDigest(rebuilt),previousRepair,action:'VERIFIED_REBUILD_PRESERVE_IDENTITIES'};
      const mac=createHmac('sha256',this.config.authenticationKey).update(canonical(decision)).digest('hex');
      repairDigest=digest({...decision,mac});
      this.db.prepare('INSERT INTO repair_case(value) VALUES(?)').run(JSON.stringify({...decision,mac,digest:repairDigest}));
      this.db.exec('DELETE FROM nodes; INSERT INTO nodes SELECT * FROM repair_nodes; DELETE FROM repair_nodes;');
      this.setMeta({head:rebuilt,pending:{base:fence.head,epoch:fence.epoch}});
      await this.faults.hit('archive.beforeRepairCommit');this.db.exec('COMMIT');committed=true;
    }catch(e){if(!committed)this.db.exec('ROLLBACK');throw e;}
    await this.faults.hit('archive.afterRepairCommit');
    const done=authenticate(await permit.finish(rebuilt!,repairDigest!),this.config.witnessKey,this.config.archiveId);
    if(done.mode!=='NORMAL'||done.epoch!==fence.epoch||!same(done.head,rebuilt!)||done.repairDigest!==repairDigest!)throw new Error('archive_repair_finish_unknown');
    this.floor=done;await this.faults.hit('archive.afterRepairWitness');
    const now=await this.checkpoint();if(!same(now,done))throw new Error('archive_fenced');
    this.confirm(rebuilt!);return rebuilt!.size;
  }
}
