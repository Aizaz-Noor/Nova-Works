import {requireBillingFeature} from '../../platform/billing/policy.js';
import {randomUUID} from 'node:crypto';
import {createPlatformService} from '../../platform/service.js';
import {ApiError} from '../../middleware/errorHandler.js';
const initialized=new WeakSet();
export function createReportService(db,{clock=()=>Date.now()}={}){
 const pg=db.kind==='postgres',prefix=pg?'novaworks.':'',t=name=>`${prefix}platform_${name}`,platform=createPlatformService(db);
 // SQLite SUM can overflow even when each valid record is within range. Aggregate
 // exact integers in the SQL engine without fetching all business rows into JS.
 if(!pg&&!initialized.has(db)){db.aggregate('nw_report_sum',{start:0n,useBigIntArguments:true,step:(sum,value)=>sum+(value===null?0n:BigInt(value)),result:sum=>sum.toString()});initialized.add(db);}
 const sum=expression=>pg?`CAST(COALESCE(SUM(${expression}),0) AS TEXT)`:`COALESCE(nw_report_sum(${expression}),'0')`;
 const counts=rows=>rows.map(row=>({...row,count:String(row.count),...(row.priced_count!==undefined?{priced_count:String(row.priced_count)}:{})}));
 async function sales(c,currency){
  const owned=c.member.role==='MANAGER'?' AND owner_id=?':'',args=[c.organizationId,...(owned?[c.userId]:[]),...(currency?[currency]:[])],filter=currency?' AND currency=?':'';
  return {
   deals:counts((await c.query(`SELECT stage_code AS status,currency,COUNT(*) AS count,COUNT(amount_minor) AS priced_count,${sum('amount_minor')} AS amount_minor FROM ${t('deals')} WHERE organization_id=?${owned}${filter} GROUP BY stage_code,currency ORDER BY currency,stage_code`,args)).rows),
   quotes:counts((await c.query(`SELECT status,currency,COUNT(*) AS count,${sum('total_minor')} AS amount_minor FROM ${t('quotes')} WHERE organization_id=?${owned}${filter} AND status<>'SUPERSEDED' GROUP BY status,currency ORDER BY currency,status`,args)).rows),
   orders:counts((await c.query(`SELECT currency,COUNT(*) AS count,${sum('total_minor')} AS amount_minor FROM ${t('sales_orders')} WHERE organization_id=?${owned}${filter} GROUP BY currency ORDER BY currency`,args)).rows)
  };
 }
 async function delivery(c){
  const manager=c.member.role==='MANAGER',member=c.member.role==='MEMBER';
  const projectScope=manager?' AND p.manager_id=?':member?` AND EXISTS(SELECT 1 FROM ${t('tasks')} a WHERE a.organization_id=p.organization_id AND a.project_id=p.id AND a.assignee_id=?)`:'';
  const taskScope=manager?' AND p.manager_id=?':member?' AND a.assignee_id=?':'';
  const timeScope=manager?' AND p.manager_id=?':member?' AND e.user_id=?':'';
  const args=[c.organizationId,...((manager||member)?[c.userId]:[])];
  return {
   projects:counts((await c.query(`SELECT p.status,COUNT(*) AS count FROM ${t('projects')} p WHERE p.organization_id=?${projectScope} GROUP BY p.status ORDER BY p.status`,args)).rows),
   tasks:counts((await c.query(`SELECT a.status,COUNT(*) AS count FROM ${t('tasks')} a JOIN ${t('projects')} p ON p.organization_id=a.organization_id AND p.id=a.project_id WHERE a.organization_id=?${taskScope} GROUP BY a.status ORDER BY a.status`,args)).rows),
   approvedTime:(await c.query(`SELECT ${sum('e.minutes')} AS minutes,${sum('CASE WHEN e.billable=1 THEN e.minutes ELSE 0 END')} AS billable_minutes FROM ${t('time_entries')} e JOIN ${t('projects')} p ON p.organization_id=e.organization_id AND p.id=e.project_id WHERE e.organization_id=? AND e.status='APPROVED'${timeScope}`,args)).rows[0]
  };
 }
 async function financial(c,currency,today){
  // Preaggregate active payment evidence before joining invoices. Never join raw
  // payments and credits together: that would multiply invoice amounts.
  const args=[c.organizationId,today,c.organizationId,...(currency?[currency]:[])];
  return {currencies:counts((await c.query(`WITH paid AS (
   SELECT p.organization_id,p.invoice_id,SUM(p.amount_minor) AS paid_minor FROM ${t('payment_records')} p WHERE p.organization_id=? AND p.kind='PAYMENT' AND NOT EXISTS(SELECT 1 FROM ${t('payment_records')} r WHERE r.organization_id=p.organization_id AND r.reverses_id=p.id AND r.kind='REVERSAL') GROUP BY p.organization_id,p.invoice_id
  ), balances AS (
   SELECT i.currency,i.total_minor,COALESCE(c.total_minor,0) AS credit_minor,COALESCE(p.paid_minor,0) AS paid_minor,i.total_minor-COALESCE(c.total_minor,0)-COALESCE(p.paid_minor,0) AS balance_minor,CASE WHEN i.due_on<? THEN 1 ELSE 0 END AS overdue
   FROM ${t('client_invoices')} i LEFT JOIN paid p ON p.organization_id=i.organization_id AND p.invoice_id=i.id LEFT JOIN ${t('credit_notes')} c ON c.organization_id=i.organization_id AND c.invoice_id=i.id
   WHERE i.organization_id=? AND i.status='ISSUED'${currency?' AND i.currency=?':''}
  ) SELECT currency,COUNT(*) AS count,${sum('total_minor')} AS issued_minor,${sum('credit_minor')} AS credited_minor,${sum('paid_minor')} AS paid_minor,${sum('balance_minor')} AS outstanding_minor,${sum('CASE WHEN overdue=1 THEN balance_minor ELSE 0 END')} AS overdue_minor FROM balances GROUP BY currency ORDER BY currency`,args)).rows)};
 }
 return {async get(userId,organizationId,kind,filters={},exporting=false){
  if(!['sales','delivery','financial'].includes(kind))throw new ApiError(404,'NOT_FOUND','Unknown report');
  if(!filters||typeof filters!=='object'||Array.isArray(filters)||Object.keys(filters).some(k=>k!=='currency')||filters.currency!==undefined&&!['USD','GBP','PKR'].includes(filters.currency)||kind==='delivery'&&filters.currency!==undefined)throw new ApiError(400,'BAD_INPUT','Use a supported report currency filter');
  return platform.transaction(userId,organizationId,async c=>{
   const admin=['OWNER','ADMIN'].includes(c.member.role);
   if(kind==='financial'&&!admin||kind==='sales'&&!admin&&c.member.role!=='MANAGER')throw new ApiError(403,'ROLE_FORBIDDEN','You do not have permission to view this report');
   if(kind!=='delivery')await requireBillingFeature(db,c,'reports');
   const generatedAt=new Date(clock()).toISOString(),scope=admin?'company':c.member.role==='MANAGER'?'managed':'personal';
   const data=kind==='sales'?await sales(c,filters.currency):kind==='delivery'?await delivery(c):await financial(c,filters.currency,generatedAt.slice(0,10));
   if(exporting)await c.query(`INSERT INTO ${t('audit')}(organization_id,id,actor_id,action,entity_id,created_at) VALUES(?,?,?,?,?,?)`,[organizationId,randomUUID(),userId,'report.exported',kind,generatedAt]);
   return {kind,organizationId,scope,generatedAt,filters,...data};
  },{snapshot:true});
 }};
}
