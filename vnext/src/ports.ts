import type { Json, ObjectValue } from './domain/protocol.js';

export interface Seal {
  key: string; kind: string; digest: string; body: ObjectValue;
  sequence: number; hash: string; keyVersion: string;
}
export interface EvidenceStore {
  /** Atomic fixture put-if-absent; factory runs only for original allocation. */
  ensure(key: string,kind: string,match: ObjectValue,allocate?: () => ObjectValue): Promise<Seal>;
  verify(seal: Seal): Promise<void>;
  records(): Promise<Seal[]>;
}
export interface Envelope extends ObjectValue {
  formatVersion: 1;
  businessId: string; attemptId: string; payloadDigest: string;
  recipient: string; channelId: string; channelRevision: number;
  waba: string; numberId: string; calendarId: string; calendarRevision: number; grantId: string;
  conversationId: string; businessRevision: number; recoveryEpoch: number;
  permissionRevision: number; purpose: 'CUSTOMER_REQUEST' | 'REMINDER';
  dueAt: string; deadlineAt: string; windowEnd: string; budgetSeconds: number;
  remoteId: string; payload: Json;
}
export interface AppliedProof extends ObjectValue {
  businessId: string; attemptId: string; payloadDigest: string; remoteId: string;
}
/** WP1 accepts only the test adapter; no real provider implementation exists. */
export interface SyntheticProvider {
  readonly mode: 'WP1_SYNTHETIC_ONLY';
  submitOnce(envelope: Envelope): Promise<AppliedProof>;
  readOnly(envelope: Envelope): Promise<AppliedProof | null>;
}
