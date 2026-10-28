import {ApiError} from '../../middleware/errorHandler.js';
const MAX=9007199254740991n;
const fail=message=>{throw new ApiError(400,'BAD_INPUT',message);};
// Proposed billing policy: round each entry half-up to currency minor units,
// then sum rounded entries. This helper does not approve, allocate or invoice time.
export function calculateTimeCharges(entries){
 if(!Array.isArray(entries)||entries.length<1||entries.length>50)fail('Select 1 to 50 time entries');
 const ids=new Set();let currency,total=0n;
 const lines=entries.map(entry=>{
  if(!entry||typeof entry!=='object'||Array.isArray(entry)||Object.keys(entry).some(key=>!['entryId','minutes','hourlyMinor','currency'].includes(key)))fail('Use supported time-charge fields');
  if(typeof entry.entryId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(entry.entryId)||ids.has(entry.entryId.toLowerCase()))fail('Each time entry must have a unique valid ID');ids.add(entry.entryId.toLowerCase());
  if(!Number.isSafeInteger(entry.minutes)||entry.minutes<1||entry.minutes>1440)fail('Time entry minutes must be a whole number from 1 to 1440');
  if(typeof entry.hourlyMinor!=='string'||!/^[1-9]\d{0,15}$/.test(entry.hourlyMinor)||BigInt(entry.hourlyMinor)>MAX)fail('Hourly rate must be a positive canonical integer minor-unit string within range');
  if(!['USD','GBP','PKR'].includes(entry.currency)||currency&&currency!==entry.currency)fail('Choose one supported currency for the invoice');currency=entry.currency;
  const amount=(BigInt(entry.minutes)*BigInt(entry.hourlyMinor)+30n)/60n;total+=amount;
  if(amount>MAX||total>MAX)throw new ApiError(400,'AMOUNT_RANGE','Time charges exceed the supported invoice amount');
  return {entryId:entry.entryId,minutes:entry.minutes,hourlyMinor:entry.hourlyMinor,currency,subtotalMinor:amount.toString()};
 });
 return {currency,rounding:'HALF_UP_PER_ENTRY',lines,subtotalMinor:total.toString()};
}
