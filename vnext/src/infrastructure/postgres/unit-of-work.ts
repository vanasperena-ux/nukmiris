import pg from 'pg';
import type { Faults } from '../../domain/protocol.js';
import { noFaults } from '../../domain/protocol.js';
import type { EvidenceStore, Seal } from '../../ports.js';

pg.types.setTypeParser(1184,value=>new Date(value).toISOString());

export interface FixtureConnection { host: string; database: string; user: string; port?: number; password?:string }
export class UnitOfWork {
  readonly pool: pg.Pool;
  constructor(config: FixtureConnection) {
    // No DATABASE_URL/.env/provider fallback. Only the explicitly named local fixture.
    if (!(config.database.startsWith('nukmiris_wp1_')||/^nukmiris_vnext_[a-f0-9]{32}(?:_test_[a-f0-9]{8})?$/.test(config.database)) || !config.user.startsWith('wp1_') ||
      !(config.host.startsWith('/tmp/nukmiris-wp1-') || (config.host==='127.0.0.1'&&Number.isInteger(config.port)&&config.port!>=1024&&config.port!<=65535))) throw new Error('synthetic_database_only');
    this.pool=new pg.Pool({...config,max:8,connectionTimeoutMillis:5000,statement_timeout:10000,options:'-c timezone=UTC'});
  }
  async tx<T>(business: string,body: (db: pg.PoolClient)=>Promise<T>,point='',faults: Faults=noFaults): Promise<T> {
    const db=await this.pool.connect();
    try {
      await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await db.query("SELECT set_config('wp1.business_id',$1,true)",[business]);
      const result=await body(db);
      await faults.hit(point+'.beforeCommit');
      await db.query('COMMIT');
      // A lost COMMIT response is deliberately indistinguishable from this cut.
      // The caller MUST NOT receive an invocation permit if this throws.
      await faults.hit(point+'.afterCommit');
      return result;
    } catch(error) {
      await db.query('ROLLBACK').catch(()=>{});
      throw error;
    } finally { db.release(); }
  }
  async seal(business: string,archive: EvidenceStore,seal: Seal): Promise<void> {
    await archive.verify(seal);
    await this.tx(business,async db=>{await db.query('SELECT core.register_seal($1,$2,$3,$4,$5)',[business,seal.key,seal.kind,seal.digest,seal]);});
  }
  async close(): Promise<void> { await this.pool.end(); }
}
