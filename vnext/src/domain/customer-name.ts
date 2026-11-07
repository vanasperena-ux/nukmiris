import {normalizedText} from './classification.js';

export const NAME_REPROMPT='Por favor, escribe tu nombre completo (máximo 120 caracteres), incluyendo ambos apellidos si los tienes.';
// Deliberately finite conversational phrases, not name inference or escalation.
const conversation=new Set(['gracias','muchas gracias','mil gracias','gracias por todo','gracias por la ayuda','muchas gracias por la ayuda','ok','okay','okey','vale','de acuerdo','perfecto','listo','si','no','bueno','muy bien','por favor','buen dia','buenos dias','buenas tardes','buenas noches','buenas','hola buenos dias','hola buenas tardes','hola buenas noches','hola que tal','que tal','holi','holis','adios','hasta luego','hello','hi','thanks','thank you','si gracias','no gracias','si por favor','no se','quiero una cita','necesito ayuda','ayuda','como estas','todo bien']);
export function bookingCustomerName(value:string):string|null{
 const name=value.replace(/\s+/g,' ').trim();
 if(name.length<3||name.length>120||!/[\p{L}]/u.test(name)||/[\p{N}<>\p{Cc}]/u.test(name)||conversation.has(normalizedText(name))||/^(?:hola|holi|holis|gracias|muchas gracias|mil gracias|buenos dias|buenas tardes|buenas noches|buen dia|horarios|cita|agendar|reservar|reagendar|cancelar|menu|humano)(?: |$)/.test(normalizedText(name)))return null;
 return name;
}
