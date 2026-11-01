import type { EvidenceStore } from '../ports.js';
import type { UnitOfWork } from '../infrastructure/postgres/unit-of-work.js';
import type { ObjectValue } from '../domain/protocol.js';

export interface Snapshot { format:1; tables:Record<string,ObjectValue[]> }
export interface RecoveryReport extends ObjectValue { complete:boolean; dispatchEnabled:false; newEffects:0; reason:string; evidenceRecords:number }
export async function restoreInert(args:{snapshot:Snapshot;recovery:UnitOfWork;archive:EvidenceStore}):Promise<RecoveryReport> {
  const {snapshot,recovery,archive}=args;
  if(snapshot.format!==1)throw new Error('snapshot_format_unknown');
  let records:Awaited<ReturnType<EvidenceStore['records']>>=[],complete=false,reason='archive_completeness_unknown';
  try {records=await archive.records();complete=true;reason='inert_review_required';} catch { /* Never infer an absent arm or permission from a broken archive. */ }
  // This is intentionally an inert projection, not an operational reducer replay.
  // Lost post-snapshot plans/arms remain original-identity recovery cases.
  await recovery.tx('',async db=>{await db.query('SELECT core.restore_snapshot($1,$2,$3)',[snapshot,JSON.stringify(records),reason]);});
  return {complete,dispatchEnabled:false,newEffects:0,reason,evidenceRecords:records.length};
}
