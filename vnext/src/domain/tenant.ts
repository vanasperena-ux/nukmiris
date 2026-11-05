import type { Json } from './protocol.js';
import { depth } from './protocol.js';

/** The sealed-body tenant identifier is a canonical lower-case ASCII slug. */
export function tenantId(value:unknown):string {
  if(typeof value!=='string'||value.length>64||/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.exec(value)?.[0]!==value)throw new Error('tenant_identifier_noncanonical');
  return value;
}
/** No aliases: SQL snake_case snapshots/raw bytes have separate custody/schema boundaries. */
export function tenantBindings(value:Json,expected?:string):void {
  depth(value);
  function walk(v:Json):void {
    if(Array.isArray(v))for(const item of v)walk(item);
    else if(v&&typeof v==='object')for(const [key,item] of Object.entries(v)) {
      const normalized=key.toLowerCase().replace(/[^a-z0-9]/g,'');
      if(normalized==='businessid'||normalized==='tenantid') {
        if(key!=='businessId')throw new Error('tenant_binding_key_unsupported');
        if(expected!==undefined&&item!==expected)throw new Error('archive_foreign_body');tenantId(item);
      }
      walk(item);
    }
  }
  if(expected!==undefined)tenantId(expected);walk(value);
}
