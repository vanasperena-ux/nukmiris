// Additive, stopped-writer synthetic upgrade; never re-run the empty-fixture migrations.
import {promises as fs} from 'node:fs';
import pg from 'pg';
import {connection,owned,startDatabase} from './fixture.mjs';
import {backup,stopWorker} from './runtime.mjs';
import {verifyBundle} from './coherent-backup.mjs';
export async function upgrade(s,confirmation){
 if(confirmation!==s.id)throw Error('upgrade_requires_exact_instance_id');
 if(!s.application||s.application.restored)throw Error('upgrade_requires_active_synthetic_profile');
 await owned(s);await stopWorker(s);await startDatabase(s);
 const db=new pg.Client(connection(s));await db.connect();
 try{
  const installed=(await db.query("SELECT to_regclass('core.local_support_message') IS NOT NULL AS support,to_regprocedure('core.local_support_route_v2()') IS NOT NULL AS routing")).rows[0];
  if(installed.support&&installed.routing)return {upgraded:false,alreadyCurrent:true,instance:s.id,mode:'SYNTHETIC_STOPPED'};
  const saved=await backup(s);const manifest=await verifyBundle(saved.directory,saved.manifestSha256);
  if(manifest.sourceInstance!==s.id||manifest.sourceDatabase!==s.database)throw Error('upgrade_backup_identity_denied');
  const appliedMigrations=[...(installed.support?[]:['008-local-corrections.sql']),'009-local-review-corrections.sql'];
  await db.query('BEGIN');
  try{for(const file of appliedMigrations)await db.query(await fs.readFile(new URL('../src/infrastructure/postgres/migrations/'+file,import.meta.url),'utf8'));await db.query('COMMIT');}
  catch(error){await db.query('ROLLBACK');throw error;}
  return {upgraded:true,instance:s.id,mode:'SYNTHETIC_STOPPED',automaticActivation:false,appliedMigrations,backup:saved,identitiesAndProtectedWorkPreserved:true};
 }finally{await db.end();}
}
