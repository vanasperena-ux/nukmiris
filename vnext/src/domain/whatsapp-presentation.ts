import type {ObjectValue} from './protocol.js';
/** Payload shape only; no SDK, provider credential or transport. Real contract is gate016. */
type View={text:string;choices:readonly {id:string;title:string}[];presentation:'TEXT'|'LIST'|'REPLY_BUTTONS';precedingTexts?:readonly string[]};
const length=(v:unknown)=>typeof v==='string'?[...v].length:Infinity;
export function whatsappPresentation(view:View):ObjectValue{
 if(!view||!Array.isArray(view.choices))throw Error('interactive_payload_denied');
 if(view.presentation==='TEXT'){if(view.choices.length||!view.text||length(view.text)>4096)throw Error('text_payload_denied');return {type:'text',text:{body:view.text}};}
 if(!view.text||length(view.text)>1024||view.choices.some(c=>!c.id||length(c.id)>200||typeof c.title!=='string'||/[\r\n\u0000-\u001f]/u.test(c.title))||new Set(view.choices.map(c=>c.id)).size!==view.choices.length)throw Error('interactive_payload_denied');
 if(view.presentation==='LIST'){
  if(view.choices.length<1||view.choices.length>10||view.choices.some(c=>!c.title||length(c.title)>24))throw Error('list_rows_denied');
  return {type:'interactive',interactive:{type:'list',body:{text:view.text},action:{button:'Elegir fecha',sections:[{title:'Fechas disponibles',rows:view.choices.map(c=>({id:c.id,title:c.title}))}]}}};
 }
 if(view.presentation!=='REPLY_BUTTONS'||view.choices.length<1||view.choices.length>3||view.choices.some(c=>!c.title||length(c.title)>20))throw Error('reply_buttons_denied');
 return {type:'interactive',interactive:{type:'button',body:{text:view.text},action:{buttons:view.choices.map(c=>({type:'reply',reply:{id:c.id,title:c.title}}))}}};
}
/** Local fake transport commits this ordered batch atomically. Real per-message
 * custody/partial-send reconciliation remains gate016, never inferred here. */
export function whatsappMessages(view:View):ObjectValue[]{
 if(view.precedingTexts!==undefined&&!Array.isArray(view.precedingTexts))throw Error('preceding_texts_denied');
 return [...(view.precedingTexts??[]).map(text=>whatsappPresentation({text,choices:[],presentation:'TEXT'})),whatsappPresentation(view)];
}
