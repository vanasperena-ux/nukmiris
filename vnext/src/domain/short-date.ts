import {DateTime} from 'luxon';
/** Stable Spanish WhatsApp labels, independent of host ICU punctuation. */
export function shortDate(value:string,timeZone:string,withTime=true):string{
 const d=DateTime.fromISO(value,{zone:timeZone}).setZone(timeZone);
 if(!d.isValid)throw Error('invalid_label_date_or_zone');
 const weekdays=['lun','mar','mié','jue','vie','sáb','dom'],months=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
 const result=`${weekdays[d.weekday-1]} ${d.day} ${months[d.month-1]}${withTime?' '+d.toFormat('HH:mm'):''}`;
 if([...result].length>(withTime?20:24))throw Error('date_label_too_long');
 return result;
}
