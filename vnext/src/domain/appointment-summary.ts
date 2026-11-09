import {DateTime} from 'luxon';
import {normalizedText} from './classification.js';
export function appointmentSummaryMode(input:{kind:'TEXT'|'ACTION';value:string},outcome:string,silent:boolean):'ALL'|'LATEST'|'NONE'{
 if(silent||input.kind==='ACTION'||outcome==='HUMAN_HANDOFF')return 'NONE';
 const n=normalizedText(input.value);
 if(['menu','hola','cita','agendar'].includes(n))return 'ALL';
 // Existing aliases retain availability routing and their previous latest-only
 // prefix until the owner approves a separate display policy for them.
 if(['reservar','horarios'].includes(n)&&outcome==='OFFER')return 'LATEST';
 // Preserve the existing idle/unrecognized-text menu fallback. Management has
 // the same MENU view type but must not duplicate the appointment overview.
 if(outcome==='MENU'&&!['reagendar','cancelar'].includes(n))return 'ALL';
 return 'NONE';
}
const date=(iso:string,zone:string)=>DateTime.fromISO(iso).setZone(zone).setLocale('es').toFormat("cccc d 'de' LLLL 'de' yyyy");
const time=(iso:string,zone:string)=>DateTime.fromISO(iso).setZone(zone).toFormat('HH:mm');
export interface SummaryAppointment {start:string;end:string}
/** Approved v0.8.1 text; interactive choice labels still use shortDate(). */
export function appointmentOverview(rows:readonly SummaryAppointment[],zone:string):string{
 if(!rows.length)return '';
 if(rows.length===1){const a=rows[0]!;return `Tu cita actual es para el ${date(a.start,zone)}, de ${time(a.start,zone)} a ${time(a.end,zone)}.`;}
 return 'Tus próximas citas:\n'+rows.map((a,i)=>`${i+1}. ${date(a.start,zone)}, ${time(a.start,zone)}–${time(a.end,zone)}`).join('\n');
}
export function delayedConfirmationOverview(row:SummaryAppointment,zone:string):string{
 return `Cita registrada para el ${date(row.start,zone)}, de ${time(row.start,zone)} a ${time(row.end,zone)}. La entrega de su confirmación no está verificada.`;
}
