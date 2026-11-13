"""Offline gross USD model; no credentials, SDK, network or account query."""
import json,pathlib,subprocess,sys,hashlib
from decimal import Decimal as D
root=pathlib.Path(__file__).resolve().parents[1]
old=root/'planning/calculate-costs.py'
prior=json.loads(subprocess.check_output([sys.executable,str(old)]))
scenarios={}
for name,case in prior['newScenarios'].items():
 h=D(case['hours']);lines={k:D(v) for k,v in case['lines'].items()}
 # Official 2026-11-13 us-central1 public LB rate: 3 minimum proxies *.025/h.
 # PSC 3 consumer endpoints and data + DNS use conservative allowances: exact
 # Cloud SQL PSC/producer SKU billing and account currency still need approval.
 lines.update({'private_sealer_ALB_minimum_3_proxies':h*D('.075'),
 'three_PSC_endpoints_allowance_NOT_Sku_quote':h*D('.03'),
 'LB_PSC_2GiB_processing_allowance':D('.10'),
 'seven_private_DNS_zones_queries_allowance':D('.20'),
 'private_network_compatibility_margin':D('.57')})
 total=sum(lines.values());cont=total*D('1.25')
 scenarios[name]={**case,'lines':{k:str(v.quantize(D('.0001'))) for k,v in lines.items()},'grossUsd':str(total.quantize(D('.01'))),'with25Percent':str(cont.quantize(D('.01'))),'withinProposed20UsdAllocation':cont<=20,'authorized':False}
print(json.dumps({'scope':'B1A_SOURCE_ONLY','checkedDate':'2026-11-13','currency':'USD_GROSS_NO_CREDIT_TAX_OR_FX','priorCalculatorSha256':hashlib.sha256(old.read_bytes()).hexdigest(),'newScenarios':scenarios,'allocationUsd':20,'maxSessionHours':6,'priceSources':['https://cloud.google.com/load-balancing/pricing','https://cloud.google.com/vpc/network-pricing'],'assumptions':['Six-hour new private-path allowance totals USD1.50; conservative allowances are not verified SKUs','Gross per-account/month alerts 10/15/18/20 USD equivalent; not a hard cap','No Cloud Billing APIs or account eligibility/currency/quota access','Public rates inherited from PR18/INC1; independently reprice every SKU before resource authorization','Controller/observer are named operator processes outside runtime; always-on independent observer VM would need additional approved inventory and cost','Deployment/fake image bootstrap, TLS issuance, SQL privileges and PSC compatibility not proven','Enterprise Plus misconfiguration exceeds allocation and is BLOCKED; never silently upgrade tier','Any real quote above allocation requires reduced duration/workload preserving safety or a new owner allocation','Trial credit is not deducted and is not authorization; complete teardown by 2026-12-17','Monthly cap resets/inflight spend/SQL/NAT/LB/keys/versions can continue billing after Cloud Run pauses'],'residuals':{'minimum_private_ALB_USD_day':'1.80','three_PSC_allowance_USD_day':'.72','DNS_zone_allowance_month':'1.40','originalINC1':prior['residualDailyGrossUsd']},'prior72hUnchanged':prior['prior72hUnchanged']},indent=2))
