// Historical local-fixture reproduction only. Never live promotion authority.
import {readFile} from 'node:fs/promises';
import {createEvidenceVerifier,measuredClock} from '../../src/evidence-source.mjs';
import {retirementDecision} from '../../b1a/runtime/session-policy.mjs';
const v=JSON.parse(await readFile(process.argv[2],'utf8'));
if(v.scope!=='LOCAL_PROTOCOL_AND_NATIVE_SIGNALS_NOT_GCP'||v.testedSource!=='ecc085f3a2e413c9f3a228066292b81ad9c1be73')throw Error('exact_historical_source_and_scope_required');
const now=v.result.evidenceCompletedAt,verify=createEvidenceVerifier({sessionId:v.fence.sessionId,now:()=>now,maxEnvelopeAgeMs:3600000,trustedSources:[{role:'INDEPENDENT_OBSERVER',issuer:v.fence.issuer,keyId:v.observerKeyId,publicKey:v.observerPublicKey,types:['FENCE','ACTIVITY','CLOCK','CANARY','LEDGER']}]});
const token=x=>verify.verify(JSON.stringify(x));const result=retirementDecision({fence:token(v.fence),clock:token(v.clock),clocks:[token(v.platformClock)],canary:token(v.canary),ledger:token(v.ledger),ledgerRecords:v.ledgerRecords,now,uncertaintyMs:measuredClock(v.clock.payload).uncertaintyMs});
if(result.state!=='EVIDENCE_READY'||result.evidenceDigest!==v.result.evidenceDigest)throw Error('historical_retirement_result_mismatch');
console.log(JSON.stringify({scope:'HISTORICAL_LOCAL_REPRODUCTION_ONLY',testedSource:v.testedSource,result,canaries:v.canary.payload.trials.length,authenticatedSignaturesVerified:true,livePromotionAuthorized:false},null,2));
