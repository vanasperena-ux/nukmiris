import {normalizedText} from './classification.js';

export const NAME_REPROMPT='Por favor, escribe tu nombre completo (máximo 120 caracteres), incluyendo ambos apellidos si los tienes.\n\nUsa mayúscula al inicio de cada nombre o escribe "Me llamo …" para aclararlo.';
// Accept a name grammar first, then reject request/intent structure anywhere.
// This is conservative syntax, not proof of a person's identity or general NLP.
const particles=new Set(['de','del','la','las','los','y','e']);
const intent=new Set(('cita citas agendar reservar reserva reservas reagendar cancelar cancelacion menu humano humanos human hablar alguien ayuda persona personas horario horarios hora horas turno turnos opcion opciones fecha fechas cambiar cambio confirmar confirmo quiero queria quisiera necesito necesitamos puedo podemos podria tengo prefiero estoy estaba estare puedes puede pueden podrias solicito deseo pido informacion atenderme cuanto cuanta cuantos cuesta costo precio donde como que quien cuando hoy manana ayer proximo proxima despues antes tarde temprano espera momento por favor otra otro mas una un el mi tu su me se es esta estan soy llamo nombre no para hasta adios bye necesito duda nuevo equivocado equivoque').split(' '));
const conversational=new Set(('hola holi holis buenas buenos buen dias dia tardes noches gracias muchas mil ok okay okey vale claro entendido bien perfecto listo si bueno acuerdo ya genial super nada todo hello hi thanks thank you').split(' '));
const calendar=new Set(('lunes martes miercoles jueves viernes sabado domingo enero febrero marzo abril mayo junio julio agosto septiembre setiembre octubre noviembre diciembre').split(' '));
const word=/^\p{L}[\p{L}\p{M}]*(?:['’\-]\p{L}[\p{L}\p{M}]*)*$/u;
const initial=/^(?:\p{L}|Ma|Mª)\.$/iu;
export function bookingCustomerName(value:string):string|null{
 if(/[\p{Cc}\p{Cf}\p{N}]/u.test(value))return null;
 const cleaned=value.normalize('NFC').trim().replace(/\p{Zs}+/gu,' '),explicit=/^(?:me llamo|soy|mi nombre es) +/iu.test(cleaned);
 const name=cleaned.replace(/^(?:me llamo|soy|mi nombre es) +/iu,'').trim();
 if(name.length<3||name.length>120)return null;
 const words=name.split(' ');if(words.length>12||words.some(w=>(!word.test(w)&&!initial.test(w))||(!initial.test(w)&&(w.match(/\p{L}/gu)??[]).length<2)||/^(.)\1{2,}$/iu.test(w)))return null;
 const lexemes=words.flatMap((w,i)=>normalizedText(w.normalize('NFKC')).split(' ').map(key=>({key,i})));
 if(lexemes.some(({key})=>intent.has(key)||/^(?:ja|je|ji|jo|ha){2,}$/.test(key)))return null;
 const first=lexemes[0]!.key;
 if(/^(?:hola|holi|holis|gracias|muchas|mil|buenas|buenos|buen|hello|hi|thanks|thank)$/.test(first)||/^hol+a+$/.test(first))return null;
 // Connectors/initials cannot themselves constitute a name. Connectors need
 // surrounding name components; initials require at least one complete name.
 if(particles.has(first)||particles.has(lexemes.at(-1)!.key))return null;
 if(!explicit&&words.some(w=>!particles.has(normalizedText(w))&&!/^\p{Lu}/u.test(w)))return null;
 const anchors=lexemes.filter(({key,i})=>!particles.has(key)&&!conversational.has(key)&&!calendar.has(key)&&!initial.test(words[i]!));
 if(!anchors.length&&!(explicit&&lexemes.length===1&&calendar.has(first)))return null; // A bare month/day requires explicit name clarification.
 // Ambiguous name-like words can occur in legitimate compounds (Vale Gómez,
 // Graciela Gracias, Valentina Hola, Julio César), with an explicit name shape.
 return name;
}
