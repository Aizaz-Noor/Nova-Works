import {createMfaCipher} from './crypto.js';
export function mfaOptionsFromEnvironment(env=process.env){
 if(!env.MFA_KEYRING_JSON)return {};
 try{const config=JSON.parse(env.MFA_KEYRING_JSON);if(!config||typeof config!=='object'||Array.isArray(config)||Object.keys(config).some(k=>!['activeKeyId','keys'].includes(k))||!config.keys||typeof config.keys!=='object'||Array.isArray(config.keys)||Object.keys(config.keys).length<1||Object.keys(config.keys).length>8)throw Error();const keys={};for(const [id,value]of Object.entries(config.keys)){if(typeof value!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(value))throw Error();const bytes=Buffer.from(value,'base64');if(bytes.length!==32||bytes.toString('base64')!==value)throw Error();keys[id]=bytes;}return {cipher:createMfaCipher({activeKeyId:config.activeKeyId,keys})};}catch{throw new Error('MFA encryption configuration is invalid');}
}
