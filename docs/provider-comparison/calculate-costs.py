"""Offline research arithmetic. No infrastructure, API clients or credentials."""
from decimal import Decimal as D, ROUND_HALF_UP
import json

H = D(730)
S = H * 3600
def money(x):
    return str(x.quantize(D('.01'), rounding=ROUND_HALF_UP))
def req(n):
    return S * D('.00000375') + n * D('.2') * D('.0000215') + n / 1000000 * D('.4')
def archive(gb, a, keys):
    return gb * D('.02') + a / 1000 * D('.005') + a * 3 / 1000 * D('.0004') + keys * D('.06') + a / 10000 * D('.03')

inputs = {
 'A': dict(businesses=1, appointments=100, requests=1000, sqlcpu=1, sqlram='3.75', ssd=10, backup=15, archive=5, ops=20000, keys=6, egress=2, logs=3, build=2, drill=3, fake=12, wal=2, worker_ram=1, railway_ram=3, railway_cpu='.5', db_ram=1, db_cpu='.1', snapshots=20, pitr=15, render_compute=35, render_db=19),
 'B': dict(businesses=10, appointments=1000, requests=25000, sqlcpu=1, sqlram='3.75', ssd=20, backup=30, archive=25, ops=200000, keys=24, egress=10, logs=5, build=2, drill=5, fake=0, wal=4, worker_ram=1, railway_ram=4, railway_cpu=1, db_ram=2, db_cpu='.25', snapshots=40, pitr=30, render_compute=53, render_db=55),
 'C': dict(businesses=100, appointments=10000, requests=250000, sqlcpu=2, sqlram='7.5', ssd=100, backup=150, archive=250, ops=2000000, keys=204, egress=50, logs=15, build=5, drill=10, fake=0, wal=10, worker_ram=2, railway_ram=9, railway_cpu='2.5', db_ram=4, db_cpu=1, snapshots=200, pitr=150, render_compute=125, render_db=55),
}
output = {'currency':'USD', 'priceCheckDate':'2026-11-09 America/Mexico_City', 'hours':730, 'freeUsageOrTrialApplied':False, 'scenarios':{}}
for key, raw in inputs.items():
    p = {k:D(str(v)) for k,v in raw.items()}
    n = p['requests']
    custody = archive(p['archive'],p['ops'],p['keys'])
    # Separate custody verifier is represented by the independent warm sealer
    # for GCP. Native PaaS candidates include an ADDITIONAL GCP verifier.
    common = {'archive_and_KMS':custody, 'platform_secrets':D('.9'), 'logs_and_metrics_allowance':p['logs'], 'build_images_allowance':p['build'], 'restore_drill_allowance':p['drill'], 'fake_host_allowance':p['fake']}
    g = {**common, 'ingress_and_independent_sealer':2*req(n), 'instance_gateway':S*D('.000019'), 'continuous_worker':S*(D('.000011244')+p['worker_ram']*D('.000001235')), 'private_result':n*D('.2')*D('.00002525')+n/1000000*D('.4'), 'SQL_compute_SSD_backup':H*(p['sqlcpu']*D('.0413')+p['sqlram']*D('.007'))+p['ssd']*D('.17')+p['backup']*D('.08'), 'WAL_reserve':p['wal'], 'internet_and_export_transfer_allowance':D(3) if key=='A' else D(5) if key=='B' else D(15)}
    gl = sum(g.values()) + H*D('.0064') + p['egress']*D('.045')
    gh = sum(g.values()) + H*D('.049') + p['egress']*D('.045')
    native_common = {**common, 'external_independent_verifier':req(n)}
    # Railway has included usage: charge max(plan floor, usage), not floor+usage.
    rail_usage = p['railway_ram']*10+p['railway_cpu']*20+p['db_ram']*10+p['db_cpu']*20+p['ssd']*D('.15')+p['snapshots']*D('.15')+p['pitr']*D('.015')+p['egress']*D('.05')
    rail = {**native_common, 'Railway_compute_DB_volumes_snapshots_PITR_egress':max(D(20),rail_usage), 'WAL_archive_operation_reserve':p['wal']}
    render = {**native_common, 'Pro_workspace':D(25), 'five_compute_services':p['render_compute'], 'managed_Postgres':p['render_db'], 'DB_storage':p['ssd']*D('.3'), 'outbound_over_25GB':max(D(0),p['egress']-25)*D('.15')}
    rt, dt = sum(rail.values()),sum(render.values())
    output['scenarios'][key] = {'inputs':raw, 'GCP':{'lines_excluding_NAT':g,'NAT_low':H*D('.0064')+p['egress']*D('.045'),'NAT_high':H*D('.049')+p['egress']*D('.045'),'subtotal_low':gl,'subtotal_high':gh,'with25pct_low':gl*D('1.25'),'with25pct_high':gh*D('1.25'),'request_gateway_conditional_saving':S*D('.000019')-req(n)}, 'Railway_incomplete_candidate':{'lines':rail,'usage_before_plan_floor':rail_usage,'subtotal':rt,'with25pct':rt*D('1.25'),'unpriced_safety_gap':'U_R >= 0; may require architectural replacement, not merely money'},'Render_incomplete_candidate':{'lines':render,'subtotal':dt,'with25pct':dt*D('1.25'),'unpriced_safety_gap':'U_D >= 0; may require architectural replacement, not merely money'},'GCP_core_plus_optional_PaaS_UI':{'Railway_low':gl+20,'Railway_high':gh+20,'Render_low':gl+32,'Render_high':gh+32}}
    assert gh > gl > 0
    assert rt >= 20 and dt >= 25

weights = [D('.35'),D('.25'),D('.20'),D('.10'),D('.10')]
scores = {'GCP':[4,3,3,4,3], 'Railway':[1,4,2,3,4], 'Render':[1,3,2,3,4]}
output['weightedScoresOutOf5'] = {k:sum(w*s for w,s in zip(weights,v)) for k,v in scores.items()}
assert sum(weights)==1
def serial(x):
    if isinstance(x,D): return money(x)
    if isinstance(x,dict): return {k:serial(v) for k,v in x.items()}
    return x
print(json.dumps(serial(output),indent=2))
