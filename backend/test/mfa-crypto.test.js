import test from 'node:test';
import assert from 'node:assert/strict';
import {totpCode,verifyTotp,newTotpSecret,base32Encode,base32Decode,createMfaCipher} from '../src/platform/mfa/crypto.js';
test('TOTP matches all RFC6238 Appendix B SHA1/SHA256/SHA512 vectors including future64bit time',()=>{
 const times=[59,1111111109,1111111111,1234567890,2000000000,20000000000],secret='1234567890123456789012345678901234567890123456789012345678901234';
 for(const [algorithm,length,codes]of [['sha1',20,['94287082','07081804','14050471','89005924','69279037','65353130']],['sha256',32,['46119246','68084774','67062674','91819424','90698825','77737706']],['sha512',64,['90693936','25091201','99943326','93441116','38618901','47863826']]])for(let i=0;i<times.length;i++)assert.equal(totpCode(Buffer.from(secret.slice(0,length)),{timeMs:times[i]*1000,digits:8,algorithm}),codes[i]);
});
test('TOTP strict formatting, narrow clock window, replay counter and canonical base32',()=>{
 const secret=newTotpSecret(),timeMs=1234567890000,counter=Math.floor(timeMs/30000),code=totpCode(secret,{timeMs});assert.equal(secret.length,32);assert.equal(base32Encode(base32Decode(secret)),secret);assert.equal(verifyTotp(secret,code,{timeMs}),counter);assert.equal(verifyTotp(secret,code,{timeMs,lastCounter:counter}),null);assert.equal(verifyTotp(secret,code,{timeMs:timeMs+120000}),null);assert.equal(verifyTotp(secret,' '+code,{timeMs}),null);assert.equal(verifyTotp(secret,Number(code),{timeMs}),null);assert.throws(()=>base32Decode(secret.toLowerCase()));assert.throws(()=>totpCode(secret,{timeMs:-1}));
});
test('MFA encryption authenticates account/version/key context, rejects tampering and supports retained old keys',()=>{
 const secret=newTotpSecret(),keys={first:Buffer.alloc(32,17),second:Buffer.alloc(32,29)},old=createMfaCipher({activeKeyId:'first',keys}),current=createMfaCipher({activeKeyId:'second',keys}),a=old.seal(secret,'user-a'),b=old.seal(secret,'user-a');assert.notEqual(a,b);assert.equal(a.includes(secret),false);assert.equal(current.open(a,'user-a'),secret);assert.throws(()=>current.open(a,'user-b'),/could not be opened/);const parts=a.split('.');parts[4]=(parts[4][0]==='A'?'B':'A')+parts[4].slice(1);assert.throws(()=>current.open(parts.join('.'),'user-a'),/could not be opened/);assert.throws(()=>createMfaCipher({activeKeyId:'second',keys:{second:keys.second}}).open(a,'user-a'));assert.throws(()=>createMfaCipher({activeKeyId:'missing',keys}));assert.throws(()=>current.open(a.replace('v1.','v2.'),'user-a'));
});
