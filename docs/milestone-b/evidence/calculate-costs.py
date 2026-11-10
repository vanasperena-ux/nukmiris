"""Offline planning arithmetic only: no network, credentials, DB or cloud actions."""
from decimal import Decimal as D, ROUND_HALF_UP
import json

H = D(730)
S = H * 3600
REQ_CPU, IDLE_CPU, REQ_RAM = D('.000024'), D('.0000025'), D('.0000025')
INST_CPU, INST_RAM = D('.000018'), D('.000002')
WORK_CPU, WORK_RAM = D('.000011244'), D('.000001235')
idle = S * (IDLE_CPU + D('.5') * REQ_RAM)
request_service = idle + D(20000) * (REQ_CPU - IDLE_CPU) + D('.04')
gateway_instance = S * (INST_CPU + D('.5') * INST_RAM)
worker = S * (WORK_CPU + WORK_RAM)
worker_if_free_available = (S - 384204) * WORK_CPU + (S - 728744) * WORK_RAM
sql = H * (D('.0413') + D('3.75') * D('.007')) + 20 * D('.17') + 30 * D('.08')
archive = 100 * D('.02') + 1000000 / D(1000) * D('.005') + 3000000 / D(1000) * D('.0004')
kms = 54 * D('.06') + 1000000 / D(10000) * D('.03')
result_service = 20000 * (REQ_CPU + D('.5') * REQ_RAM) + D('.04')
common = {'SQL compute/SSD/backup': sql, 'PITR/WAL allowance': D(4),
          'Archive operations/storage + KMS': archive + kms,
          'Platform secrets': D('.9'), 'Logs/metrics allowance': D(5),
          'Build/images allowance': D(2), 'Transfer allowance': D(5),
          'Independent fake-provider host allowance': D(12),
          'Private result service': result_service, 'Continuous worker': worker}
cases = {}
for gateway in ['request', 'instance']:
    for nat in ['low', 'high']:
        n = H * (D('.0014') if nat == 'low' else D('.044')) + H * D('.005') + 20 * D('.045')
        lines = {**common, 'Ingress and sealer': request_service * 2,
                 'Gateway': request_service if gateway == 'request' else gateway_instance,
                 'NAT/IP/processing sensitivity': n}
        total = sum(lines.values())
        cases[gateway + '_' + nat] = {'lineItems': lines, 'subtotal': total,
                                     'with25PercentContingency': total * D('1.25')}

p = D(72)
proof = {
 'Warm ingress + sealer, one each': p * 3600 * (IDLE_CPU + D('.5') * REQ_RAM) * 2,
 'Two gateway epoch instances, 72h each': p * 3600 * (INST_CPU + D('.5') * INST_RAM) * 2,
 'Request-billed throttle variant, 6h fully active': D(6) * 3600 * (REQ_CPU + D('.5') * REQ_RAM),
 'Extra ingress/sealer active-instance seconds, aggregate86400': D(86400) * (REQ_CPU - IDLE_CPU),
 '40000 HTTP requests': D(40000) / 1000000 * D('.4'),
 'Continuous worker': p * 3600 * (WORK_CPU + WORK_RAM),
 'Shared-core epoch SQL, SSD10GiB, backup5GiB': p * D('.0105') + p / H * (10 * D('.17') + 5 * D('.08')),
 'NAT upper metering allowance + IP +2GiB': p * (D('.044') + D('.005')) + 2 * D('.045'),
 'Synthetic archive/KMS allowance': D('.7'), 'Platform secrets allowance': D('.1'),
 'Fake host/disk/IP allowance': D(3), 'Build/images allowance': D('1.5'),
 'Logs/metrics allowance': D('1.5'), 'Transfer allowance': D(2),
 'Temporary DB/drill allowance': D(2)}
proof_total = sum(proof.values())
# A reservation for unused min2 capacity is not a spending ceiling. Stress case:
# ingress/sealer both run 2 fully busy instances for the full72h, rather than the
# baseline min1 plus86400 aggregate active seconds modeled above.
proof_saturated = proof_total - proof['Warm ingress + sealer, one each'] - proof['Extra ingress/sealer active-instance seconds, aggregate86400'] + p * 3600 * (REQ_CPU + D('.5') * REQ_RAM) * 4

assert round(request_service, 3) == D('10.325')
assert round(worker, 3) == D('32.795')
assert round(gateway_instance, 3) == D('49.932')
assert cases['instance_high']['subtotal'] > cases['request_high']['subtotal']
assert cases['instance_high']['with25PercentContingency'] > 250
assert proof_total < 50 and proof_saturated * D('1.25') > 50

def serial(v):
    if isinstance(v, D):
        return str(v.quantize(D('.01'), rounding=ROUND_HALF_UP))
    if isinstance(v, dict):
        return {k: serial(x) for k, x in v.items()}
    return v

print(json.dumps(serial({'currency': 'USD', 'hoursPerMonth': 730,
 'discountsOrCreditsApplied': False, 'laborTaxFxDomainSupportExcluded': True,
 'ratesCheckedLocalDate': '2026-11-09', 'regionCandidate': 'us-central1',
 'monthlyCases': cases, 'workerIfEntireFreeAllowanceAvailable': worker_if_free_available,
 'workerConditionalSaving': worker-worker_if_free_available,
 'priorAdrRoundedRowsSum': sum(map(D, ['24.09','9.50','27.60','55.11','7.66','.30','3','1.10','8','2'])),
 'proof72h': {'lineItems': proof, 'subtotal': proof_total,
             'with25PercentContingency': proof_total * D('1.25'),
             'saturatedIngressSealerSubtotal': proof_saturated,
             'saturatedWith25PercentContingency': proof_saturated * D('1.25')},
 'claims': {'vendorQuote': False, 'hardSpendingCap': False, 'freeTrialAccountVerified': False,
            'natDirectVpcMeteringVerified': False, 'cloudExecuted': False}}), indent=2))
