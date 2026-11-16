/** Deterministic read-only reference model; no durable L2 state or effect path. */
import {DateTime} from 'luxon';
import {searchAvailability,recheckSlot,type AvailabilityConfig,type Slot,type SyntheticCalendarReader} from '../domain/availability.js';
import {object,type ObjectValue} from '../domain/protocol.js';
import {serviceSnapshot,type Catalog} from './service-catalog.js';
import {shortDate} from '../domain/short-date.js';
export interface OracleView {text:string;choices:{id:string;title:string}[];outcome:'OFFER'|'DATES'|'NAME_REQUIRED'|'BOOK_REQUEST'|'HUMAN_HANDOFF'|'MENU'|'SERVICES'|'MANAGE'|'APPOINTMENTS'|'MANAGEMENT_HELD';slot?:Slot;viewRevision:number;expiresAt:string;presentation:'TEXT'|'REPLY_BUTTONS'|'LIST';precedingTexts?:string[]}
export const DATE_PROMPT='¿Para qué día te gustaría tu cita? Puedes escribir, por ejemplo: 13 oct, 13/10 o próximo lunes.';
export class AvailabilityOracle {
 private slots:Slot[]=[];private revision=0;private allowed=new Map<string,{kind:string;value:string}>();private human=false;private selected:Slot|undefined;
 private selectedDate:string|undefined;private timePage=0;private datePages:Slot[][]=[];private datePage=0;private expiresAt=0;
 private serviceId:string|undefined;private servicePage=0;
 constructor(private config:AvailabilityConfig,private readonly reader:SyntheticCalendarReader,private readonly now:()=>string,private readonly catalog?:Catalog){if(catalog?.services.filter(s=>s.active).length===1)this.serviceId=config.service.id;}
 snapshot():ObjectValue{return JSON.parse(JSON.stringify({slots:this.slots,revision:this.revision,allowed:[...this.allowed],human:this.human,selected:this.selected??null,selectedDate:this.selectedDate??null,timePage:this.timePage,datePages:this.datePages,datePage:this.datePage,expiresAt:this.expiresAt,...(this.catalog?{serviceId:this.serviceId??null,catalogRevision:this.catalog.revision,servicePage:this.servicePage}:{})})) as ObjectValue;}
 static resume(config:AvailabilityConfig,reader:SyntheticCalendarReader,now:()=>string,value:ObjectValue,expiresAt:string,catalog?:Catalog):AvailabilityOracle{
  const o=new AvailabilityOracle(config,reader,now,catalog);if(!Object.keys(value).length)return o;
  const v=object(value);if(catalog){o.serviceId=typeof v['serviceId']==='string'?v['serviceId']:o.serviceId;o.servicePage=Number(v['servicePage']??0);}o.slots=v['slots'] as unknown as Slot[];o.revision=Number(v['revision']);o.allowed=new Map(v['allowed'] as unknown as [string,{kind:string;value:string}][]);o.human=v['human']===true;o.selected=(v['selected']??undefined) as Slot|undefined;o.selectedDate=(v['selectedDate']??undefined) as string|undefined;o.timePage=Number(v['timePage']);o.datePages=v['datePages'] as unknown as Slot[][];o.datePage=Number(v['datePage']);o.expiresAt=Date.parse(expiresAt);return o;
 }
 private day(slot:Slot):string{return DateTime.fromISO(slot.startAt).setZone(this.config.timeZone).toISODate()!;}
 private view(text:string,kind:OracleView['outcome'],choices:{kind:string;value:string;title:string}[],slot?:Slot):OracleView{
  this.revision++;this.expiresAt=Date.parse(this.now())+900000;this.allowed.clear();const buttons=choices.map(x=>{const id=`${this.config.businessId}:${this.revision}:${x.kind}:${x.value}`;this.allowed.set(id,x);return {id,title:x.title};});return {text,choices:buttons,outcome:kind,viewRevision:this.revision,expiresAt:new Date(this.expiresAt).toISOString(),presentation:kind==='DATES'||(kind==='SERVICES'&&buttons.length>0)?'LIST':buttons.length?'REPLY_BUTTONS':'TEXT',...(slot?{slot}:{})};
 }
 private timesOrSuggestions(more=false):OracleView{
  if(!this.slots.length)return this.view(this.selectedDate?'No hay horarios disponibles para este día. Elige otra fecha o escríbela.':'No encontré horarios disponibles por ahora. Puedes llamar al negocio para consultar más opciones.','OFFER',this.selectedDate?[{kind:'dates',value:'0',title:'Elegir otra fecha'}]:[]);
  const offset=this.selectedDate?this.timePage*2:more?2:0,choices=this.slots.slice(offset,offset+2).map((s,i)=>({kind:'slot',value:String(offset+i),title:shortDate(s.startAt,this.config.timeZone)}));
  if(this.selectedDate){choices.push(offset+2<this.slots.length?{kind:'times',value:String(this.timePage+1),title:'Más horarios'}:{kind:'dates',value:'0',title:'Elegir otra fecha'});const day=DateTime.fromISO(this.selectedDate,{zone:this.config.timeZone}).setLocale('es').toFormat('cccc d \'de\' LLLL yyyy');return this.view(this.timePage>0?'Te muestro más opciones. Elige un horario que te funciona mejor:':`¿Qué hora prefieres para el ${day}?\n\nSelecciona el horario que prefieres. Para cambiar de día, escribe otra fecha.`,'OFFER',choices);}
  choices.push(!more&&this.slots.length>2?{kind:'more',value:'0',title:'Más opciones'}:{kind:'dates',value:'0',title:'Elegir fecha'});return this.view(more?'Te muestro más opciones. Elige un horario que te funciona mejor:':'Elige un horario que te funciona mejor:','OFFER',choices);
 }
 private dates():OracleView{
  const days=[...new Set(this.slots.map(s=>this.day(s)))],choices=days.slice(0,3).map(d=>({kind:'date',value:d,title:shortDate(d,this.config.timeZone,false)}));
  if(this.datePage>0)choices.push({kind:'days',value:String(this.datePage-1),title:'Fechas anteriores'});
  if(days.length>=3&&DateTime.fromISO(days.at(-1)!,{zone:this.config.timeZone}).plus({days:1})<DateTime.fromISO(this.now()).setZone(this.config.timeZone).plus({days:365}))choices.push({kind:'days',value:String(this.datePage+1),title:'Más fechas'});
  return this.view(DATE_PROMPT,'DATES',choices);
 }
 private services():OracleView{
  const all=this.catalog!.services.filter(s=>s.active),offset=this.servicePage*4,page=all.slice(offset,offset+4);
  if(!page.length)return this.view('No hay servicios activos disponibles. Contacta al negocio.','SERVICES',[]);
  const choices=page.map((s,i)=>({kind:'service',value:s.id,title:[...`${offset+i+1}. ${s.name}`].slice(0,24).join('')}));
  if(offset)choices.push({kind:'services',value:String(this.servicePage-1),title:'Servicios anteriores'});if(offset+4<all.length)choices.push({kind:'services',value:String(this.servicePage+1),title:'Más servicios'});
  const details=page.map((s,i)=>`${offset+i+1}. ${s.name} · ${(s.priceMinor/100).toFixed(2)} ${s.currency} · ${s.durationMinutes} min`).join('\n');
  return this.view('Elige un servicio para tu cita:\n\n'+details,'SERVICES',choices);
 }
 async open(resetService=false):Promise<OracleView>{if(this.human)return this.ordinary();if(this.catalog){if(resetService){this.serviceId=undefined;this.servicePage=0;}const active=this.catalog.services.filter(s=>s.active);if(active.length===1)this.serviceId=active[0]!.id;if(!this.serviceId||!active.some(s=>s.id===this.serviceId))return this.services();this.config={...this.config,service:active.find(s=>s.id===this.serviceId)!};}this.slots=await searchAvailability(this.config,this.reader,this.now());if(this.catalog){const svc=this.catalog.services.find(s=>s.id===this.serviceId)!;this.slots=this.slots.map(slot=>({...slot,serviceSnapshot:serviceSnapshot(svc)}));}this.expiresAt=Date.parse(this.now())+900000;this.selected=undefined;this.selectedDate=undefined;return this.timesOrSuggestions();}
 menu():OracleView{this.human=false;this.serviceId=undefined;this.servicePage=0;this.selected=undefined;return this.view('¿En qué podemos ayudarte?\n\nEscribe "cita" o "agendar" para agendar una cita nueva, "horarios" para ver opciones y "menu" para volver al menú principal.\n\nPara solicitar apoyo, escribe "humano" o elige "Hablar con alguien".\n\nEscribe "reagendar" o "cancelar" para gestionar una cita.','MENU',[{kind:'book',value:'0',title:'Agendar una cita'},{kind:'manage',value:'0',title:'Reagendar / cancelar'},{kind:'human',value:'0',title:'Hablar con alguien'}]);}
 humano():OracleView{this.human=true;this.selected=undefined;return this.view('Escribe tu mensaje.\n\nEscribe "menu" para volver al menú principal.','HUMAN_HANDOFF',[]);}
 management():OracleView{const view=this.menu();view.text='Reagendar y cancelar aún no están disponibles en esta prueba local. No se modificó ninguna cita.\n\n'+view.text;return view;}
 ordinary():OracleView{return this.human?this.view('Atención humana activa.','HUMAN_HANDOFF',[]):this.view('Menú','MENU',[]);}
 async action(id:string,knownCustomer:boolean):Promise<OracleView>{
  if(this.human)return this.ordinary();const action=this.allowed.get(id);if(!action||Date.parse(this.now())>=this.expiresAt)throw Error('oracle_stale_or_foreign_action');
  if(action.kind==='book')return this.open(true);
  if(action.kind==='services'){this.servicePage=Number(action.value);return this.services();}
  if(action.kind==='service'){if(!this.catalog?.services.some(s=>s.id===action.value&&s.active))throw Error('oracle_stale_or_foreign_action');this.serviceId=action.value;return this.open();}
  if(action.kind==='manage')return this.management();
  if(action.kind==='human')return this.humano();
  if(action.kind==='more')return this.timesOrSuggestions(true);
  if(action.kind==='times'){this.timePage=Number(action.value);return this.timesOrSuggestions();}
  if(action.kind==='dates'){if(this.selectedDate)this.slots=await searchAvailability(this.config,this.reader,this.now());this.selectedDate=undefined;this.datePages=[this.slots];this.datePage=0;return this.dates();}
  if(action.kind==='days'){const page=Number(action.value);if(!this.datePages[page])this.datePages[page]=await searchAvailability(this.config,this.reader,this.now(),{afterDate:this.day(this.datePages[page-1]!.at(-1)!)});this.datePage=page;this.slots=this.datePages[page]!;return this.dates();}
  if(action.kind==='date')return this.date(action.value);
  if(action.kind!=='slot')throw Error('oracle_action_kind');
  const slot=this.slots[Number(action.value)];if(!slot)throw Error('oracle_slot_missing');this.selected={...await recheckSlot(this.config,this.reader,this.now(),slot),...(this.catalog?{serviceSnapshot:serviceSnapshot(this.catalog.services.find(s=>s.id===this.serviceId)!)}:{})};
  return this.view(knownCustomer?'':'Para reservar este horario, indícanos tu nombre completo.',knownCustomer?'BOOK_REQUEST':'NAME_REQUIRED',[],this.selected);
 }
 async date(date:string):Promise<OracleView>{if(this.human)return this.ordinary();if(this.catalog&&!this.serviceId)return this.services();this.slots=await searchAvailability(this.config,this.reader,this.now(),{date});if(this.catalog){const svc=this.catalog.services.find(s=>s.id===this.serviceId)!;this.slots=this.slots.map(slot=>({...slot,serviceSnapshot:serviceSnapshot(svc)}));}this.selectedDate=date;this.timePage=0;return this.timesOrSuggestions();}
 /** Oracle expectation only; actual name validation and durable state are L2. */
 async nameCaptured():Promise<OracleView>{if(this.human)return this.ordinary();if(!this.selected||Date.parse(this.now())>=this.expiresAt)throw Error('oracle_no_selected_slot');const fresh=await recheckSlot(this.config,this.reader,this.now(),this.selected);return this.view('','BOOK_REQUEST',[],{...fresh,...(this.selected.serviceSnapshot?{serviceSnapshot:this.selected.serviceSnapshot}:{})});}
}
