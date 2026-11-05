import type {ObjectValue} from './protocol.js';
/** Payload shape only; no SDK, provider credential or transport. Real contract is gate016. */
export function whatsappPresentation(view:{text:string;choices:readonly {id:string;title:string}[];presentation:'TEXT'|'LIST'|'REPLY_BUTTONS'}):ObjectValue{
 if(view.presentation==='TEXT'){if(view.choices.length||!view.text||view.text.length>4096)throw Error('text_payload_denied');return {type:'text',text:{body:view.text}};}
 if(!view.text||view.text.length>1024||view.choices.some(c=>!c.id||c.id.length>200))throw Error('interactive_payload_denied');
 if(view.presentation==='LIST'){
  if(view.choices.length<1||view.choices.length>10||view.choices.some(c=>!c.title||c.title.length>24))throw Error('list_rows_denied');
  return {type:'interactive',interactive:{type:'list',body:{text:view.text},action:{button:'Elegir fecha',sections:[{title:'Fechas disponibles',rows:view.choices.map(c=>({...c}))}]}}};
 }
 if(view.presentation!=='REPLY_BUTTONS'||view.choices.length<1||view.choices.length>3||view.choices.some(c=>!c.title||c.title.length>20))throw Error('reply_buttons_denied');
 return {type:'interactive',interactive:{type:'button',body:{text:view.text},action:{buttons:view.choices.map(c=>({type:'reply',reply:{...c}}))}}};
}
