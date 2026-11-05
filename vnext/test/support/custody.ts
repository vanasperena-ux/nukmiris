import { admissionCustody,RAW_CUSTODY } from '../../src/application/admission-custody.js';
import type { EvidenceStore } from '../../src/ports.js';
export function fixtureCustody(root:{scope(b:string):EvidenceStore}) {
  return admissionCustody(root.scope(RAW_CUSTODY),new Map(['synthetic-a','synthetic-b'].map(b=>[b,root.scope(b)])));
}
