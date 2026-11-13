"""Offline B1a plan compiler. No cloud SDK, network, account, or provisioning."""
import copy,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parent
RUNTIME='nmb1a-plan-run';CUSTODY='nmb1a-plan-custody';FAKE='nmb1a-plan-fake'
labels={'purpose':'b1a-synthetic-proof','expires':'2026-12-17','owner':'assignment-required'}
x={'variable':{
 'provisioning_authorized':{'type':'bool','default':False,'validation':{'condition':'${var.provisioning_authorized == false}','error_message':'B1a preparation cannot provision. Separate reviewed source change and owner resource authorization required.'}},
 'organization_mode':{'type':'string','default':'UNDECIDED','validation':{'condition':'${contains(["UNDECIDED", "ORG_ENFORCED", "STANDALONE_REVIEW_REQUIRED"], var.organization_mode)}','error_message':'Owner organization decision required.'}},
 'standalone_risk_reviewed':{'type':'bool','default':False},
 'runtime_project_number':{'type':'string','default':'000000000000'},
 'session_started_at':{'type':'string','default':'2026-12-17T00:00:00Z'},
 'synthetic_sealer_tls_key':{'type':'string','default':None,'sensitive':True},
 'synthetic_sealer_tls_certificate':{'type':'string','default':None},
 'billing_account':{'type':'string','default':'000000-000000-000000'},
 'billing_currency':{'type':'string','default':'USD'},
 'candidate_image':{'type':'string','default':'us-central1-docker.pkg.dev/'+RUNTIME+'/b1a/harness@sha256:'+'0'*64}
 },'locals':{'region':'us-central1','labels':labels},'resource':{'terraform_data':{'never_apply':{'input':'B1A_SOURCE_ONLY','lifecycle':{'precondition':[
 {'condition':'${var.provisioning_authorized}','error_message':'STOP: only local validation authorized. Do not plan/apply.'},
 {'condition':'${var.organization_mode != "UNDECIDED" && (var.organization_mode != "STANDALONE_REVIEW_REQUIRED" || var.standalone_risk_reviewed)}','error_message':'Owner organization/standalone decision and review are unresolved.'},
 {'condition':'${timecmp(timestamp(), timeadd(var.session_started_at, "6h")) < 0}','error_message':'Session expired; do not recreate resources.'}
 ]}}}}}
r=x['resource']
def add(typ,name,body,project=RUNTIME):
 if name in r.get(typ,{}):raise ValueError('duplicate resource '+typ+'.'+name)
 body.setdefault('depends_on',[]).append('terraform_data.never_apply')
 if typ!='terraform_data':body.setdefault('project',project)
 r.setdefault(typ,{})[name]=body
 return body
for key,project in [('run',RUNTIME),('custody',CUSTODY),('fake',FAKE)]:
 add('google_compute_network',key,{'name':'nmb1a-'+key,'auto_create_subnetworks':False},project)
for key,net,cidr,project in [('gateway','run','10.81.0.0/26',RUNTIME),('private','run','10.81.1.0/26',RUNTIME),('custody','custody','10.83.0.0/26',CUSTODY),('proxy','custody','10.83.2.0/23',CUSTODY),('psc_nat','custody','10.83.4.0/28',CUSTODY),('fake','fake','10.82.0.0/26',FAKE)]:
 body={'name':'nmb1a-'+key.replace('_','-'),'network':'${google_compute_network.'+net+'.id}','region':'${local.region}','ip_cidr_range':cidr,'private_ip_google_access':True,'stack_type':'IPV4_ONLY'}
 if key=='proxy':body.update({'purpose':'REGIONAL_MANAGED_PROXY','role':'ACTIVE'})
 if key=='psc_nat':body['purpose']='PRIVATE_SERVICE_CONNECT'
 add('google_compute_subnetwork',key,body,project)
# Cloud SQL PSC allows independently administered sealer VPC access without a
# public DB address or a false claim that PSA peering is transitive.
add('google_sql_database_instance','epoch',{'name':'nmb1a-epoch','database_version':'POSTGRES_17','region':'${local.region}','deletion_protection':False,'settings':{'edition':'ENTERPRISE','tier':'db-f1-micro','availability_type':'ZONAL','disk_size':10,'disk_type':'PD_SSD','disk_autoresize':False,'deletion_protection_enabled':False,'retain_backups_on_delete':False,'final_backup_config':{'enabled':False},'backup_configuration':{'enabled':True,'point_in_time_recovery_enabled':True,'transaction_log_retention_days':1,'backup_retention_settings':{'retained_backups':1}},'ip_configuration':{'ipv4_enabled':False,'ssl_mode':'ENCRYPTED_ONLY','server_ca_mode':'GOOGLE_MANAGED_CAS_CA','psc_config':{'psc_enabled':True,'allowed_consumer_projects':[RUNTIME,CUSTODY]}},'database_flags':[{'name':'cloudsql.iam_authentication','value':'on'},{'name':'timezone','value':'UTC'}],'user_labels':'${local.labels}'}})
for key,net,sub,ip,project in [('sql_run','run','private','10.81.1.12',RUNTIME),('sql_custody','custody','custody','10.83.0.12',CUSTODY),('sealer_consumer','run','private','10.81.1.10',RUNTIME),('sealer_lb','custody','custody','10.83.0.10',CUSTODY)]:
 add('google_compute_address',key,{'name':'nmb1a-'+key.replace('_','-'),'address_type':'INTERNAL','address':ip,'subnetwork':'${google_compute_subnetwork.'+sub+'.id}','region':'${local.region}'},project)
 if key.startswith('sql_'):add('google_compute_forwarding_rule',key,{'name':'nmb1a-'+key.replace('_','-'),'region':'${local.region}','network':'${google_compute_network.'+net+'.id}','ip_address':'${google_compute_address.'+key+'.id}','target':'${google_sql_database_instance.epoch.psc_service_attachment_link}','load_balancing_scheme':''},project)
for key,project in [('nat',RUNTIME),('fake',FAKE)]:add('google_compute_address',key,{'name':'nmb1a-'+key+'-ip','region':'${local.region}','labels':'${local.labels}'},project)
add('google_compute_router','gateway',{'name':'nmb1a-gateway-router','region':'${local.region}','network':'${google_compute_network.run.id}'})
add('google_compute_router_nat','gateway',{'name':'nmb1a-gateway-only','region':'${local.region}','router':'${google_compute_router.gateway.name}','nat_ip_allocate_option':'MANUAL_ONLY','nat_ips':['${google_compute_address.nat.self_link}'],'source_subnetwork_ip_ranges_to_nat':'LIST_OF_SUBNETWORKS','subnetwork':[{'name':'${google_compute_subnetwork.gateway.id}','source_ip_ranges_to_nat':['ALL_IP_RANGES']}],'log_config':{'enable':True,'filter':'ALL'}})
for net,project in [('run',RUNTIME),('custody',CUSTODY),('fake',FAKE)]:
 for suffix,range_ in [('v4','0.0.0.0/0'),('v6','::/0')]:add('google_compute_firewall','deny_'+net+'_'+suffix,{'name':'nmb1a-deny-'+net+'-'+suffix,'network':'${google_compute_network.'+net+'.id}','direction':'EGRESS','priority':65534,'destination_ranges':[range_],'deny':[{'protocol':'all'}]},project)
for e in [1,2]:
 tag=f'nmb1a-e{e:06d}'
 for suffix,range_ in [('v4','0.0.0.0/0'),('v6','::/0')]:add('google_compute_firewall',f'epoch_deny_{e}_{suffix}',{'name':tag+'-deny-'+suffix,'network':'${google_compute_network.run.id}','direction':'EGRESS','priority':100,'disabled':True,'target_tags':[tag],'destination_ranges':[range_],'deny':[{'protocol':'all'}]})
 add('google_compute_firewall',f'gateway_fake_{e}',{'name':tag+'-fake-allow','network':'${google_compute_network.run.id}','direction':'EGRESS','priority':1000,'target_tags':[tag],'destination_ranges':['${google_compute_address.fake.address}/32'],'allow':[{'protocol':'tcp','ports':['443']} ]})
# Distinct resource names prevent the INC1 egress/ingress dictionary collision.
add('google_compute_firewall','fake_ingress_nat',{'name':'nmb1a-fake-ingress-nat','network':'${google_compute_network.fake.id}','direction':'INGRESS','source_ranges':['${google_compute_address.nat.address}/32'],'target_tags':['nmb1a-fake'],'allow':[{'protocol':'tcp','ports':['443']}]},FAKE)
for key,net,tags,dest,ports,project in [
 ('sql_run','run',['nmb1a-e000001','nmb1a-e000002','nmb1a-worker','nmb1a-ingress'],['10.81.1.12/32'],['5432'],RUNTIME),
 ('sql_custody','custody',['nmb1a-sealer'],['10.83.0.12/32'],['5432'],CUSTODY),
 ('sealer_call','run',['nmb1a-ingress'],['10.81.1.10/32'],['443'],RUNTIME),
 ('restricted_run','run',['nmb1a-e000001','nmb1a-e000002','nmb1a-worker','nmb1a-ingress'],['199.36.153.4/30'],['443'],RUNTIME),
 ('restricted_custody','custody',['nmb1a-sealer'],['199.36.153.4/30'],['443'],CUSTODY)]:
 add('google_compute_firewall',key,{'name':'nmb1a-'+key.replace('_','-'),'network':'${google_compute_network.'+net+'.id}','direction':'EGRESS','priority':1000,'target_tags':tags,'destination_ranges':dest,'allow':[{'protocol':'tcp','ports':ports}]},project)
# Explicit restricted-VIP route/DNS; run.app alone does NOT fix cross-project ingress.
for net,project in [('run',RUNTIME),('custody',CUSTODY)]:
 add('google_compute_route','restricted_'+net,{'name':'nmb1a-restricted-'+net,'network':'${google_compute_network.'+net+'.id}','dest_range':'199.36.153.4/30','next_hop_gateway':'default-internet-gateway','priority':900},project)
 for zone,domain in [('apis','googleapis.com.'),('runapp','run.app.')]:
  name=zone+'_'+net;add('google_dns_managed_zone',name,{'name':'nmb1a-'+zone+'-'+net,'dns_name':domain,'visibility':'private','private_visibility_config':{'networks':[{'network_url':'${google_compute_network.'+net+'.id}'}]},'labels':'${local.labels}'},project)
  add('google_dns_record_set',name,{'name':'*.'+domain,'type':'A','ttl':30,'managed_zone':'${google_dns_managed_zone.'+name+'.name}','rrdatas':['199.36.153.4','199.36.153.5','199.36.153.6','199.36.153.7']},project)
 name='sql_'+net;endpoint='sql_run' if net=='run' else 'sql_custody'
 add('google_dns_managed_zone',name,{'name':'nmb1a-sql-'+net,'dns_name':'${trimsuffix(google_sql_database_instance.epoch.dns_name, ".")}.','visibility':'private','private_visibility_config':{'networks':[{'network_url':'${google_compute_network.'+net+'.id}'}]},'labels':'${local.labels}'},project)
 add('google_dns_record_set',name,{'name':'${google_dns_managed_zone.'+name+'.dns_name}','type':'A','ttl':30,'managed_zone':'${google_dns_managed_zone.'+name+'.name}','rrdatas':['${google_compute_address.'+endpoint+'.address}']},project)
for sa,project in [('ingress',RUNTIME),('worker',RUNTIME),('gw_e000001',RUNTIME),('gw_e000002',RUNTIME),('controller',RUNTIME),('kill',RUNTIME),('observer',CUSTODY),('sealer',CUSTODY),('deployer',RUNTIME),('fake',FAKE)]:
 add('google_service_account',sa,{'account_id':'nmb1a-'+sa.replace('_','-'),'display_name':'B1a '+sa+' separate principal'},project)
image='${var.candidate_image}'
for name,sa,project,net,sub,tags,ingress in [
 ('ingress','ingress',RUNTIME,'run','private',['nmb1a-ingress'],'INGRESS_TRAFFIC_ALL'),
 ('gateway','gw_e000001',RUNTIME,'run','gateway',['nmb1a-e000001'],'INGRESS_TRAFFIC_INTERNAL_ONLY'),
 ('sealer','sealer',CUSTODY,'custody','custody',['nmb1a-sealer'],'INGRESS_TRAFFIC_INTERNAL_ONLY')]:
 body={'name':'nmb1a-'+name,'location':'${local.region}','deletion_protection':False,'ingress':ingress,'labels':'${local.labels}','scaling':{'min_instance_count':1,'max_instance_count':2 if name=='gateway' else 1},'template':{'revision':'nmb1a-'+name+'-e000001-r1','service_account':'${google_service_account.'+sa+'.email}','labels':{**labels,'deployment_epoch':'e000001'},'timeout':'15s','max_instance_request_concurrency':1,'scaling':{'min_instance_count':1,'max_instance_count':1},'containers':[{'image':image,'env':[{'name':'B1A_ROLE','value':name},{'name':'B1A_MODE','value':'INERT_UNCONFIGURED'},{'name':'DEPLOYMENT_EPOCH','value':'1'}],'ports':[{'container_port':8080}],'resources':{'limits':{'cpu':'1','memory':'512Mi'},'cpu_idle':name!='gateway','startup_cpu_boost':False},'startup_probe':{'http_get':{'path':'/healthz','port':8080},'period_seconds':2,'failure_threshold':30},'readiness_probe':{'http_get':{'path':'/readyz','port':8080},'period_seconds':2,'failure_threshold':3}}],'vpc_access':{'egress':'ALL_TRAFFIC','network_interfaces':[{'network':'${google_compute_network.'+net+'.name}','subnetwork':'${google_compute_subnetwork.'+sub+'.name}','tags':tags}]}},'traffic':[{'type':'TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST','percent':100}]}
 if name=='gateway':body['lifecycle']={'ignore_changes':['template','traffic']}
 if name=='sealer':body.update({'default_uri_disabled':True,'custom_audiences':['https://sealer.nmb1a.invalid']})
 add('google_cloud_run_v2_service',name,body,project)
add('google_cloud_run_v2_worker_pool','worker',{'name':'nmb1a-worker','location':'${local.region}','deletion_protection':False,'labels':'${local.labels}','scaling':{'manual_instance_count':1,'scaling_mode':'MANUAL'},'template':{'revision':'nmb1a-worker-e000001-r1','service_account':'${google_service_account.worker.email}','labels':'${local.labels}','containers':[{'image':image,'env':[{'name':'B1A_ROLE','value':'worker'},{'name':'B1A_MODE','value':'INERT_UNCONFIGURED'}],'resources':{'limits':{'cpu':'1','memory':'1Gi'}}}],'vpc_access':{'egress':'ALL_TRAFFIC','network_interfaces':[{'network':'${google_compute_network.run.name}','subnetwork':'${google_compute_subnetwork.private.name}','tags':['nmb1a-worker']}]}}})
# Custody-project internal HTTPS ALB + published PSC, independent of org choice.
add('google_compute_region_network_endpoint_group','sealer',{'name':'nmb1a-sealer-neg','region':'${local.region}','network_endpoint_type':'SERVERLESS','cloud_run':{'service':'${google_cloud_run_v2_service.sealer.name}'}},CUSTODY)
add('google_compute_region_backend_service','sealer',{'name':'nmb1a-sealer-backend','region':'${local.region}','protocol':'HTTP','load_balancing_scheme':'INTERNAL_MANAGED','backend':[{'group':'${google_compute_region_network_endpoint_group.sealer.id}'}],'log_config':{'enable':True,'sample_rate':1}},CUSTODY)
add('google_compute_region_url_map','sealer',{'name':'nmb1a-sealer-map','region':'${local.region}','default_service':'${google_compute_region_backend_service.sealer.id}'},CUSTODY)
add('google_compute_region_ssl_certificate','sealer',{'name':'nmb1a-sealer-synthetic-tls','region':'${local.region}','private_key':'${var.synthetic_sealer_tls_key}','certificate':'${var.synthetic_sealer_tls_certificate}'},CUSTODY)
add('google_compute_region_target_https_proxy','sealer',{'name':'nmb1a-sealer-https','region':'${local.region}','url_map':'${google_compute_region_url_map.sealer.id}','ssl_certificates':['${google_compute_region_ssl_certificate.sealer.id}']},CUSTODY)
add('google_compute_forwarding_rule','sealer_lb',{'name':'nmb1a-sealer-lb','region':'${local.region}','load_balancing_scheme':'INTERNAL_MANAGED','network':'${google_compute_network.custody.id}','subnetwork':'${google_compute_subnetwork.custody.id}','ip_address':'${google_compute_address.sealer_lb.address}','ports':['443'],'target':'${google_compute_region_target_https_proxy.sealer.id}','depends_on':['google_compute_subnetwork.proxy']},CUSTODY)
add('google_compute_service_attachment','sealer',{'name':'nmb1a-sealer-published','region':'${local.region}','target_service':'${google_compute_forwarding_rule.sealer_lb.id}','connection_preference':'ACCEPT_MANUAL','nat_subnets':['${google_compute_subnetwork.psc_nat.id}'],'enable_proxy_protocol':False,'consumer_accept_lists':[{'project_id_or_num':RUNTIME,'connection_limit':1}]},CUSTODY)
add('google_compute_forwarding_rule','sealer_consumer',{'name':'nmb1a-sealer-consumer','region':'${local.region}','network':'${google_compute_network.run.id}','ip_address':'${google_compute_address.sealer_consumer.id}','target':'${google_compute_service_attachment.sealer.id}','load_balancing_scheme':''})
add('google_dns_managed_zone','sealer',{'name':'nmb1a-sealer-private','dns_name':'sealer.nmb1a.invalid.','visibility':'private','private_visibility_config':{'networks':[{'network_url':'${google_compute_network.run.id}'}]},'labels':'${local.labels}'})
add('google_dns_record_set','sealer',{'name':'sealer.nmb1a.invalid.','type':'A','ttl':30,'managed_zone':'${google_dns_managed_zone.sealer.name}','rrdatas':['${google_compute_address.sealer_consumer.address}']})
# Metadata only; runtime-generated synthetic material is supplied only after
# separately authorized setup. No secret version value is committed or generated.
for secret,project in [('effect_e000001',RUNTIME),('effect_e000002',RUNTIME),('worker_db',RUNTIME),('ingress_db',RUNTIME),('controller_db',RUNTIME),('sealer_db',CUSTODY),('observer_signing',CUSTODY)]:
 add('google_secret_manager_secret',secret,{'secret_id':'nmb1a-'+secret.replace('_','-'),'replication':{'auto':{}},'labels':'${local.labels}'},project)
add('google_storage_bucket','custody',{'name':'nmb1a-plan-custody-evidence-unique-required','location':'US-CENTRAL1','uniform_bucket_level_access':True,'public_access_prevention':'enforced','versioning':{'enabled':True},'force_destroy':False,'labels':'${local.labels}'},CUSTODY)
for ring,project in [('effect',RUNTIME),('custody',CUSTODY)]:
 add('google_kms_key_ring',ring,{'name':'nmb1a-'+ring,'location':'${local.region}'},project)
 add('google_kms_crypto_key',ring,{'name':'nmb1a-'+ring,'key_ring':'${google_kms_key_ring.'+ring+'.id}','destroy_scheduled_duration':'86400s','rotation_period':'2592000s','labels':'${local.labels}'},project)
add('google_artifact_registry_repository','harness',{'location':'${local.region}','repository_id':'b1a','format':'DOCKER','labels':'${local.labels}'})
add('google_compute_instance','fake',{'name':'nmb1a-fake','zone':'us-central1-a','machine_type':'e2-micro','boot_disk':{'initialize_params':{'image':'debian-cloud/debian-12','size':10,'type':'pd-standard'}},'network_interface':[{'subnetwork':'${google_compute_subnetwork.fake.id}','access_config':[{'nat_ip':'${google_compute_address.fake.address}'}]}],'service_account':{'email':'${google_service_account.fake.email}','scopes':['https://www.googleapis.com/auth/cloud-platform']},'metadata':{'enable-oslogin':'TRUE','block-project-ssh-keys':'TRUE'},'tags':['nmb1a-fake'],'labels':'${local.labels}','deletion_protection':False},FAKE)
# Scoped invocation and per-secret permissions; no allUsers, Owner/Editor or keys.
for name,service,member,project in [('worker_gateway','gateway','worker',RUNTIME),('ingress_sealer','sealer','ingress',CUSTODY)]:
 add('google_cloud_run_v2_service_iam_member',name,{'location':'${local.region}','name':'${google_cloud_run_v2_service.'+service+'.name}','role':'roles/run.invoker','member':'serviceAccount:${google_service_account.'+member+'.email}'},project)
for secret,sa,project in [('effect_e000001','gw_e000001',RUNTIME),('effect_e000002','gw_e000002',RUNTIME),('worker_db','worker',RUNTIME),('ingress_db','ingress',RUNTIME),('controller_db','controller',RUNTIME),('sealer_db','sealer',CUSTODY),('observer_signing','observer',CUSTODY)]:
 add('google_secret_manager_secret_iam_member',secret,{'secret_id':'${google_secret_manager_secret.'+secret+'.id}','role':'roles/secretmanager.secretAccessor','member':'serviceAccount:${google_service_account.'+sa+'.email}'},project)
for e in [1,2]:add('google_kms_crypto_key_iam_member',f'effect_{e}',{'crypto_key_id':'${google_kms_crypto_key.effect.id}','role':'roles/cloudkms.cryptoKeyDecrypter','member':'serviceAccount:${google_service_account.gw_e'+f'{e:06d}'+'.email}'})
add('google_kms_crypto_key_iam_member','sealer',{'crypto_key_id':'${google_kms_crypto_key.custody.id}','role':'roles/cloudkms.cryptoKeyEncrypterDecrypter','member':'serviceAccount:${google_service_account.sealer.email}'},CUSTODY)
for key,sa,role in [('sealer_create','sealer','roles/storage.objectCreator'),('observer_read','observer','roles/storage.objectViewer'),('fake_create','fake','roles/storage.objectCreator')]:add('google_storage_bucket_iam_member',key,{'bucket':'${google_storage_bucket.custody.name}','role':role,'member':'serviceAccount:${google_service_account.'+sa+'.email}'},CUSTODY)
# Some IAM-member resources do not accept project (their resource ID owns scope).
for typ in ['google_kms_crypto_key','google_kms_crypto_key_iam_member','google_storage_bucket_iam_member']: 
 for body in r.get(typ,{}).values():body.pop('project',None)
for key,permissions in [('kill',['run.revisions.get','run.revisions.list','run.revisions.delete','compute.firewalls.get','compute.firewalls.update','secretmanager.secrets.getIamPolicy','secretmanager.secrets.setIamPolicy','cloudkms.cryptoKeys.getIamPolicy','cloudkms.cryptoKeys.setIamPolicy']),('deploy',['run.services.create','run.services.update','run.services.get','run.services.list','run.operations.get','run.revisions.get','run.revisions.list'])]:
 add('google_project_iam_custom_role',key,{'role_id':'nmb1a_'+key,'title':'B1a '+key+' only','permissions':permissions})
 add('google_project_iam_member',key,{'role':'${google_project_iam_custom_role.'+key+'.name}','member':'serviceAccount:${google_service_account.'+('kill' if key=='kill' else 'deployer')+'.email}'})
for sa in ['ingress','worker','gw_e000001','gw_e000002']:
 add('google_service_account_iam_member','deploy_'+sa,{'service_account_id':'${google_service_account.'+sa+'.name}','role':'roles/iam.serviceAccountUser','member':'serviceAccount:${google_service_account.deployer.email}'})
 r['google_service_account_iam_member']['deploy_'+sa].pop('project',None)
for key,role in [('metrics','roles/monitoring.viewer'),('logs','roles/logging.viewer'),('run','roles/run.viewer')]:add('google_project_iam_member','observer_'+key,{'role':role,'member':'serviceAccount:${google_service_account.observer.email}'})
# Separate gross alerts; Cloud Run spend-cap request is a printed Billing Budgets
# API template, because pinned provider 8.11 has no spendCap field.
add('google_billing_budget','session',{'billing_account':'${var.billing_account}','display_name':'B1a gross session alerts only','amount':{'specified_amount':{'currency_code':'${var.billing_currency}','units':'20'}},'budget_filter':{'projects':['projects/'+RUNTIME,'projects/'+CUSTODY,'projects/'+FAKE],'credit_types_treatment':'EXCLUDE_ALL_CREDITS','calendar_period':'MONTH'},'threshold_rules':[{'threshold_percent':v,'spend_basis':'CURRENT_SPEND'} for v in [.5,.75,.9,1]]})
r['google_billing_budget']['session'].pop('project',None)
add('google_org_policy_policy','all_traffic',{'count':'${var.organization_mode == "ORG_ENFORCED" ? 1 : 0}','name':'projects/${var.runtime_project_number}/policies/run.allowedVPCEgress','parent':'projects/${var.runtime_project_number}','spec':{'rules':[{'values':{'allowed_values':['all-traffic']}}]}})
r['google_org_policy_policy']['all_traffic'].pop('project',None)
(ROOT/'terraform/main.tf.json').write_text(json.dumps(x,indent=2)+'\n')
inventory={'scope':'B1A_SOURCE_ONLY_NOT_AUTHORIZED','baseCommit':'2ca5cf215b68f187bfa48b42aaa041bbe93cf56d','region':'us-central1','projects':{'runtime':RUNTIME,'custody':CUSTODY,'fake':FAKE},'gateway':{'service':'nmb1a-gateway','oldEpoch':1,'oldRevision':'nmb1a-gateway-e000001-r1','candidateEpoch':2,'candidateRevision':'nmb1a-gateway-e000002-r1','oldTag':'nmb1a-e000001','candidateTag':'nmb1a-e000002','oldSa':'nmb1a-gw-e000001@'+RUNTIME+'.iam.gserviceaccount.com','candidateSa':'nmb1a-gw-e000002@'+RUNTIME+'.iam.gserviceaccount.com','oldDenyRules':['nmb1a-e000001-deny-v4','nmb1a-e000001-deny-v6'],'serviceMaxInstances':2,'revisionMaxInstances':1,'cpu':'instance'},'sql':{'name':'nmb1a-epoch','version':'POSTGRES_17','edition':'ENTERPRISE','tier':'db-f1-micro','connectivity':'PSC_ONLY_TWO_PRIVATE_ENDPOINTS','clientTls':'verify CA and generated instance DNS identity','connectionBudget':{'oldGateway':2,'candidateGateway':2,'worker':2,'ingress':1,'sealer':1,'operatorControllerProbe':2,'reserve':3},'measured':False,'assumedDefaultMaxConnections':25,'finalBackup':False,'retainedBackupsOnDelete':False},'sealer':{'service':'nmb1a-sealer','crossProjectPath':'private PSC published internal HTTPS ALB','defaultRunAppUriDisabled':True,'customAudience':'https://sealer.nmb1a.invalid','minMaxInstances':1},'identities':{'kill':'nmb1a-kill@'+RUNTIME+'.iam.gserviceaccount.com','controller':'nmb1a-controller@'+RUNTIME+'.iam.gserviceaccount.com','observer':'nmb1a-observer@'+CUSTODY+'.iam.gserviceaccount.com'},'worker':'nmb1a-worker','custodyBucket':'nmb1a-plan-custody-evidence-unique-required','session':{'maximumHours':6,'allocationUsd':20,'grossAlertUsd':[10,15,18,20],'spendCapsAreProjectServiceScopedNotHardProjectCaps':True,'hardTeardownDate':'2026-12-17','organizationDecision':'UNDECIDED','namedOperators':'OWNER_DECISION_REQUIRED','billingCurrency':'UNVERIFIED_NO_ACCOUNT_ACCESS'},'terraformResources':[{'type':t,'name':n,'project':v.get('project','resource-ID scoped'),'billableOrRetained':t not in ['terraform_data','google_project_iam_member','google_service_account_iam_member']} for t,rs in r.items() for n,v in rs.items()],'notProven':['Cloud Run physical termination and metrics reporting','Direct VPC propagation/no-VPC enforcement','Private cross-project PSC/ALB/IAM invocation','Cloud SQL PSC/shared-core/CAS-CA compatibility and real limits','Clock measurement across actual cloud hosts','Actual budgets/spend caps/currency/Free Trial eligibility','Cold sealer and request-CPU lifecycle','Organization enforcement or independently reviewed standalone gap','Runtime synthetic secret/bootstrap and encrypted IaC-state procedures']}
(ROOT/'inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
print(json.dumps({'resources':sum(len(v) for v in r.values()),'projects':inventory['projects'],'provisioning':False}))
