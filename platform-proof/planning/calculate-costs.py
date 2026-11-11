"""Additive offline INC1 model; never changes the PR18/19 evidence."""
import json, pathlib, subprocess, sys, hashlib
from decimal import Decimal as D
root=pathlib.Path(__file__).resolve().parents[2]
old=root/'docs/milestone-b/evidence/calculate-costs.py'
prior=json.loads(subprocess.check_output([sys.executable,str(old)]))
# Gross USD: same checked 2026-11-09 rates as PR18; no account/credit query.
def case(hours,tier='db-f1-micro',saturated=False,enterprise_plus=False):
 h=D(hours);sec=h*3600;month=D(730)
 lines={
 'ingress_and_sealer_max_one_each':sec*2*(D('.000024')+D('.5')*D('.0000025')) if saturated else sec*2*(D('.0000025')+D('.5')*D('.0000025')),
 # Conservative both epoch instances warm throughout, not just brief rollout.
 'gateway_old_and_new_instance_billed':sec*2*(D('.000018')+D('.5')*D('.000002')),
 'request_billed_throttle_variant_up_to6h':min(h,D(6))*3600*(D('.000024')+D('.5')*D('.0000025')),
 '40000_requests_conservative':D('.016'),
 'worker_one':sec*(D('.000011244')+D('.000001235')),
 'sql_compute':h*(D('.0105') if tier=='db-f1-micro' else D('.035')),
 'sql_storage_backup':h/month*(10*D('.17')+5*D('.08')),
 'nat_upper_ip_2GiB':h*(D('.044')+D('.005'))+D('.09'),
 'archive_kms':D('.7'),'secrets':D('.1'),'fake_host_disk_ip':D(3),
 'build_images':D('1.5'),'logs_metrics':D('1.5'),'transfer':D(2),'temporary_restore_drill':D(2)}
 if enterprise_plus:lines['sql_compute']=h*(2*D('.05369')+16*D('.0091')) # Sensitivity, unverified current edition/region SKU, not quote.
 total=sum(lines.values());return {'hours':hours,'tier':tier,'edition':'ENTERPRISE_PLUS_RISK_SENSITIVITY' if enterprise_plus else 'ENTERPRISE','lines':{k:str(v.quantize(D('.0001'))) for k,v in lines.items()},'grossUsd':str(total.quantize(D('.01'))),'with25Percent':str((total*D('1.25')).quantize(D('.01')))}
print(json.dumps({'localOnly':True,'priorCalculatorSha256':hashlib.sha256(old.read_bytes()).hexdigest(),'prior72hUnchanged':prior['proof72h'],'newScenarios':{'sixHourBaseline':case(6),'sixHourMaxOneHighLoad':case(6,saturated=True),'sixHourG1Small':case(6,'db-g1-small',True),'sixHourEnterprisePlusMisconfiguration':case(6,saturated=True,enterprise_plus=True),'72hMaxOneHighLoadSensitivityOnly':case(72,saturated=True)},'residualDailyGrossUsd':{'forgottenUnattachedIp':'.24','forgottenF1Compute':'.252','forgottenG1Compute':'.84','disabledSecretVersionMonth':'.06','kmsActiveVersionMonth':'.06'},'limitations':['No credit, tax or FX deducted; no billing/account queried','No hard cap: alerts are notifications; spend-cap eligibility/scope not verified','Fixed allowances conservatively remain for short session; workload amplification unmeasured','Enterprise Plus prices are sensitivity inputs requiring SKU revalidation','Storage, snapshots, backups, WAL, logs, IPs and keys survive compute unless removed','No claim of Cloud SQL compatibility or connection limit measurement','72h is sensitivity only, not first-session authorization']},indent=2))
