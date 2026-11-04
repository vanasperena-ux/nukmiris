/** Availability signals never prove that a prior write rolled back or authorize a resend. */
export class ArchiveBusyError extends Error {
  readonly code='ARCHIVE_BUSY';
  constructor(readonly reason:'INSTANCE_QUEUE_FULL'|'INSTANCE_ACTIVE'|'SQLITE_BUSY'|'SQLITE_LOCKED',cause?:unknown) {
    super('archive_busy:'+reason,cause===undefined?undefined:{cause});this.name='ArchiveBusyError';
  }
}
/** May be an in-flight append OR a crashed writer. No age-based takeover is allowed. */
export class ArchivePendingError extends Error {
  readonly code='ARCHIVE_PENDING_CONFIRMATION';
  constructor(){super('archive_held:pending_confirmation');this.name='ArchivePendingError';}
}
export class ArchiveHeldError extends Error {
  readonly code='ARCHIVE_HELD';
  constructor(readonly reason:'REPAIR_FENCE'|'CHECKPOINT_MISMATCH') {
    super('archive_held:'+reason);this.name='ArchiveHeldError';
  }
}
export function archiveError(error:unknown):unknown {
  if(error&&typeof error==='object') {
    const e=error as {code?:unknown;errcode?:unknown};
    const base=typeof e.errcode==='number'?e.errcode&255:undefined;
    if(base===5||e.code==='SQLITE_BUSY')return new ArchiveBusyError('SQLITE_BUSY',error);
    if(base===6||e.code==='SQLITE_LOCKED')return new ArchiveBusyError('SQLITE_LOCKED',error);
  }
  return error; // Integrity, disk, witness and programmer errors are never mislabeled as contention.
}

/** FIFO connection ownership spans awaits, including witness I/O and pending confirmation. */
export class ArchiveMutex {
  private tail:Promise<void>=Promise.resolve();
  private pending=0;
  get active():boolean{return this.pending>0;}
  async run<T>(work:()=>Promise<T>):Promise<T> {
    // Bounded memory, including the active operation; overload is explicit, never a lock steal.
    if(this.pending>=64)throw new ArchiveBusyError('INSTANCE_QUEUE_FULL');
    this.pending++;const before=this.tail;let release!:()=>void;
    this.tail=new Promise<void>(resolve=>{release=resolve;});await before;
    try{return await work();}finally{this.pending--;release();}
  }
}
