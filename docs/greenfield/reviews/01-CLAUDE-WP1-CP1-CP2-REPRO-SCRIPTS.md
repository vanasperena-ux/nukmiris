# WP1 review: SQL reproduction scripts (PG 16.15, Codex migrations + roles.sql unmodified)

Run order: setup.sh <db>, then the t*.sh scripts. Findings: t2=CR-002, t3=CR-003, t4/t5=CR-007, t6/t6b=CR-004, t7=CR-012/014, t8=CR-010, restore in transcript=CR-008. Scripts assume a local socket at /tmp/nukmiris-wp1-review/socket.

## setup.sh
```bash
#!/bin/bash
# usage: setup.sh dbname
S=/tmp/nukmiris-wp1-review/socket; DB=$1
P=/home/claude/vanasperena-ux/nukmiris/vnext/src/infrastructure/postgres
psql -q -h $S -U postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB" 
for f in migrations/001-foundation.sql migrations/002-execution.sql roles.sql; do psql -q -h $S -U postgres -d $DB -v ON_ERROR_STOP=1 -f $P/$f >/dev/null || echo FAIL $f; done
psql -q -h $S -U postgres -d $DB -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO core.role_scope SELECT r,b FROM unnest(ARRAY['wp1_ingress','wp1_sealer','wp1_reducer','wp1_dispatch','wp1_result','wp1_operator','wp1_recovery']) r, unnest(ARRAY['synthetic-a','synthetic-b']) b;
INSERT INTO core.role_scope VALUES('wp1_tenant_a','synthetic-a'),('wp1_tenant_b','synthetic-b');
INSERT INTO core.business VALUES('synthetic-a','ACTIVE',1,1,true),('synthetic-b','ACTIVE',1,1,true);
INSERT INTO core.channel VALUES('synthetic-a','00000000-0000-4000-8000-0000000000a1','waba-a','num-a',1,true),('synthetic-b','00000000-0000-4000-8000-0000000000b1','waba-b','num-b',1,true);
INSERT INTO core.calendar VALUES('synthetic-a','00000000-0000-4000-8000-0000000000a2','cal-a','grant-a',1),('synthetic-b','00000000-0000-4000-8000-0000000000b2','cal-b','grant-b',1);
INSERT INTO core.resource VALUES('synthetic-a','00000000-0000-4000-8000-0000000000a3','00000000-0000-4000-8000-0000000000a2',true),('synthetic-b','00000000-0000-4000-8000-0000000000b3','00000000-0000-4000-8000-0000000000b2',true);
INSERT INTO core.customer VALUES('synthetic-a','00000000-0000-4000-8000-0000000000a4','cust-a'),('synthetic-b','00000000-0000-4000-8000-0000000000b4','cust-b');
SQL
echo setup-done
```

## lib.sh
```bash
S=/tmp/nukmiris-wp1-review/socket
H64=$(printf 'a%.0s' $(seq 64))
# as ROLE BUSINESS DB 'sql ...'  (runs inside one tx with scope set)
as(){ local role=$1 b=$2 db=$3; shift 3; psql -X -q -t -A -h $S -U wp1_$role -d $db -v ON_ERROR_STOP=1 -c "BEGIN" -c "SELECT set_config('wp1.business_id','$b',true)" -c "$*" -c "COMMIT" 2>&1 | grep -v -E '^(BEGIN|COMMIT|set_config|)$|^\s*$' ; }
adm(){ psql -X -q -t -A -h $S -U postgres -d $1 -c "$2" 2>&1; }
```

## plan.sh
```bash
# usage: . plan.sh ; defines mkplan DB TAG INPUTID  (registers OPERATION_PLAN seal, calls prepare_operation)
mkplan(){
 local DB=$1 TAG=$2 IN=$3 B=${4:-synthetic-a}
 local CH=00000000-0000-4000-8000-0000000000a1 CAL=00000000-0000-4000-8000-0000000000a2 RES=00000000-0000-4000-8000-0000000000a3 CU=00000000-0000-4000-8000-0000000000a4
 local OP=5$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa AT=6$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa AP=7$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa OUT=8$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa
 local PD=$(printf 'c%.0s' $(seq 64)) SD=$(printf 'd%.0s' $(seq 64))
 PLAN='{"businessId":"'$B'","inputId":"'$IN'","customerId":"'$CU'","calendarId":"'$CAL'","resourceId":"'$RES'","kind":"CREATE","appointmentId":"'$AP'","eventId":"ev-'$TAG'","expectedRevision":1,"startAt":"2030-01-02T'${SH:-10}':00:00Z","endAt":"2030-01-02T'${EH:-11}':00:00Z","bufferMinutes":0,"outputPurpose":"'${OPURP:-CUSTOMER_REQUEST}'","operationId":"'$OP'","attemptId":"'$AT'","outputId":"'$OUT'","payloadDigest":"'$PD'","outputPayload":{"x":1},"outputDigest":"'$SD'","outputDueAt":"2030-01-01T09:00:00Z","outputDeadlineAt":"2030-01-01T09:15:00Z","envelope":{"formatVersion":1,"businessId":"'$B'","attemptId":"'$AT'","payloadDigest":"'$PD'","recipient":"cust-a","channelId":"'$CH'","channelRevision":1,"waba":"waba-a","numberId":"num-a","calendarId":"'$CAL'","calendarRevision":1,"grantId":"grant-a","conversationId":"11111111-1111-4111-8111-111111111111","businessRevision":1,"recoveryEpoch":1,"permissionRevision":0,"purpose":"CUSTOMER_REQUEST","dueAt":"2030-01-01T09:00:00Z","deadlineAt":"2030-01-01T09:15:00Z","windowEnd":"2030-01-02T09:00:00Z","budgetSeconds":2,"remoteId":"ev-'$TAG'","payload":{"kind":"CREATE"}}}'
 PLAN_ATT=$AT PLAN_OP=$OP PLAN_OUT=$OUT PLAN_AP=$AP
 as sealer $B $DB "SELECT core.register_seal('$B','plan-$TAG','OPERATION_PLAN','$SD','{\"key\":\"plan-$TAG\",\"kind\":\"OPERATION_PLAN\",\"digest\":\"$SD\",\"body\":$PLAN}'::jsonb)" >/dev/null
 as reducer $B $DB "SELECT core.prepare_operation('$B','$PLAN'::jsonb,'$SD','plan-$TAG')"
}
armseal(){ # DB TAG OWNER
 local DB=$1 TAG=$2 OWN=$3 B=${4:-synthetic-a}
 local env=$(adm $DB "select envelope::text from core.attempt where id='6$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa'")
 local pd=$(adm $DB "select payload_digest from core.attempt where id='6$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa'")
 local AD=$(printf 'e%.0s' $(seq 64))
 as sealer $B $DB "SELECT core.register_seal('$B','arm-$TAG','ARM','$AD','{\"key\":\"arm-$TAG\",\"kind\":\"ARM\",\"digest\":\"$AD\",\"body\":{\"attemptId\":\"6$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa\",\"ownerId\":\"$OWN\",\"payloadDigest\":\"$pd\",\"envelope\":$env}}'::jsonb)" >/dev/null
 as dispatch $B $DB "SELECT core.arm('$B','6$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa','$OWN','arm-$TAG','$AD')"
}

resultseal(){ # DB TAG : sealed RESULT + apply_result for operation attempt
 local DB=$1 TAG=$2 B=${3:-synthetic-a}; local A=6$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa
 local pd=$(adm $DB "select payload_digest from core.attempt where id='$A'"); local RD=$(printf 'f%.0s' $(seq 64))
 local PROOF='{"businessId":"'$B'","attemptId":"'$A'","payloadDigest":"'$pd'","remoteId":"ev-'$TAG'"}'
 as sealer $B $DB "SELECT core.register_seal('$B','res-$TAG','RESULT','$RD','{\"key\":\"res-$TAG\",\"kind\":\"RESULT\",\"digest\":\"$RD\",\"body\":$PROOF}'::jsonb)" >/dev/null
 as result $B $DB "SELECT core.apply_result('$B','$A','$PROOF'::jsonb,'res-$TAG','$RD')"
}
mkout(){ # DB TAG PURPOSE_ENV : prepare_output for output of operation TAG, envelope purpose = $3 (default row purpose)
 local DB=$1 TAG=$2 EPURP=${3:-CUSTOMER_REQUEST} B=${4:-synthetic-a}; local O=8$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa; local A=9$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa
 local SD=$(printf 'd%.0s' $(seq 64)) OD=$(printf '7%.0s' $(seq 64))
 local rev=$(adm $DB "select revision from core.permission_head where subject='cust-a'"); rev=${rev:-0}
 OENV='{"formatVersion":1,"businessId":"'$B'","attemptId":"'$A'","outputId":"'$O'","payloadDigest":"'$SD'","recipient":"cust-a","channelId":"00000000-0000-4000-8000-0000000000a1","channelRevision":1,"waba":"waba-a","numberId":"num-a","calendarId":"00000000-0000-4000-8000-0000000000a2","calendarRevision":1,"grantId":"grant-a","conversationId":"11111111-1111-4111-8111-111111111111","businessRevision":1,"recoveryEpoch":1,"permissionRevision":'$rev',"purpose":"'$EPURP'","dueAt":"2030-01-01T09:00:00Z","deadlineAt":"2030-01-01T09:15:00Z","windowEnd":"2030-01-02T09:00:00Z","budgetSeconds":2,"remoteId":"fake-'$TAG'","payload":{"x":1}}'
 as sealer $B $DB "SELECT core.register_seal('$B','out-$TAG','OUTPUT_PLAN','$OD','{\"key\":\"out-$TAG\",\"kind\":\"OUTPUT_PLAN\",\"digest\":\"$OD\",\"body\":{\"attemptId\":\"$A\",\"outputId\":\"$O\",\"envelope\":$OENV}}'::jsonb)" >/dev/null
 as reducer $B $DB "SELECT core.prepare_output('$B','$O','$A','$OENV'::jsonb,'$SD','out-$TAG','$OD')"
}
armout(){ # DB TAG OWNER
 local DB=$1 TAG=$2 OWN=$3 B=${4:-synthetic-a}; local A=9$TAG-aaaa-4aaa-8aaa-aaaaaaaaaaaa; local AD=$(printf 'e%.0s' $(seq 64))
 local env=$(adm $DB "select envelope::text from core.attempt where id='$A'"); local pd=$(adm $DB "select payload_digest from core.attempt where id='$A'")
 as sealer $B $DB "SELECT core.register_seal('$B','armo-$TAG','ARM','$AD','{\"key\":\"armo-$TAG\",\"kind\":\"ARM\",\"digest\":\"$AD\",\"body\":{\"attemptId\":\"$A\",\"ownerId\":\"$OWN\",\"payloadDigest\":\"$pd\",\"envelope\":$env}}'::jsonb)" >/dev/null
 as dispatch $B $DB "SELECT core.arm('$B','$A','$OWN','armo-$TAG','$AD')"
}
```

## mkinput.fn
```bash
mkinput () 
{ 
    local N=$1 P=$2 ID=$3;
    local D=$(printf "$N%.0s" $(seq 64));
    local ITEM='[{"channelId":"'$CH'","waba":"waba-a","numberId":"num-a","channelRevision":1,"conversationId":"11111111-1111-4111-8111-111111111111","subject":"cust-a","providerId":"'$P'","inputId":"'$ID'","digest":"'$D'","event":{"type":"text","id":"'$P'","from":"cust-a","text":{"body":"synthetic fixed command"}},"receivedAt":"2030-01-01T09:00:00Z"}]';
    as ingress $B $DB "SELECT core.stage_batch('$B','b$N','$D','$ITEM'::jsonb)" > /dev/null;
    as sealer $B $DB "SELECT core.register_seal('$B','bc$N','BATCH_COMMIT','$D','{\"key\":\"bc$N\",\"kind\":\"BATCH_COMMIT\",\"digest\":\"$D\",\"body\":{\"batchId\":\"b$N\",\"batchDigest\":\"$D\"}}'::jsonb)" > /dev/null;
    as ingress $B $DB "SELECT core.activate_batch('$B','b$N','bc$N','$D')" > /dev/null
}
```

## t2.sh
```bash
. ./lib.sh
DB=rv1; B=synthetic-a
CH=00000000-0000-4000-8000-0000000000a1
D1=$(printf '1%.0s' $(seq 64)); D3=$(printf '3%.0s' $(seq 64))
ITEM='[{"channelId":"'$CH'","waba":"waba-a","numberId":"num-a","channelRevision":1,"conversationId":"11111111-1111-4111-8111-111111111111","subject":"cust-a","providerId":"p-EXTRA","inputId":"31111111-1111-4111-8111-111111111111","digest":"'$D3'","event":{"type":"text","id":"p-EXTRA","from":"cust-a","text":{"body":"synthetic fixed command"}},"receivedAt":"2030-01-01T09:00:00Z"}]'
echo "T2 re-stage extra item into already ELIGIBLE sealed batch (same batch id + digest):"
as ingress $B $DB "SELECT core.stage_batch('$B','batch1','$D1','$ITEM'::jsonb)"
adm $DB "select providerid_dummy from (select 1) x" >/dev/null 2>&1
adm $DB "select provider_id,state from core.input order by sequence"
echo "re-activate with ORIGINAL seal (seal body never mentioned the extra input):"
as ingress $B $DB "SELECT core.activate_batch('$B','batch1','bc1','$D1')"
adm $DB "select provider_id,state from core.input order by sequence"
adm $DB "select input_id from core.batch_input where batch_id='batch1'"
```

## t3.sh
```bash
. ./lib.sh; . ./plan.sh
DB=rv1; B=synthetic-a; IN=21111111-1111-4111-8111-111111111111
OWN=99999999-9999-4999-8999-999999999999
echo "prepare:"; mkplan $DB 1111111 $IN
echo "arm:"; armseal $DB 1111111 $OWN
A=61111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa
echo "enter_submission after deadline (09:15) -> at 2030-01-01T12:00Z (expect f):"
as dispatch $B $DB "SELECT core.enter_submission('$B','$A','$OWN','2030-01-01T12:00:00Z')" 
echo "enter_submission with NULL at_time (expect f if safe):"
as dispatch $B $DB "SELECT core.enter_submission('$B','$A','$OWN',NULL)"
adm $DB "select state from core.attempt where id='$A'"
```

## t4.sh
```bash
. ./lib.sh; . ./plan.sh
DB=rv2; B=synthetic-a
./setup.sh $DB >/dev/null 2>&1
CH=00000000-0000-4000-8000-0000000000a1
mkinput(){ # tag seqnum provider ; stage+seal+activate one input
 local N=$1 P=$2 ID=$3 BODY=${4:-synthetic fixed command}; local D=$(printf "$N%.0s" $(seq 64))
 local ITEM='[{"channelId":"'$CH'","waba":"waba-a","numberId":"num-a","channelRevision":1,"conversationId":"11111111-1111-4111-8111-111111111111","subject":"cust-a","providerId":"'$P'","inputId":"'$ID'","digest":"'$D'","event":{"type":"text","id":"'$P'","from":"cust-a","text":{"body":"'"$BODY"'"}},"receivedAt":"2030-01-01T09:00:00Z"}]'
 as ingress $B $DB "SELECT core.stage_batch('$B','b$N','$D','$ITEM'::jsonb)" >/dev/null
 as sealer $B $DB "SELECT core.register_seal('$B','bc$N','BATCH_COMMIT','$D','{\"key\":\"bc$N\",\"kind\":\"BATCH_COMMIT\",\"digest\":\"$D\",\"body\":{\"batchId\":\"b$N\",\"batchDigest\":\"$D\"}}'::jsonb)" >/dev/null
 [ "$5" = "nosealactivate" ] || as ingress $B $DB "SELECT core.activate_batch('$B','b$N','bc$N','$D')" >/dev/null
}
# T4: ordering. input 1 (seq1) left STAGED (never activated); input 2 (seq2) eligible -> executes first
mkinput 1 pA 21111111-1111-4111-8111-111111111111 "synthetic fixed command" nosealactivate
mkinput 2 pB 22222222-2222-4222-8222-222222222222
adm $DB "select provider_id,sequence,state from core.input order by sequence"
echo "prepare op for seq2 while seq1 still STAGED:"; mkplan $DB 2222222 22222222-2222-4222-8222-222222222222
OWN=99999999-9999-4999-8999-999999999999
armseal $DB 2222222 $OWN
echo "enter_submission seq2 op while earlier seq1 unsealed:"
as dispatch $B $DB "SELECT core.enter_submission('$B','62222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa','$OWN','2030-01-01T09:01:00Z')"
```

## t5.sh
```bash
. ./lib.sh; . ./plan.sh
DB=rv3; B=synthetic-a; ./setup.sh $DB >/dev/null 2>&1
CH=00000000-0000-4000-8000-0000000000a1
mkinput(){ local N=$1 P=$2 ID=$3; local D=$(printf "$N%.0s" $(seq 64))
 local ITEM='[{"channelId":"'$CH'","waba":"waba-a","numberId":"num-a","channelRevision":1,"conversationId":"11111111-1111-4111-8111-111111111111","subject":"cust-a","providerId":"'$P'","inputId":"'$ID'","digest":"'$D'","event":{"type":"text","id":"'$P'","from":"cust-a","text":{"body":"synthetic fixed command"}},"receivedAt":"2030-01-01T09:00:00Z"}]'
 as ingress $B $DB "SELECT core.stage_batch('$B','b$N','$D','$ITEM'::jsonb)" >/dev/null
 as sealer $B $DB "SELECT core.register_seal('$B','bc$N','BATCH_COMMIT','$D','{\"key\":\"bc$N\",\"kind\":\"BATCH_COMMIT\",\"digest\":\"$D\",\"body\":{\"batchId\":\"b$N\",\"batchDigest\":\"$D\"}}'::jsonb)" >/dev/null
 as ingress $B $DB "SELECT core.activate_batch('$B','b$N','bc$N','$D')" >/dev/null; }
declare -f mkinput > mkinput.fn
mkinput 1 pA 21111111-1111-4111-8111-111111111111
mkinput 2 pB 22222222-2222-4222-8222-222222222222
OWN=99999999-9999-4999-8999-999999999999
SH=10 EH=11 mkplan $DB 1111111 21111111-1111-4111-8111-111111111111 >/dev/null
SH=13 EH=14 mkplan $DB 2222222 22222222-2222-4222-8222-222222222222 >/dev/null
armseal $DB 1111111 $OWN >/dev/null; armseal $DB 2222222 $OWN >/dev/null
echo "seq1 op enter (then left unresolved, e.g. lost response):"; as dispatch $B $DB "SELECT core.enter_submission('$B','61111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','$OWN','2030-01-01T09:01:00Z')"
echo "seq2 op enter + result:"; as dispatch $B $DB "SELECT core.enter_submission('$B','62222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa','$OWN','2030-01-01T09:01:00Z')"
resultseal $DB 2222222
echo "output for seq2:"; mkout $DB 2222222
armout $DB 2222222 $OWN
echo "enter_submission of seq2 customer message while seq1 operation outcome is UNKNOWN/unresolved and seq1 output not yet existing:"
as dispatch $B $DB "SELECT core.enter_submission('$B','92222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa','$OWN','2030-01-01T09:02:00Z')"
adm $DB "select a.id::text, a.state, o.sequence from core.attempt a left join core.output_intent o on o.id=a.output_id order by 1"
```

## t6.sh
```bash
. ./lib.sh; . ./plan.sh; . ./mkinput.fn
DB=rv4; B=synthetic-a; ./setup.sh $DB >/dev/null 2>&1; CH=00000000-0000-4000-8000-0000000000a1
mkinput 1 pA 21111111-1111-4111-8111-111111111111
OWN=99999999-9999-4999-8999-999999999999
OPURP=REMINDER mkplan $DB 1111111 21111111-1111-4111-8111-111111111111 >/dev/null
armseal $DB 1111111 $OWN >/dev/null
as dispatch $B $DB "SELECT core.enter_submission('$B','61111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','$OWN','2030-01-01T09:01:00Z')" >/dev/null
resultseal $DB 1111111 >/dev/null
adm $DB "select purpose,state from core.output_intent"
echo "customer sends STOP (suppress):"
as ingress $B $DB "SELECT core.suppress('$B','cust-a','inbound:stop1','$(printf 'b%.0s' $(seq 64))','2030-01-01T09:00:30Z')"
adm $DB "select subject,suppressed,revision from core.permission_head"
echo "CONTROL: envelope purpose REMINDER (correct) -> expect f"
mkout $DB 1111111 REMINDER >/dev/null; armout $DB 1111111 $OWN >/dev/null
as dispatch $B $DB "SELECT core.enter_submission('$B','91111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','$OWN','2030-01-01T09:02:00Z')"
```

## t7.sh
```bash
. ./lib.sh
DB=rv6; B=synthetic-a; ./setup.sh $DB >/dev/null 2>&1
GD=$(printf '9%.0s' $(seq 64))
seal(){ as sealer $B $DB "SELECT core.register_seal('$B','g$1','GRANT','$GD','{\"key\":\"g$1\",\"kind\":\"GRANT\",\"digest\":\"$GD\",\"body\":{\"businessId\":\"$B\",\"subject\":\"cust-a\",\"evidenceId\":\"e$1\",\"expected\":0,\"occurredAt\":\"$2\"}}'::jsonb)" >/dev/null; }
seal 1 2031-06-01T00:00:00Z
echo "future-dated grant (occurredAt 2031) with now=2030-01-01 (expect stale_grant):"
as operator $B $DB "SELECT core.grant_permission('$B','cust-a','e1','$GD',0,'2031-06-01T00:00:00Z','2030-01-01T00:00:00Z','g1')"
echo "same with now_time NULL:"
as operator $B $DB "SELECT core.grant_permission('$B','cust-a','e1','$GD',0,'2031-06-01T00:00:00Z',NULL,'g1')"
adm $DB "select subject,suppressed,revision,last_revoke_at from core.permission_head"
echo "--- set_status replay with same evidence id/digest but different status value:"
SD=$(printf '5%.0s' $(seq 64))
as operator $B $DB "SELECT core.set_status('$B','SUSPENDED','st1','$SD',1,'')"
as operator $B $DB "SELECT core.set_status('$B','ACTIVE','st1','$SD',1,'')"
adm $DB "select status,revision from core.business where business_id='$B'"
```

## t8.sh
```bash
. ./lib.sh; . ./plan.sh; . ./mkinput.fn
DB=rv7; B=synthetic-a; ./setup.sh $DB >/dev/null 2>&1; CH=00000000-0000-4000-8000-0000000000a1
mkinput 1 pA 21111111-1111-4111-8111-111111111111
mkplan $DB 1111111 21111111-1111-4111-8111-111111111111 >/dev/null
echo "PREPARED op exists; suspend (rev1->2) then reactivate (rev2->3) with sealed REACTIVATE"
S1=$(printf '5%.0s' $(seq 64)); S2=$(printf '6%.0s' $(seq 64))
as operator $B $DB "SELECT core.set_status('$B','SUSPENDED','st1','$S1',1,'')" >/dev/null
as sealer $B $DB "SELECT core.register_seal('$B','re1','REACTIVATE','$S2','{\"key\":\"re1\",\"kind\":\"REACTIVATE\",\"digest\":\"$S2\",\"body\":{\"businessId\":\"$B\",\"value\":\"ACTIVE\",\"id\":\"st2\",\"expected\":2}}'::jsonb)" >/dev/null
as operator $B $DB "SELECT core.set_status('$B','ACTIVE','st2','$S2',2,'re1')" >/dev/null
adm $DB "select status,revision from core.business where business_id='$B'"
OWN=99999999-9999-4999-8999-999999999999
echo "arm of old (never armed) attempt after reactivation:"; armseal $DB 1111111 $OWN 2>&1 | tail -2
adm $DB "select a.state, ap.state as appt, (select count(*) from core.protection) prot, (select count(*) from core.mutation_guard) guard from core.attempt a, core.appointment ap"
echo "any function able to release guard/protection/appointment for stale PREPARED attempt?"
adm $DB "select p.proname from pg_proc p join pg_namespace n on n.oid=pronamespace where nspname='core' and prosrc ~* 'delete from core.(protection|mutation_guard)' "
```
