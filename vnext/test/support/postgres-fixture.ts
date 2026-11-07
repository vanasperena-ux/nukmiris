import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import { UnitOfWork } from '../../src/infrastructure/postgres/unit-of-work.js';
import type { Snapshot } from '../../src/application/restore-inert.js';
import type { ObjectValue,Faults } from '../../src/domain/protocol.js';
import { noFaults } from '../../src/domain/protocol.js';
import { FakeArchive } from './fake-archive.js';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {stopFixtureChildren} from './cleanup.js';
import type { Route } from '../../src/application/admit-input.js';
import { fixtureCustody } from './custody.js';

const exec=promisify(execFile);
export const IMAGE='postgres@sha256:839fbb5a4942a7758dd93e18b42ea5649807491a0545b5eeeb8f0b8bb11857a5';
export async function docker(args:string[]):Promise<string> {
  const env={...process.env};
  for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[key];
  const result=await exec('docker',['--host=unix:///var/run/docker.sock',...args],{env,maxBuffer:1024*1024});
  return (result.stdout+(args[0]==='logs'?'\n'+result.stderr:'')).trim();
}
export async function startCluster():Promise<{directory:string;socket:string;name:string;version:string;stop:()=>Promise<void>}> {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-wp1-'));
  const socket=path.join(directory,'socket');await fs.mkdir(socket,{mode:0o777});await fs.chmod(socket,0o777);
  const name='nukmiris-wp1-'+randomUUID();
  await docker(['run','--detach','--name',name,'--network','none','--label','nukmiris.wp1=synthetic',
    '--tmpfs','/var/lib/postgresql/data:rw','--mount',`type=bind,src=${socket},dst=/var/run/postgresql`,
    '-e','POSTGRES_PASSWORD=wp1-disposable-fixture-only',IMAGE,
    '-c',"listen_addresses=",'-c','fsync=on','-c','synchronous_commit=on']);
  let version='';
  for(let n=0;n<200;n++) {
    if(!(await docker(['logs',name])).includes('PostgreSQL init process complete')){await delay(100);continue;}
    const db=new pg.Client({host:socket,database:'postgres',user:'postgres',connectionTimeoutMillis:1000});
    try{await db.connect();version=String((await db.query('SHOW server_version')).rows[0]?.['server_version']);await db.end();break;}
    catch {await db.end().catch(()=>{});await delay(100);}
  }
  if(!version){const logs=await docker(['logs',name]);await docker(['rm','--force',name]);throw new Error('fixture_postgres_not_ready: '+logs);}
  return {directory,socket,name,version,stop:async()=>{await docker(['rm','--force',name]);}};
}
export const TABLES=['business','channel','calendar','resource','customer','conversation','seal','batch','input','input_classification','conversation_context','input_reduction','plan_rejection','batch_input','permission_head','permission_event','status_event','appointment','operation','mutation_guard','protection','output_intent','attempt','receipt','recovery_case','audit','local_session','local_message','local_reply','local_action','local_customer','local_booking_intent','local_ledger','local_calendar','local_diagnostic','local_support_message'] as const;
export class Fixture {
  private closed=false;
  readonly dbname='nukmiris_wp1_'+randomUUID().replaceAll('-','');
  readonly admin:pg.Pool;
  readonly roles:Record<string,UnitOfWork>={};
  readonly routes:Route[]=[];
  readonly ids:Record<string,string>={};
  readonly clock={instant:Date.parse('2030-01-01T09:00:00Z'),now(){return new Date(this.instant);}};
  readonly secret=Buffer.from('synthetic-wp1-signature-key-only');
  archive!:FakeArchive;
  get custody(){return fixtureCustody(this.archive);}
  directory='';
  constructor(readonly socket=process.env['WP1_SOCKET_PATH']??'') {
    if(!socket.startsWith('/tmp/nukmiris-wp1-'))throw new Error('fixture_socket_required');
    this.admin=new pg.Pool({host:socket,database:this.dbname,user:'postgres',max:4});
  }
  async init(seed=true,faults:Faults=noFaults):Promise<this> {
    this.directory=await fs.mkdtemp(path.join(os.tmpdir(),'nukmiris-wp1-'));
    this.archive=new FakeArchive(path.join(this.directory,'archive'),faults);await this.archive.init();
    const cluster=new pg.Client({host:this.socket,database:'postgres',user:'postgres'});await cluster.connect();
    await cluster.query(`CREATE DATABASE "${this.dbname}"`);await cluster.end();
    const root=fileURLToPath(new URL('../../../',import.meta.url));
    for(const file of ['migrations/001-foundation.sql','migrations/002-execution.sql','migrations/003-dispositions.sql','roles.sql','migrations/004-classification-and-ordering.sql','migrations/005-conversation-progress.sql','migrations/006-deadline-recovery.sql','migrations/007-local-interactive.sql','migrations/008-local-corrections.sql']) {
      await this.admin.query(await fs.readFile(path.join(root,'src/infrastructure/postgres',file),'utf8'));
    }
    await this.admin.query(`CREATE SCHEMA fixture_private; REVOKE ALL ON SCHEMA fixture_private FROM PUBLIC;
      CREATE TABLE fixture_private.clock(at_time timestamptz NOT NULL CHECK(isfinite(at_time)));
      GRANT USAGE ON SCHEMA fixture_private TO wp1_definer; GRANT SELECT ON fixture_private.clock TO wp1_definer;
      CREATE OR REPLACE FUNCTION core.authoritative_time() RETURNS timestamptz LANGUAGE sql VOLATILE SECURITY DEFINER
      SET search_path=pg_catalog,core AS 'SELECT at_time FROM fixture_private.clock';
      ALTER FUNCTION core.authoritative_time() OWNER TO wp1_definer;`);
    await this.admin.query('INSERT INTO fixture_private.clock VALUES($1)',[this.clock.now().toISOString()]);
    const fixture=this;
    class ClockedUnitOfWork extends UnitOfWork {
      override async tx<T>(...args:Parameters<UnitOfWork['tx']>):Promise<T> {
        await fixture.admin.query('UPDATE fixture_private.clock SET at_time=$1',[fixture.clock.now().toISOString()]);
        return super.tx(...args) as Promise<T>;
      }
    }
    for(const role of ['ingress','sealer','reducer','dispatch','result','operator','recovery','tenant_a','tenant_b']) {
      this.roles[role]=new ClockedUnitOfWork({host:this.socket,database:this.dbname,user:'wp1_'+role});
    }
    for(const business of ['synthetic-a','synthetic-b']) {
      for(const role of Object.keys(this.roles))if(!role.startsWith('tenant_')||role==='tenant_'+business.at(-1)) {
        await this.admin.query('INSERT INTO core.role_scope VALUES($1,$2)',['wp1_'+role,business]);
      }
      if(seed)await this.seed(business);
    }
    return this;
  }
  role(name:string):UnitOfWork {const r=this.roles[name];if(!r)throw new Error('fixture_role_unknown');return r;}
  async seed(b:string):Promise<void> {
    const channel=randomUUID(),calendar=randomUUID(),resource=randomUUID(),otherResource=randomUUID(),customer=randomUUID();
    for(const [name,value] of Object.entries({channel,calendar,resource,otherResource,customer}))this.ids[b+'.'+name]=value;
    await this.admin.query("INSERT INTO core.business VALUES($1,'ACTIVE',1,1,true)",[b]);
    await this.admin.query('INSERT INTO core.channel VALUES($1,$2,$3,$4,1,true)',[b,channel,'waba-'+b,'number-'+b]);
    await this.admin.query('INSERT INTO core.calendar VALUES($1,$2,$3,$4,1)',[b,calendar,'calendar-'+b,'synthetic-grant-'+b]);
    await this.admin.query('INSERT INTO core.resource VALUES($1,$2,$3,true),($1,$4,$3,false)',[b,resource,calendar,otherResource]);
    await this.admin.query('INSERT INTO core.customer VALUES($1,$2,$3)',[b,customer,'customer-'+b]);
    this.routes.push({businessId:b,channelId:channel,waba:'waba-'+b,numberId:'number-'+b,channelRevision:1});
  }
  id(name:string,b='synthetic-a'):string {const id=this.ids[b+'.'+name];if(!id)throw new Error('fixture_id_missing');return id;}
  async rows(table:string,b='synthetic-a'):Promise<ObjectValue[]> {
    if(!TABLES.includes(table as typeof TABLES[number])&&table!=='audit')throw new Error('table_denied');
    return (await this.admin.query(`SELECT * FROM core.${table} WHERE business_id=$1`,[b])).rows as ObjectValue[];
  }
  async snapshot():Promise<Snapshot> {
    const db=await this.admin.connect();const tables:Record<string,ObjectValue[]>={};
    try {
      await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      for(const table of TABLES)tables[table]=(await db.query(`SELECT to_jsonb(t) AS row FROM core.${table} t`)).rows.map(r=>r['row'] as ObjectValue);
      await db.query('COMMIT');return {format:1,tables};
    } finally {db.release();}
  }
  async close():Promise<void> {
    if(this.closed)return;this.closed=true;
    await stopFixtureChildren(this.dbname);
    try {
      const bytes=Buffer.from(JSON.stringify(await this.snapshot()));
      await fs.writeFile(path.join(this.directory,'pre-cleanup-snapshot.json'),bytes);
      const dir=process.env['WP1_EVIDENCE_DIRECTORY'];
      if(dir){
        await fs.mkdir(path.join(dir,'fixtures'),{recursive:true});
        await fs.writeFile(path.join(dir,'fixtures',this.dbname+'.json.gz'),gzipSync(bytes));
        await fs.appendFile(path.join(dir,'fixture-manifest.jsonl'),JSON.stringify({database:this.dbname,sha256:createHash('sha256').update(bytes).digest('hex'),localDirectory:this.directory})+'\n');
      }
    } catch(error) {
      if(this.directory)await fs.writeFile(path.join(this.directory,'capture-error.txt'),String(error));
    }
    await Promise.all(Object.values(this.roles).map(r=>r.close()));await this.admin.end();
    const cluster=new pg.Client({host:this.socket,database:'postgres',user:'postgres'});await cluster.connect();
    try {
      // Pool.end closes sockets asynchronously at the server. Do not FORCE-drop
      // a still-closing connection and turn expected cleanup into an idle error.
      for(let n=0;;n++) {
        try {await cluster.query(`DROP DATABASE IF EXISTS "${this.dbname}"`);break;}
        catch(error){if((error as {code?:string}).code!=='55006'||n>=100)throw error;await delay(20);}
      }
    } finally {await cluster.end();}
    // Failed-case evidence is retained outside the disposable database.
  }
}
