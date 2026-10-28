import {randomUUID} from 'node:crypto';
import {ApiError} from '../../middleware/errorHandler.js';
import {createPlatformService} from '../../platform/service.js';
const MAX=9007199254740991n,roles=['OWNER','ADMIN','MANAGER'],statuses=['DRAFT','ISSUED','ACCEPTED','DECLINED','SUPERSEDED'];
const fail=(status,code,message)=>{throw new ApiError(status,code,message);};
const has=(o,k)=>Object.hasOwn(o,k),now=()=>new Date().toISOString();
function text(value,label,max=200,required=true){if(value===undefined&&!required)return '';if(typeof value!=='string'||value.includes('\0')||value.trim().length>max||required&&!value.trim())fail(400,'BAD_INPUT',`${label} must be ${required?'nonempty ':''}text up to ${max} characters without NUL`);return value.trim();}
function input(value,keys){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!keys.includes(key)))fail(400,'BAD_INPUT','Use a JSON object with supported fields');return value;}
function version(value){if(!Number.isSafeInteger(value)||value<1)fail(400,'BAD_INPUT','A positive integer version is required');return value;}
function date(value){if(value===null||value===undefined||value==='')return null;value=text(value,'Valid until',10);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail(400,'BAD_INPUT','Valid until must be a real YYYY-MM-DD date');return value;}
function currency(value){if(!['USD','GBP','PKR'].includes(value))fail(400,'BAD_INPUT','Supported currencies: USD, GBP, PKR');return value;}
function minor(value){if(typeof value!=='string'||!/^(0|[1-9]\d*)$/.test(value)||value.length>16||BigInt(value)>MAX)fail(400,'BAD_INPUT','Unit price must be a canonical minor-unit integer string within range');return BigInt(value);}
function bounded(value){if(value>MAX)fail(400,'AMOUNT_RANGE','Quote totals exceed the supported range');return value.toString();}
export function calculateItems(value){
 if(!Array.isArray(value)||value.length<1||value.length>50)fail(400,'BAD_INPUT','Add 1 to 50 quote items');let subtotal=0n,tax=0n;
 const items=value.map((entry,index)=>{const line=input(entry,['description','quantity','unitMinor','taxRateBps']);if(!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>1000000)fail(400,'BAD_INPUT','Quantity must be a whole number from 1 to 1000000');const rate=has(line,'taxRateBps')?line.taxRateBps:0;if(!Number.isSafeInteger(rate)||rate<0||rate>10000)fail(400,'BAD_INPUT','Tax rate must be integer basis points from 0 to 10000');const unit=minor(line.unitMinor),base=unit*BigInt(line.quantity),charge=(base*BigInt(rate)+5000n)/10000n;subtotal+=base;tax+=charge;return{position:index+1,description:text(line.description,'Item description',1000),quantity:line.quantity,unit_minor:unit.toString(),tax_rate_bps:rate,subtotal_minor:bounded(base),tax_minor:bounded(charge),total_minor:bounded(base+charge)};});
 return {items,subtotal_minor:bounded(subtotal),tax_minor:bounded(tax),total_minor:bounded(subtotal+tax)};
}
const normalize=row=>row&&Object.fromEntries(Object.entries(row).map(([key,value])=>[key,key.endsWith('_minor')&&value!==null?String(value):value]));
const itemInput=item=>({description:item.description,quantity:item.quantity,unitMinor:String(item.unit_minor),taxRateBps:item.tax_rate_bps});
export function createSalesService(db){
 const platform=createPlatformService(db),prefix=db.kind==='postgres'?'novaworks.':'',t=name=>`${prefix}platform_${name}`,lock=db.kind==='postgres'?' FOR UPDATE':'';
 const tx=(userId,organizationId,work)=>platform.transaction(userId,organizationId,context=>{if(!roles.includes(context.member?.role))fail(403,'ROLE_FORBIDDEN','Sales access requires management permission');return work(context);});
 const edit=(context,row)=>{if(context.member.role==='MANAGER'&&row.owner_id!==context.userId)fail(403,'ROLE_FORBIDDEN','Managers may change only records they own');};
 const admin=context=>{if(!['OWNER','ADMIN'].includes(context.member.role))fail(403,'ROLE_FORBIDDEN','An owner or administrator must record customer approval');};
 const audit=(c,action,id)=>c.query(`INSERT INTO ${t('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES (?,?,?,?,?,?)`,[c.organizationId,randomUUID(),c.userId,action,id,now()]);
 const expected=(row,value)=>{version(value);if(row.version!==value)fail(409,'VERSION_CONFLICT','This record changed. Reload saved information before retrying.');};
 async function get(c,kind,id,locked=false){id=text(id,'Record ID');const row=(await c.query(`SELECT * FROM ${t(kind)} WHERE organization_id=? AND id=?${locked?lock:''}`,[c.organizationId,id])).rows[0];if(!row)fail(404,'NOT_FOUND','Sales record or related customer/deal not found');return normalize(row);}
 async function detail(c,kind,id){const record=await get(c,kind,id),items=await c.query(`SELECT * FROM ${t(kind==='quotes'?'quote_items':'sales_order_items')} WHERE organization_id=? AND ${kind==='quotes'?'quote_id':'order_id'}=? ORDER BY position`,[c.organizationId,id]);return {...record,items:items.rows.map(normalize)};}
 // Match the pipeline's deal -> customer lock order to avoid opposing row locks.
 async function relations(c,customerId,dealId){if(dealId){const deal=await get(c,'deals',dealId,true);edit(c,deal);if(deal.customer_id!==customerId)fail(400,'BAD_RELATION','Deal must belong to the selected customer');}const customer=await get(c,'customers',customerId,true);edit(c,customer);return customer;}
 async function quoteItems(c,id,items){for(const line of items)await c.query(`INSERT INTO ${t('quote_items')}(organization_id,quote_id,position,description,quantity,unit_minor,tax_rate_bps,subtotal_minor,tax_minor,total_minor) VALUES (?,?,?,?,?,?,?,?,?,?)`,[c.organizationId,id,line.position,line.description,line.quantity,line.unit_minor,line.tax_rate_bps,line.subtotal_minor,line.tax_minor,line.total_minor]);}
 async function insert(c,data,previous=null){
  const customer=await relations(c,data.customerId,data.dealId),amounts=calculateItems(data.items),id=randomUUID(),time=now();
  await c.query(`INSERT INTO ${t('quotes')}(organization_id,id,customer_id,deal_id,owner_id,title,currency,terms,valid_until,supersedes_quote_id,customer_name,customer_email,subtotal_minor,tax_minor,total_minor,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[c.organizationId,id,customer.id,data.dealId,data.ownerId??c.userId,text(data.title,'Quote title'),currency(data.currency),text(data.terms,'Terms',10000,false),date(data.validUntil),previous,customer.name,customer.email,amounts.subtotal_minor,amounts.tax_minor,amounts.total_minor,time,time]);
  await quoteItems(c,id,amounts.items);await audit(c,'quote.created',id);return detail(c,'quotes',id);
 }
 async function list(c,kind,query={}){
  const integer=(key,fallback,max)=>{if(query[key]===undefined)return fallback;if(typeof query[key]!=='string'||!/^\d+$/.test(query[key])||!Number.isSafeInteger(Number(query[key]))||Number(query[key])<1||Number(query[key])>max)fail(400,'BAD_INPUT',`Invalid ${key}`);return Number(query[key]);};
  const page=integer('page',1,1000000),limit=integer('limit',25,100),where=['organization_id=?'],args=[c.organizationId];
  if(query.q!==undefined){const q=text(query.q,'Search',200,false);where.push("(LOWER(title) LIKE ? ESCAPE '!' OR LOWER(customer_name) LIKE ? ESCAPE '!')");const pattern=`%${q.toLowerCase().replace(/[!%_]/g,'!$&')}%`;args.push(pattern,pattern);}
  if(query.status!==undefined&&kind==='quotes'){if(!statuses.includes(query.status))fail(400,'BAD_INPUT','Invalid quote status');where.push('status=?');args.push(query.status);}
  const clause=where.join(' AND '),total=Number((await c.query(`SELECT COUNT(*) AS count FROM ${t(kind)} WHERE ${clause}`,args)).rows[0].count),rows=(await c.query(`SELECT * FROM ${t(kind)} WHERE ${clause} ORDER BY created_at DESC,id LIMIT ? OFFSET ?`,[...args,limit,(page-1)*limit])).rows;
  return{[kind==='quotes'?'quotes':'orders']:rows.map(normalize),pagination:{page,limit,total,totalPages:Math.ceil(total/limit)}};
 }
 return{
  quotes:(u,o,q)=>tx(u,o,c=>list(c,'quotes',q)),orders:(u,o,q)=>tx(u,o,c=>list(c,'sales_orders',q)),quote:(u,o,id)=>tx(u,o,c=>detail(c,'quotes',id)),order:(u,o,id)=>tx(u,o,c=>detail(c,'sales_orders',id)),
  create(u,o,value){return tx(u,o,async c=>{const body=input(value,['customerId','dealId','title','currency','terms','validUntil','items']);return insert(c,{...body,dealId:body.dealId===undefined||body.dealId===null?null:text(body.dealId,'Deal ID')});});},
  update(u,o,id,value){return tx(u,o,async c=>{
   const body=input(value,['version','title','currency','terms','validUntil','items']),old=await get(c,'quotes',id,true);edit(c,old);expected(old,body.version);if(old.status!=='DRAFT')fail(409,'QUOTE_LOCKED','Issued terms cannot be edited. Create a revision instead.');
   await relations(c,old.customer_id,old.deal_id);
   const saved=await detail(c,'quotes',id),amounts=calculateItems(has(body,'items')?body.items:saved.items.map(itemInput));
   await c.query(`UPDATE ${t('quotes')} SET title=?,currency=?,terms=?,valid_until=?,subtotal_minor=?,tax_minor=?,total_minor=?,version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[has(body,'title')?text(body.title,'Quote title'):old.title,has(body,'currency')?currency(body.currency):old.currency,has(body,'terms')?text(body.terms,'Terms',10000,false):old.terms,has(body,'validUntil')?date(body.validUntil):old.valid_until,amounts.subtotal_minor,amounts.tax_minor,amounts.total_minor,now(),o,id]);
   await c.query(`DELETE FROM ${t('quote_items')} WHERE organization_id=? AND quote_id=?`,[o,id]);await quoteItems(c,id,amounts.items);await audit(c,'quote.updated',id);return detail(c,'quotes',id);
  });},
  issue(u,o,id,value){return tx(u,o,async c=>{
   const body=input(value,['version']),old=await get(c,'quotes',id,true);edit(c,old);expected(old,body.version);if(old.status!=='DRAFT')fail(409,'QUOTE_LOCKED','Only a draft can be issued');const customer=await relations(c,old.customer_id,old.deal_id);if(old.valid_until&&old.valid_until<now().slice(0,10))fail(409,'QUOTE_EXPIRED','Change the expired valid-until date before issuing');
   await c.query(`UPDATE ${t('quotes')} SET status='ISSUED',customer_name=?,customer_email=?,issued_at=?,version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[customer.name,customer.email,now(),now(),o,id]);await audit(c,'quote.issued',id);return detail(c,'quotes',id);
  });},
  decide(u,o,id,value,accept){return tx(u,o,async c=>{
   admin(c);const body=input(value,accept?['version','approvalReference']:['version','reason']),old=await get(c,'quotes',id,true);expected(old,body.version);if(old.status!=='ISSUED')fail(409,'QUOTE_LOCKED','Only the current issued quote can receive a decision');
   if(accept){if(old.valid_until&&old.valid_until<now().slice(0,10))fail(409,'QUOTE_EXPIRED','Expired quotes need a new revision before acceptance');await c.query(`UPDATE ${t('quotes')} SET status='ACCEPTED',accepted_at=?,accepted_by=?,approval_reference=?,version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[now(),u,text(body.approvalReference,'Approval reference',2000),now(),o,id]);}
   else await c.query(`UPDATE ${t('quotes')} SET status='DECLINED',decline_reason=?,version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[text(body.reason,'Decline reason',2000),now(),o,id]);
   await audit(c,accept?'quote.accepted':'quote.declined',id);return detail(c,'quotes',id);
  });},
  revise(u,o,id,value){return tx(u,o,async c=>{
   const body=input(value,['version']);version(body.version);const old=await get(c,'quotes',id,true);edit(c,old);await relations(c,old.customer_id,old.deal_id);
   const existing=(await c.query(`SELECT id FROM ${t('quotes')} WHERE organization_id=? AND supersedes_quote_id=?`,[o,id])).rows[0];if(existing){const next=await get(c,'quotes',existing.id);edit(c,next);return{quote:await detail(c,'quotes',next.id),replayed:true};}
   expected(old,body.version);if(!['ISSUED','DECLINED'].includes(old.status))fail(409,'QUOTE_LOCKED','Only issued or declined quotes can be revised');
   const saved=await detail(c,'quotes',id),quote=await insert(c,{customerId:old.customer_id,dealId:old.deal_id,ownerId:old.owner_id,title:old.title,currency:old.currency,terms:old.terms,validUntil:old.valid_until,items:saved.items.map(itemInput)},id);
   await c.query(`UPDATE ${t('quotes')} SET status='SUPERSEDED',version=version+1,updated_at=? WHERE organization_id=? AND id=?`,[now(),o,id]);await audit(c,'quote.superseded',id);return{quote,replayed:false};
  });},
  convert(u,o,id,value){return tx(u,o,async c=>{
   const body=input(value,['version']);version(body.version);const quote=await get(c,'quotes',id,true);edit(c,quote);await relations(c,quote.customer_id,quote.deal_id);
   const existing=(await c.query(`SELECT id FROM ${t('sales_orders')} WHERE organization_id=? AND quote_id=?`,[o,id])).rows[0];if(existing){const order=await get(c,'sales_orders',existing.id);edit(c,order);return {order:await detail(c,'sales_orders',order.id),replayed:true};}
   expected(quote,body.version);if(quote.status!=='ACCEPTED')fail(409,'QUOTE_NOT_ACCEPTED','Record customer acceptance before creating a sales order');
   const saved=await detail(c,'quotes',id),orderId=randomUUID(),fields=['customer_id','deal_id','owner_id','title','currency','terms','valid_until','customer_name','customer_email','subtotal_minor','tax_minor','total_minor','accepted_at','accepted_by','approval_reference'];
   await c.query(`INSERT INTO ${t('sales_orders')}(organization_id,id,quote_id,quote_version,${fields.join(',')},created_at) VALUES (${Array(fields.length+5).fill('?').join(',')})`,[o,orderId,id,quote.version,...fields.map(field=>quote[field]),now()]);
   for(const item of saved.items)await c.query(`INSERT INTO ${t('sales_order_items')}(organization_id,order_id,position,description,quantity,unit_minor,tax_rate_bps,subtotal_minor,tax_minor,total_minor) VALUES (?,?,?,?,?,?,?,?,?,?)`,[o,orderId,item.position,item.description,item.quantity,item.unit_minor,item.tax_rate_bps,item.subtotal_minor,item.tax_minor,item.total_minor]);
   await audit(c,'sales_order.created',orderId);return{order:await detail(c,'sales_orders',orderId),replayed:false};
  });}
 };
}
