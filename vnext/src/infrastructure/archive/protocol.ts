import { verify, type KeyObject } from 'node:crypto';
import { canonical, digest, object } from '../../domain/protocol.js';

export interface Ref { key: string; hash: string; height: number }
export interface Head { archiveId: string; size: number; tip: string; root: Ref | null }
export interface Checkpoint { head: Head; epoch: number; mode: 'NORMAL' | 'REPAIR'; repairDigest: string }
export interface SignedCheckpoint { value: Checkpoint; signature: string }
/** Writer capability deliberately excludes fencing/repair and the signing key. */
export interface ArchiveWitness {
  read(): Promise<SignedCheckpoint>;
  advance(expected: Checkpoint, head: Head): Promise<SignedCheckpoint>;
}
/** Obtained from a separate operator authority, never by elapsed lock age. */
export interface RepairPermit {
  fenced: SignedCheckpoint;
  finish(head: Head, repairDigest: string): Promise<SignedCheckpoint>;
}
export const ZERO = '0'.repeat(64);
export const same = (a: unknown, b: unknown): boolean => canonical(object(a)) === canonical(object(b));
export const emptyHead = (archiveId: string): Head => ({ archiveId, size: 0, tip: ZERO, root: null });
export function authenticate(signed: SignedCheckpoint, key: KeyObject, archiveId: string): Checkpoint {
  if (!verify(null, Buffer.from(canonical(object(signed.value))), key, Buffer.from(signed.signature, 'base64')))
    throw new Error('archive_witness_signature');
  const c = signed.value;
  if (c.head.archiveId !== archiveId || !Number.isSafeInteger(c.head.size) || c.head.size < 0 ||
      !Number.isSafeInteger(c.epoch) || c.epoch < 0 || !['NORMAL','REPAIR'].includes(c.mode) ||
      !/^[a-f0-9]{64}$/.test(c.head.tip) || !/^[a-f0-9]{64}$/.test(c.repairDigest) ||
      (c.head.size === 0 && !same(c.head, emptyHead(archiveId))) || (c.head.size > 0 && !c.head.root))
    throw new Error('archive_witness_invalid');
  return c;
}
export const headDigest = (head: Head): string => digest(object(head));
