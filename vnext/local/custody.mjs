// Same-host synthetic custody only. Monotonic size/epoch is NOT independent
// verification of record-chain AND index extension (X1/production009 remain).
import {DatabaseSync} from 'node:sqlite';
import {generateKeyPairSync,createPrivateKey,createPublicKey,randomBytes,sign} from 'node:crypto';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {IndexedArchive} from '../dist/src/infrastructure/archive/indexed-archive.js';
import {canonical,object} from '../dist/src/domain/protocol.js';
import {emptyHead,ZERO,same} from '../dist/src/infrastructure/archive/protocol.js';
import {privateJson,protect,assertPrivate} from './fixture.mjs';
export async function openCustody(s,{create=false}={}){
 const dir=path.join(s.directory,'custody');
 if(create){await fs.mkdir(dir,{mode:0o700});await protect(dir);const kp=generateKeyPairSync('ed25519');await privateJson(path.join(dir,'keys.json'),{format:1,archiveId:'local-'+s.id,privateKey:kp.privateKey.export({format:'pem',type:'pkcs8'}),publicKey:kp.publicKey.export({format:'pem',type:'spki'}),auth:randomBytes(32).toString('hex'),encryption:randomBytes(32).toString('hex')});}
 await assertPrivate(dir,{directory:true});await assertPrivate(path.join(dir,'keys.json'));
 const keys=JSON.parse(await fs.readFile(path.join(dir,'keys.json'),'utf8'));if(keys.format!==1||!/^[a-f0-9]{64}$/.test(keys.auth)||!/^[a-f0-9]{64}$/.test(keys.encryption))throw Error('local_custody_keys_invalid');
 const privateKey=createPrivateKey(keys.privateKey),publicKey=createPublicKey(keys.publicKey),file=path.join(dir,'witness.sqlite');
 if(!create)await fs.access(file);const db=new DatabaseSync(file);let archive;
 const store=value=>{const signed={value,signature:sign(null,Buffer.from(canonical(object(value))),privateKey).toString('base64')};db.prepare('INSERT INTO checkpoints(value) VALUES(?)').run(JSON.stringify(signed));return signed;};
 try{
 db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
 if(create){db.exec("CREATE TABLE checkpoints(id INTEGER PRIMARY KEY,value TEXT NOT NULL); CREATE TRIGGER immutable_update BEFORE UPDATE ON checkpoints BEGIN SELECT RAISE(ABORT,'append_only'); END; CREATE TRIGGER immutable_delete BEFORE DELETE ON checkpoints BEGIN SELECT RAISE(ABORT,'append_only'); END;");store({head:emptyHead(keys.archiveId),epoch:0,mode:'NORMAL',repairDigest:ZERO});}
 const read=()=>{const row=db.prepare('SELECT value FROM checkpoints ORDER BY id DESC LIMIT 1').get();if(!row)throw Error('local_witness_missing');return JSON.parse(row.value);};
 const writer={read:async()=>read(),advance:async(expected,head)=>{db.exec('BEGIN IMMEDIATE');try{if(!same(read().value,expected)||expected.mode!=='NORMAL'||head.archiveId!==expected.head.archiveId||head.size<=expected.head.size)throw Error('local_witness_cas_denied');const r=store({...expected,head});db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 const config={file:path.join(dir,'archive.sqlite'),archiveId:keys.archiveId,witness:writer,witnessKey:publicKey,authenticationKey:Buffer.from(keys.auth,'hex'),encryptionKeys:new Map([['v1',Buffer.from(keys.encryption,'hex')]]),activeKey:'v1',tenants:['synthetic-a','synthetic-b']};
 archive=await (create?IndexedArchive.create(config):IndexedArchive.open(config));
 if(create){await fs.chmod(file,0o600);await fs.chmod(config.file,0o600);}
 return {archive,archiveId:keys.archiveId,close(){archive.close();db.exec('PRAGMA wal_checkpoint(TRUNCATE)');db.close();}};
 }catch(e){try{archive?.close();}catch{}db.close();throw e;}
}
