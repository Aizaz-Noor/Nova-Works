import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {calculateTimeCharges} from '../src/modules/timesheets/timeCharges.js';
const entry=(minutes,hourlyMinor,currency='USD')=>({entryId:randomUUID(),minutes,hourlyMinor,currency});
test('time charges round each integer-minute entry half-up and preserve large exact amounts',()=>{
 assert.equal(calculateTimeCharges([entry(90,'12345')]).subtotalMinor,'18518');
 assert.equal(calculateTimeCharges([entry(1,'30'),entry(1,'30')]).subtotalMinor,'2');
 assert.equal(calculateTimeCharges([entry(1,'1')]).subtotalMinor,'0');
 assert.equal(calculateTimeCharges([entry(60,'9007199254740991','PKR')]).subtotalMinor,'9007199254740991');
 const large=calculateTimeCharges([entry(30,'9007199254740991'),entry(30,'9007199254740989')]);assert.equal(large.subtotalMinor,'9007199254740991');assert.equal(large.rounding,'HALF_UP_PER_ENTRY');
});
test('time charges reject duplicate sources, mixed currencies, invalid rates and overflow',()=>{
 const one=entry(60,'100');for(const values of [[],[one,one],[one,{...one,entryId:one.entryId.toUpperCase()}],[one,entry(60,'100','GBP')],[entry(60,'01')],[entry(1.5,'100')],[entry(1441,'100')],[entry(60,'1e3')],[entry(60,100)],[entry(1440,'9007199254740991')],[entry(60,'9007199254740991'),entry(1,'60')]])assert.throws(()=>calculateTimeCharges(values),error=>error.status===400);
});
