import {digest} from '../domain/protocol.js';
import type {EvidenceStore} from '../ports.js';
import type {UnitOfWork} from '../infrastructure/postgres/unit-of-work.js';
/** Suspension commits before archive availability. Failure never reactivates it.
 * Recovery independently suspends every restored business even if this tail is lost. */
export async function setBusinessStatus(args:{businessId:string;value:'ACTIVE'|'SUSPENDED';expected:number;evidenceId:string;operator:UnitOfWork;sealer:UnitOfWork;archive:EvidenceStore}):Promise<void> {
 const {businessId:b,value,expected,evidenceId:id,operator,sealer,archive}=args;
 const body={businessId:b,value,expected,id},d=digest(body);let key='';
 if(value==='ACTIVE') {
  const seal=await archive.ensure('reactivate/'+id,'REACTIVATE',body);
  await sealer.seal(b,archive,seal);key=seal.key;
 }
 await operator.tx(b,db=>db.query('SELECT core.set_status($1,$2,$3,$4,$5,$6)',[b,value,id,d,expected,key]));
 if(value==='SUSPENDED')await archive.ensure('suspend/'+id,'SUSPEND',body);
}
