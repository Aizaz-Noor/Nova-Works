import {createHmac,randomBytes,timingSafeEqual,createCipheriv,createDecipheriv} from 'node:crypto';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32Encode(bytes){let value=0,bits=0,result='';for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){bits-=5;result+=alphabet[(value>>>bits)&31];}}if(bits)result+=alphabet[(value<<(5-bits))&31];return result;}
export function base32Decode(value){if(typeof value!=='string'||value.length<32||value.length>103||!/^[A-Z2-7]+$/.test(value))throw new Error('Invalid authenticator secret');let buffer=0,bits=0;const result=[];for(const char of value){buffer=(buffer<<5)|alphabet.indexOf(char);bits+=5;if(bits>=8){bits-=8;result.push((buffer>>>bits)&255);}}const bytes=Buffer.from(result);if(bytes.length<20||bytes.length>64||base32Encode(bytes)!==value)throw new Error('Invalid authenticator secret');return bytes;}
export const newTotpSecret=()=>base32Encode(randomBytes(20));
function secretBytes(secret){const bytes=typeof secret==='string'?base32Decode(secret):secret;if(!Buffer.isBuffer(bytes)||bytes.length<20||bytes.length>64)throw new Error('Invalid authenticator secret');return bytes;}
export function totpCode(secret,{timeMs=Date.now(),stepSeconds=30,digits=6,algorithm='sha1'}={}){
 if(!Number.isSafeInteger(timeMs)||timeMs<0||!Number.isSafeInteger(stepSeconds)||stepSeconds<15||stepSeconds>120||![6,8].includes(digits)||!['sha1','sha256','sha512'].includes(algorithm))throw new Error('Invalid authenticator parameters');
 const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(timeMs/(stepSeconds*1000))));const hash=createHmac(algorithm,secretBytes(secret)).update(counter).digest(),offset=hash[hash.length-1]&15,binary=hash.readUInt32BE(offset)&0x7fffffff;return String(binary%(10**digits)).padStart(digits,'0');
}
// Returns the accepted moving counter; callers must persist it atomically.
export function verifyTotp(secret,code,{timeMs=Date.now(),lastCounter=-1}={}){
 if(typeof code!=='string'||!/^\d{6}$/.test(code)||!Number.isSafeInteger(timeMs)||timeMs<0||!Number.isSafeInteger(lastCounter)||lastCounter< -1)return null;
 const current=Math.floor(timeMs/30000),provided=Buffer.from(code);let match=null;
 for(const offset of [-1,0,1]){const counter=current+offset;if(counter<0)continue;const expected=Buffer.from(totpCode(secret,{timeMs:counter*30000}));if(timingSafeEqual(provided,expected)&&counter>lastCounter)match=match===null?counter:Math.max(match,counter);}
 return match;
}
export function createMfaCipher({activeKeyId,keys}={}){
 const validId=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,32}$/.test(value),ring=new Map();if(!validId(activeKeyId)||!keys||typeof keys!=='object'||Array.isArray(keys))throw new Error('MFA encryption configuration required');
 for(const [id,key]of Object.entries(keys)){if(!validId(id)||!Buffer.isBuffer(key)||key.length!==32)throw new Error('MFA encryption configuration required');ring.set(id,Buffer.from(key));}if(!ring.has(activeKeyId))throw new Error('MFA encryption configuration required');
 const context=(userId,keyId)=>{if(typeof userId!=='string'||!userId||userId.length>100||userId.includes('\0'))throw new Error('MFA account context required');return Buffer.from(JSON.stringify({version:1,purpose:'novaworks.totp',userId,keyId}));};
 return {seal(secret,userId){const nonce=randomBytes(12),cipher=createCipheriv('aes-256-gcm',ring.get(activeKeyId),nonce);cipher.setAAD(context(userId,activeKeyId));const encrypted=Buffer.concat([cipher.update(secretBytes(secret)),cipher.final()]);return ['v1',activeKeyId,nonce.toString('base64url'),cipher.getAuthTag().toString('base64url'),encrypted.toString('base64url')].join('.');},open(value,userId){
  try{if(typeof value!=='string'||value.length>512)throw Error();const parts=value.split('.');if(parts.length!==5||parts[0]!=='v1'||!validId(parts[1])||!ring.has(parts[1])||parts.slice(2).some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))throw Error();const [nonce,tag,encrypted]=parts.slice(2).map(p=>Buffer.from(p,'base64url'));if(nonce.length!==12||tag.length!==16||encrypted.length<20||encrypted.length>64||parts.slice(2).some((p,i)=>[nonce,tag,encrypted][i].toString('base64url')!==p))throw Error();const decipher=createDecipheriv('aes-256-gcm',ring.get(parts[1]),nonce);decipher.setAAD(context(userId,parts[1]));decipher.setAuthTag(tag);return base32Encode(Buffer.concat([decipher.update(encrypted),decipher.final()]));}catch{throw new Error('MFA secret could not be opened');}
 }};
}
