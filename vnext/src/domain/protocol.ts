import { createHash } from 'node:crypto';

export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ObjectValue = { [key: string]: Json };
export type State = 'PREPARED' | 'ARMED' | 'SUBMISSION_ENTERED' | 'UNKNOWN' | 'VERIFIED_APPLIED';
export interface Clock { now(): Date }
export interface Faults { hit(point: string): Promise<void> }
export const noFaults: Faults = { async hit() {} };

export function canonical(value: Json): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k]!)).join(',') + '}';
  }
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('nonfinite_json');
  return JSON.stringify(value);
}
export function digest(value: Json): string { return createHash('sha256').update(canonical(value)).digest('hex'); }
export function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object_required');
  return value as ObjectValue;
}
export function text(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 4096) throw new Error('text_required');
  return value;
}
export function finiteDate(value: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error('finite_instant_required');
  return new Date(value).toISOString();
}
export function uuid(value: unknown): string {
  const s = text(value);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) throw new Error('uuid_required');
  return s;
}
export function isWithdrawal(value: unknown): boolean {
  return typeof value === 'string' && /^(stop|baja recordatorios|no quiero recordatorios|no me envies recordatorios|dejar de recibir recordatorios)$/.test(
    value.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' '));
}
export function depth(value: Json, level=0): void {
  if (level>20) throw new Error('json_depth');
  if (Array.isArray(value)) for (const item of value) depth(item,level+1);
  else if (value && typeof value==='object') for (const item of Object.values(value)) depth(item,level+1);
}
