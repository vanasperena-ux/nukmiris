import { setTimeout as wait } from 'node:timers/promises';
import type { EvidenceStore } from '../ports.js';
import { ArchiveBusyError, ArchivePendingError, ArchiveHeldError, ArchiveDeadlineError, archiveDeadline } from '../infrastructure/archive/availability.js';

export const archiveTransient=(e:unknown):boolean=>e instanceof ArchiveBusyError||e instanceof ArchivePendingError||e instanceof ArchiveDeadlineError||(e instanceof ArchiveHeldError&&e.reason==='CHECKPOINT_MISMATCH');
const wrappers=new WeakMap<EvidenceStore,{base:EvidenceStore;budgetMs:number}>();
function budget(ms:number):void {if(!Number.isSafeInteger(ms)||ms<1||ms>10000)throw new Error('archive_caller_budget');}
/** Five read-only attempts maximum; the budget includes queue wait and each whole facade call. */
export async function archiveRead<T>(read:()=>Promise<T>,budgetMs=1000):Promise<T> {
  budget(budgetMs);
  const end=performance.now()+budgetMs,backoff=[25,50,100,200];
  for(let i=0;;i++)try{return await archiveDeadline(read(),end-performance.now(),'CALLER');}
  catch(e){if(!archiveTransient(e)||i===4||performance.now()+(backoff[i]??0)>=end)throw e;await wait(backoff[i]);}
}
/** Writes get one invocation only; timeout/unknown outcome is reconciled by the original key. */
export function boundedArchive(a:EvidenceStore,budgetMs=1000):EvidenceStore {
  budget(budgetMs);const prior=wrappers.get(a);if(prior?.budgetMs===budgetMs)return a;a=prior?.base??a;
  const wrapped:EvidenceStore={ ...(a.businessId?{businessId:a.businessId}:{}),
    lookup:k=>archiveRead(()=>a.lookup(k),budgetMs),verify:s=>archiveRead(()=>a.verify(s),budgetMs),records:()=>archiveRead(()=>a.records(),budgetMs),
    ensure:(...args)=>archiveDeadline(a.ensure(...args),budgetMs,'CALLER')
  };
  wrappers.set(wrapped,{base:a,budgetMs});return wrapped;
}
