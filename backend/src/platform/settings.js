import {randomUUID} from 'node:crypto';
import {createPlatformService} from './service.js';
import {ApiError} from '../middleware/errorHandler.js';
const defaults={legalName:'',defaultCurrency:'USD',locale:'en-US',timezone:'UTC'};
export function settingsSql(prefix=''){return `CREATE TABLE ${prefix}platform_organization_settings(organization_id TEXT PRIMARY KEY REFERENCES ${prefix}platform_organizations(id),legal_name TEXT NOT NULL,default_currency TEXT NOT NULL,locale TEXT NOT NULL,timezone TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),updated_at TEXT NOT NULL,updated_by TEXT NOT NULL,FOREIGN KEY(organization_id,updated_by) REFERENCES ${prefix}platform_memberships(organization_id,user_id));`;}
export function settingsRlsSql(){return `ALTER TABLE novaworks.platform_organization_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE novaworks.platform_organization_settings FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_select ON novaworks.platform_organization_settings FOR SELECT USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')); CREATE POLICY tenant_insert ON novaworks.platform_organization_settings FOR INSERT WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')); CREATE POLICY tenant_update ON novaworks.platform_organization_settings FOR UPDATE USING(organization_id=NULLIF(current_setting('app.organization_id',true),'')) WITH CHECK(organization_id=NULLIF(current_setting('app.organization_id',true),'')); REVOKE ALL ON novaworks.platform_organization_settings FROM PUBLIC;`;}
export function createSettingsService(db){
 const platform=createPlatformService(db),t=name=>`${db.kind==='postgres'?'novaworks.':''}platform_${name}`,bad=message=>{throw new ApiError(400,'BAD_INPUT',message);};
 const read=async c=>{const row=(await c.query(`SELECT * FROM ${t('organization_settings')} WHERE organization_id=?`,[c.organizationId])).rows[0];return row?{organizationId:c.organizationId,legalName:row.legal_name,defaultCurrency:row.default_currency,locale:row.locale,timezone:row.timezone,version:row.version,updatedAt:row.updated_at}:{organizationId:c.organizationId,...defaults,version:0,updatedAt:null};};
 return {get:(u,o)=>platform.transaction(u,o,read),update(u,o,input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!['version',...Object.keys(defaults)].includes(k))||!Number.isSafeInteger(input.version)||input.version<0)bad('Provide the current settings version and supported settings');
  const values={};for(const key of Object.keys(defaults)){if(typeof input[key]!=='string')bad(`Provide ${key}`);values[key]=input[key].trim();}
  if(!values.legalName||values.legalName.length>180||/[\u0000-\u001f\u007f]/.test(values.legalName))bad('Legal name must contain 1 to 180 printable characters');
  if(!['USD','GBP','PKR'].includes(values.defaultCurrency))bad('Supported business currencies: USD, GBP, PKR');
  try{if(!values.locale||values.locale.length>40||Intl.getCanonicalLocales(values.locale)[0]!==values.locale||Intl.DateTimeFormat.supportedLocalesOf([values.locale]).length!==1)bad('Choose a supported canonical locale');}catch{bad('Choose a supported canonical locale');}
  try{if(!values.timezone||values.timezone.length>80)bad('Choose a supported timezone');new Intl.DateTimeFormat('en',{timeZone:values.timezone}).format();}catch{bad('Choose a supported timezone');}
  return platform.transaction(u,o,async c=>{
   if(!['OWNER','ADMIN'].includes(c.member.role))throw new ApiError(403,'ROLE_FORBIDDEN','Company administrator access required');
   if(db.kind==='postgres')await c.query('SELECT pg_advisory_xact_lock(hashtext(?))',[`settings:${o}`]);
   const current=await read(c);if(current.version!==input.version)throw new ApiError(409,'VERSION_CONFLICT','Company settings changed. Reload the current values before saving.');
   const at=new Date().toISOString();if(current.version===0)await c.query(`INSERT INTO ${t('organization_settings')}(organization_id,legal_name,default_currency,locale,timezone,version,updated_at,updated_by) VALUES(?,?,?,?,?,1,?,?)`,[o,values.legalName,values.defaultCurrency,values.locale,values.timezone,at,u]);
   else await c.query(`UPDATE ${t('organization_settings')} SET legal_name=?,default_currency=?,locale=?,timezone=?,version=version+1,updated_at=?,updated_by=? WHERE organization_id=? AND version=?`,[values.legalName,values.defaultCurrency,values.locale,values.timezone,at,u,o,current.version]);
   await c.query(`INSERT INTO ${t('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?,?)`,[o,randomUUID(),u,'organization.settings_updated',o,at]);return read(c);
  });
 }};
}
