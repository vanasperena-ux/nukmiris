import { DatabaseSync } from 'node:sqlite';
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { TestContext } from 'node:test';
import { canonical, object } from '../../src/domain/protocol.js';
import { IndexedArchive, type ArchiveConfig } from '../../src/infrastructure/archive/indexed-archive.js';
import { emptyHead, same, ZERO, type ArchiveWitness, type Checkpoint, type Head, type RepairPermit, type SignedCheckpoint } from '../../src/infrastructure/archive/protocol.js';

/** Separate signing capability, NOT an independent history verifier. It checks CAS
 * and monotonic size/epoch, not chain/index extension (retained X1 counterexample).
 * Same-host storage and honest writer code/keys do NOT close custody gate 009.
 */
export class FixtureWitness {
  private readonly db:DatabaseSync;
  private readonly keys=generateKeyPairSync('ed25519');
  readonly publicKey=this.keys.publicKey;
  readonly writer:ArchiveWitness;
  constructor(file:string,archiveId:string) {
    this.db=new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;
      CREATE TABLE checkpoints(id INTEGER PRIMARY KEY,value TEXT NOT NULL);
      CREATE TRIGGER immutable_update BEFORE UPDATE ON checkpoints BEGIN SELECT RAISE(ABORT,'append_only'); END;
      CREATE TRIGGER immutable_delete BEFORE DELETE ON checkpoints BEGIN SELECT RAISE(ABORT,'append_only'); END;`);
    this.store({head:emptyHead(archiveId),epoch:0,mode:'NORMAL',repairDigest:ZERO});
    this.writer=Object.freeze({read:async()=>this.read(),advance:async(expected:Checkpoint,head:Head)=>this.change(expected,{...expected,head},'append')});
  }
  private store(value:Checkpoint):SignedCheckpoint {
    const signed={value,signature:sign(null,Buffer.from(canonical(object(value))),this.keys.privateKey).toString('base64')};
    this.db.prepare('INSERT INTO checkpoints(value) VALUES(?)').run(JSON.stringify(signed));return signed;
  }
  read():SignedCheckpoint {return JSON.parse((this.db.prepare('SELECT value FROM checkpoints ORDER BY id DESC LIMIT 1').get() as {value:string}).value) as SignedCheckpoint;}
  private change(expected:Checkpoint,next:Checkpoint,action:'append'|'fence'|'repair'):SignedCheckpoint {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if(!same(this.read().value,expected))throw new Error('witness_cas_conflict');
      if(action==='append'&&(expected.mode!=='NORMAL'||next.head.size<=expected.head.size||next.head.archiveId!==expected.head.archiveId))throw new Error('witness_append_denied');
      const result=this.store(next);this.db.exec('COMMIT');return result;
    }catch(e){this.db.exec('ROLLBACK');throw e;}
  }
  beginRepair():RepairPermit {
    const old=this.read().value;
    const fenced=this.change(old,{...old,epoch:old.epoch+1,mode:'REPAIR'},'fence');
    return Object.freeze({fenced,finish:async(head:Head,repairDigest:string)=>{
      if(head.archiveId!==old.head.archiveId||head.size<old.head.size)throw new Error('witness_repair_rollback');
      return this.change(fenced.value,{head,epoch:fenced.value.epoch,mode:'NORMAL',repairDigest},'repair');
    }});
  }
  close():void {this.db.close();}
}
export async function archiveFixture(t:TestContext,capacity?:number) {
  const directory=await mkdtemp(join(tmpdir(),'nukmiris-l0a-'));
  const witness=new FixtureWitness(join(directory,'witness.sqlite'),'synthetic-archive');
  const config:ArchiveConfig={file:join(directory,'archive.sqlite'),archiveId:'synthetic-archive',witness:witness.writer,witnessKey:witness.publicKey,
    authenticationKey:randomBytes(32),encryptionKeys:new Map([['v1',randomBytes(32)],['v2',randomBytes(32)]]),activeKey:'v1',tenants:['synthetic-a','synthetic-b','ingress-custody'],...(capacity===undefined?{}:{capacity})};
  const opened:IndexedArchive[]=[];const archive=await IndexedArchive.create(config);opened.push(archive);
  const open=async(c:ArchiveConfig=config)=>{const a=await IndexedArchive.open(c);opened.push(a);return a;};
  const repair=async(c:ArchiveConfig=config)=>{const r=await IndexedArchive.repair(c,witness.beginRepair());opened.push(r.archive);return r;};
  t.after(async()=>{for(const a of opened){try{a.close();}catch{}}witness.close();await rm(directory,{recursive:true,force:true});});
  return {directory,witness,config,archive,scope:archive.scope('synthetic-a'),open,repair};
}
export function corrupt(file:string,sql:string):void {const db=new DatabaseSync(file);try{db.exec(sql);}finally{db.close();}}
