import CompanyMembers from './CompanyMembers.jsx';
import Notifications from './Notifications.jsx';
import CompanyProjects from './CompanyProjects.jsx';
import WorkspaceIcon from './WorkspaceIcon.jsx';
import AccountSecurity from './AccountSecurity.jsx';
import SettingsWorkspace from './SettingsWorkspace.jsx';
import BillingWorkspace from './BillingWorkspace.jsx';
import ReportWorkspace from './ReportWorkspace.jsx';
import OverviewWorkspace from './OverviewWorkspace.jsx';
import CompanyAiWorkspace from './CompanyAiWorkspace.jsx';
import React, { useEffect, useRef, useState } from 'react';
import { request, createCompanyRequest, CompanyRequestProvider } from './api.js';
import CompanyTasks from './CompanyTasks.jsx';
import CustomerWorkspace from './CustomerWorkspace.jsx';
import InvoiceWorkspace from './InvoiceWorkspace.jsx';
import TimesheetWorkspace from './TimesheetWorkspace.jsx';
import QuotesWorkspace from './QuotesWorkspace.jsx';
import PipelineWorkspace from './PipelineWorkspace.jsx';

const statuses = ['PLANNED', 'ACTIVE', 'DONE', 'ARCHIVED'];
const statusLabel = value => value.charAt(0) + value.slice(1).toLowerCase();

export default function OrganizationWorkspace({ user, onExpired, onPasswordChanged }) {
 const [companyBilling,setCompanyBilling]=useState(null);
 const [invoiceSeed,setInvoiceSeed]=useState(null);
 const [quoteSeed,setQuoteSeed]=useState(null);
 const [workspaceView,setWorkspaceView]=useState('overview');
 const [moduleIntent,setModuleIntent]=useState({});
 const [organizations, setOrganizations] = useState([]);
 const [selected, setSelected] = useState('');
 useEffect(()=>setModuleIntent({}),[selected]);
 const [companyToolsOpen,setCompanyToolsOpen]=useState(true);
 useEffect(()=>setCompanyToolsOpen(!selected),[selected]);
 const selectedCompany=useRef(selected);selectedCompany.current=selected;
 const requestGeneration=useRef(0);
 const organizationBootstrapGeneration=useRef(0);
 const selectionGeneration=useRef(0);
 const selectionController=useRef(null);
 const [compactNavigation,setCompactNavigation]=useState(()=>window.matchMedia('(max-width: 1024px)').matches);
 const [moduleMenuOpen,setModuleMenuOpen]=useState(false);
 const [navigationRevision,setNavigationRevision]=useState(0);
 const moduleMenuButton=useRef(null);
 const focusModuleHeading=useRef(false);
 const moduleContent=useRef(null);
 const [members, setMembers] = useState([]);
 const [projects, setProjects] = useState([]);
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [notice, setNotice] = useState('');
 const [companyConflict, setCompanyConflict] = useState(false);
 const [projectStatusConflict, setProjectStatusConflict] = useState(null);
 const [projectDeadlineDraft,setProjectDeadlineDraft]=useState(null);
 const [projectSaveFocusRevision,setProjectSaveFocusRevision]=useState(0);
 const deadlineEditorIdentity=useRef(0),deadlineEditorCurrent=useRef(null);
 const projectConflictPanel=useRef(null);
 const focusProjectConflict=useRef(false);
 const focusProjectSuccess=useRef(false);
 const [invitation, setInvitation] = useState(null);
 const [companyName, setCompanyName] = useState('');
 const [projectName, setProjectName] = useState('');
 const [description, setDescription] = useState('');
 const [managerId, setManagerId] = useState('');
 const [inviteEmail, setInviteEmail] = useState('');
 const [inviteRole, setInviteRole] = useState('MEMBER');
 const [joinOrganization, setJoinOrganization] = useState('');
 const [joinToken, setJoinToken] = useState('');
 const expired = useRef(onExpired);
 expired.current = onExpired;
 const organization = organizations.find(item => item.id === selected);
 const canAdmin = ['OWNER', 'ADMIN'].includes(organization?.role);
 const canManage = canAdmin || organization?.role === 'MANAGER';
 const readOnly=companyBilling?.enabled&&companyBilling.access==='READ_ONLY';
 const moduleGroups=[
  ['Workspace',[['overview','Overview'],['delivery','Projects & tasks'],['time','Timesheets']]],
  ...(canManage?[['Sales',[['customers','Customers'],['pipeline','Pipeline'],['quotes','Quotes']]]]:[]),
  ...(canAdmin?[['Finance',[['invoices','Invoices']]]]:[]),
  ['Insights',[['reports','Reports'],...(canAdmin?[['ai','Meeting AI']]:[])]],
  ['Company',[...(canAdmin?[['billing','Subscription']]:[]),['settings','Settings']]]
 ];
 const modules=moduleGroups.flatMap(([,items])=>items);
 const activeWorkspaceView=modules.some(([id])=>id===workspaceView)?workspaceView:'overview';
 function chooseModule(value,options={}){if(!modules.some(([id])=>id===value))return;setModuleIntent(value==='time'&&canManage&&options.scope==='team'?{scope:'team'}:value==='invoices'&&canAdmin&&options.status==='ISSUED'?{status:'ISSUED'}:{});if(value==='quotes')setQuoteSeed(null);if(value==='invoices')setInvoiceSeed(null);focusModuleHeading.current=true;setWorkspaceView(value);setModuleMenuOpen(false);setNavigationRevision(revision=>revision+1);}

 useEffect(()=>{
  const query=window.matchMedia('(max-width: 1024px)');
  const update=()=>{setCompactNavigation(query.matches);if(!query.matches)setModuleMenuOpen(false);};
  update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);
 },[]);
 useEffect(()=>()=>{selectionGeneration.current++;selectionController.current?.abort();},[]);
 useEffect(()=>{
  if(!moduleMenuOpen)return;
  const escape=event=>{if(event.key==='Escape'){setModuleMenuOpen(false);moduleMenuButton.current?.focus();}};
  document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
 },[moduleMenuOpen]);
 useEffect(()=>{
  if(!focusModuleHeading.current)return;
  focusModuleHeading.current=false;
  const heading=moduleContent.current?.querySelector('h1, h2');
  if(heading){heading.tabIndex=-1;heading.focus();}
 },[workspaceView,selected,navigationRevision]);
 useEffect(()=>{if(selected&&!modules.some(([id])=>id===workspaceView))setWorkspaceView('overview');},[selected,workspaceView,canAdmin,canManage]);
 useEffect(()=>{if(focusProjectConflict.current&&projectStatusConflict){focusProjectConflict.current=false;projectConflictPanel.current?.focus();}},[projectStatusConflict]);
 useEffect(()=>{if(focusProjectSuccess.current&&notice){focusProjectSuccess.current=false;document.getElementById('erp-project-status-notice')?.focus();}},[notice,projectSaveFocusRevision]);

 function rememberProject(project,companyId){if(selectedCompany.current!==companyId||project.organization_id!==companyId)return;setProjects(current=>current.some(item=>item.id===project.id)?current.map(item=>item.id===project.id?project:item):[...current,project]);}
 function clearCompanyDrafts(){setProjectName('');setDescription('');setManagerId('');setInviteEmail('');setInviteRole('MEMBER');setInvitation(null);setQuoteSeed(null);setInvoiceSeed(null);setModuleIntent({});setWorkspaceView('overview');}

 function report(problem) {
  if (problem.status === 401) expired.current?.();
  setError(problem.message || 'The request could not be completed. Try again.');
 }
 useEffect(() => {
  const controller = new AbortController();
  const generation=++organizationBootstrapGeneration.current;
  setLoading(true);
  Promise.all([
   request('/v1/organizations', { signal: controller.signal }),
   request('/v1/context', { signal: controller.signal }).catch(problem => {
    if (problem.status === 403 || problem.status === 404 || problem.status === 409) return { organizationId: null };
    throw problem;
   })
  ]).then(([list, context]) => {
   if(controller.signal.aborted||generation!==organizationBootstrapGeneration.current)return;
   setOrganizations(list);
   setSelected(list.some(item => item.id === context.organizationId) ? context.organizationId : '');
  }).catch(problem => { if (!controller.signal.aborted&&generation===organizationBootstrapGeneration.current&&problem.name !== 'AbortError') report(problem); })
   .finally(() => { if (!controller.signal.aborted&&generation===organizationBootstrapGeneration.current) setLoading(false); });
  return () => {organizationBootstrapGeneration.current++;controller.abort();};
 }, [user.id]);

 useEffect(() => {
  const generation=++requestGeneration.current;
  setCompanyBilling(null);setWorkspaceView('overview');setModuleMenuOpen(false);setQuoteSeed(null);setInvoiceSeed(null);setMembers([]); setProjects([]); setInvitation(null); setManagerId('');setProjectStatusConflict(null);deadlineEditorIdentity.current++;deadlineEditorCurrent.current=null;setProjectDeadlineDraft(null);
  if (!selected) return;
  const controller = new AbortController();
  setLoading(true);
  const companyRequest=createCompanyRequest(selected, problem=>{setCompanyConflict(true);setError(problem.message);});
  Promise.all([
   companyRequest('/v1/members', { signal: controller.signal }),
   companyRequest('/v1/projects', { signal: controller.signal }),
   companyRequest('/v1/billing/context', { signal: controller.signal })
  ]).then(([people, work, billing]) => {
   if(controller.signal.aborted||generation!==requestGeneration.current||selectedCompany.current!==selected)return;
   const hasForeignOrganization=items=>items.some(item=>{
    const organizationId=item?.organization_id??item?.organizationId??item?.organization?.id;
    return organizationId!=null&&organizationId!==selected;
   });
   if(billing.organizationId!==selected||hasForeignOrganization(people)||hasForeignOrganization(work)){const mismatch=new Error('Company context changed while loading. Reload or select the company again.');mismatch.code='COMPANY_CONTEXT_MISMATCH';throw mismatch;}
   setCompanyBilling(billing);setMembers(people);setProjects(work);
  })
   .catch(problem => {
    if(controller.signal.aborted||generation!==requestGeneration.current||selectedCompany.current!==selected)return;
    if(problem.code==='COMPANY_CONTEXT_MISMATCH'){selectedCompany.current='';setSelected('');setCompanyBilling(null);setMembers([]);setProjects([]);setLoading(false);setError(problem.message);return;}
    report(problem);
   })
   .finally(() => { if (!controller.signal.aborted&&generation===requestGeneration.current&&selectedCompany.current===selected) setLoading(false); });
  return () => {requestGeneration.current++;controller.abort();};
 }, [selected]);

 async function run(action) {
  setBusy(true); setError(''); setNotice('');
  try { await action(); } catch (problem) { report(problem); }
  finally { setBusy(false); }
 }
 async function selectCompany(id) {
  if (!id) {deadlineEditorIdentity.current++;deadlineEditorCurrent.current=null;setProjectDeadlineDraft(null);setCompanyConflict(false);selectionGeneration.current++;selectionController.current?.abort();selectionController.current=null;requestGeneration.current++;selectedCompany.current='';setSelected('');setCompanyBilling(null);setMembers([]);setProjects([]);setModuleMenuOpen(false);return; }
  if(id===selected||busy)return;
  setCompanyConflict(false);setError('');
  const previous=selected;
  deadlineEditorIdentity.current++;deadlineEditorCurrent.current=null;setProjectDeadlineDraft(null);
  const generation=++selectionGeneration.current;
  const controller=new AbortController();
  selectionController.current?.abort();selectionController.current=controller;
  requestGeneration.current++;selectedCompany.current='';setSelected('');setCompanyBilling(null);setMembers([]);setProjects([]);setModuleMenuOpen(false);
  await run(async () => {
   try{
    await request('/v1/organizations/select', { method: 'POST', body: { organizationId: id }, signal:controller.signal });
    if(controller.signal.aborted||generation!==selectionGeneration.current||selectedCompany.current!=='')return;
    clearCompanyDrafts();selectedCompany.current=id;setSelected(id);setWorkspaceView('overview');
    setNotice('Company selected. Projects and members belong to this company.');
   }catch(problem){if(controller.signal.aborted||generation!==selectionGeneration.current)return;selectedCompany.current=previous;setSelected(previous);throw problem;}
   finally{if(selectionController.current===controller)selectionController.current=null;}
  });
 }
 async function createCompany(event) {
  event.preventDefault();
  await run(async () => {
   const created = await request('/v1/organizations', { method: 'POST', body: { name: companyName.trim() } });
   setOrganizations(current => [...current, created]); setCompanyName('');
   await request('/v1/organizations/select', { method: 'POST', body: { organizationId: created.id } });
   clearCompanyDrafts();setSelected(created.id); setNotice('Company created. You are its owner.');
  });
 }
 async function createProject(event) {
  event.preventDefault();
  const companyRequest=createCompanyRequest(selected, problem=>{setCompanyConflict(true);setError(problem.message);});
  await run(async () => {
   const created = await companyRequest('/v1/projects', { method: 'POST', body: { name: projectName.trim(), description: description.trim(), ...(managerId ? { managerId } : {}) } });
   setProjects(current => [...current, created]); setProjectName(''); setDescription(''); setManagerId('');
   setNotice('Project created in the selected company.');
  });
 }
 async function invite(event) {
  event.preventDefault();
  const companyRequest=createCompanyRequest(selected, problem=>{setCompanyConflict(true);setError(problem.message);});
  await run(async () => {
   const created = await companyRequest('/v1/invitations', { method: 'POST', body: { email: inviteEmail.trim(), role: inviteRole } });
   setInvitation(created); setInviteEmail('');
   setNotice('Invitation created. Share its company ID and token privately with the invited person.');
  });
 }
 async function accept(event) {
  event.preventDefault();
  await run(async () => {
   const result = await request('/v1/invitations/accept', { method: 'POST', body: { organizationId: joinOrganization.trim(), token: joinToken.trim() } });
   const list = await request('/v1/organizations'); setOrganizations(list);
   await request('/v1/organizations/select', { method: 'POST', body: { organizationId: result.organizationId } });
   clearCompanyDrafts();setSelected(result.organizationId); setJoinToken(''); setJoinOrganization('');
   setNotice('Invitation accepted. Your company workspace is ready.');
  });
 }
 async function changeStatus(project, status, { reviewedRetry = false } = {}) {
  if(projectDeadlineDraft?.id===project.id&&projectDeadlineDraft.saving)return;
  if(projectStatusConflict?.id===project.id&&!reviewedRetry){setProjectStatusConflict(current=>current?{...current,intendedStatus:status}:current);return;}
  const companyRequest=createCompanyRequest(selected, problem=>{setCompanyConflict(true);setError(problem.message);});
  await run(async () => {
   try {
    const updated = await companyRequest(`/v1/projects/${encodeURIComponent(project.id)}`, { method: 'PATCH', body: { version: project.version, status } });
    setProjectStatusConflict(null);
    setProjects(current => current.map(item => item.id === project.id ? updated : item));
    setNotice(`Project status updated to ${statusLabel(status)}.`);
    if(reviewedRetry)focusProjectSuccess.current=true;
   } catch (problem) {
    if(problem.code==='VERSION_CONFLICT'){focusProjectConflict.current=true;setProjectStatusConflict({id:project.id,name:project.name,intendedStatus:status,latest:null,unavailable:false});}
    throw problem;
   }
  });
 }

 async function refreshProjectConflict(){
  const pending=projectStatusConflict;if(!pending||busy||!selected)return;const companyId=selected;const scoped=createCompanyRequest(companyId,problem=>{setCompanyConflict(true);setError(problem.message);});setBusy(true);setError('');
  try{const latest=await scoped('/v1/projects');if(selectedCompany.current!==companyId)return;const record=latest.find(item=>item.id===pending.id);focusProjectConflict.current=true;if(!record){setProjectStatusConflict({...pending,latest:null,unavailable:true});setError('This project is no longer available in the selected company.');return;}setProjects(current=>current.map(item=>item.id===record.id?record:item));setProjectStatusConflict({...pending,latest:record,unavailable:false});setNotice(`Latest project status is ${statusLabel(record.status)} (version ${record.version}). Compare it with your intended status before retrying.`);}
  catch(problem){if(problem.code==='COMPANY_CONTEXT_CHANGED')return;report(problem);}finally{setBusy(false);}
 }
 async function retryProjectConflict(){const pending=projectStatusConflict;if(!pending?.latest||busy||readOnly)return;await changeStatus(pending.latest,pending.intendedStatus,{reviewedRetry:true});}

 function openProjectDeadline(project){const token=++deadlineEditorIdentity.current;const draft={id:project.id,companyId:selected,identity:token,version:project.version,value:project.deadline||'',saving:false,error:'',conflict:false,latest:null,unavailable:false};deadlineEditorCurrent.current=draft;setProjectDeadlineDraft(draft);}
 function editProjectDeadline(value){const current=deadlineEditorCurrent.current;if(!current)return;const next={...current,value,error:current.conflict?current.error:''};deadlineEditorCurrent.current=next;setProjectDeadlineDraft(next);}
 function cancelProjectDeadline(){deadlineEditorIdentity.current++;deadlineEditorCurrent.current=null;setProjectDeadlineDraft(null);}
 function activeDeadlineEditor(draft){return deadlineEditorCurrent.current?.identity===draft.identity&&selectedCompany.current===draft.companyId;}
 async function saveProjectDeadline(project,reviewedRetry=false){const current=deadlineEditorCurrent.current;if(!current||current.id!==project.id||current.companyId!==selected||current.saving||readOnly||current.blocked||current.conflict&&!reviewedRetry)return;const expectedVersion=reviewedRetry?current.reviewedVersion??current.latest?.version:current.version,submittedDeadline=current.value||null,draft={...current,saving:true,error:''};deadlineEditorCurrent.current=draft;setProjectDeadlineDraft(draft);const scoped=createCompanyRequest(draft.companyId,problem=>{if(!activeDeadlineEditor(draft))return;setCompanyConflict(true);setError(problem.message);});
  try{const updated=await scoped(`/v1/projects/${encodeURIComponent(project.id)}`,{method:'PATCH',body:{version:expectedVersion,deadline:submittedDeadline}});if(!activeDeadlineEditor(draft))return;const returnedCompany=updated?.organization_id??updated?.organizationId;if(!updated||updated.id!==project.id||returnedCompany!=null&&returnedCompany!==draft.companyId||!Number.isSafeInteger(updated.version)||updated.version!==expectedVersion+1||!Object.prototype.hasOwnProperty.call(updated,'deadline')||updated.deadline!==submittedDeadline)throw new Error('The server response did not confirm the requested deadline and next project version. Your draft is retained; refresh and review before retrying.');setProjects(items=>items.map(item=>item.id===updated.id?updated:item));deadlineEditorCurrent.current=null;setProjectDeadlineDraft(null);setNotice(updated.deadline?'Project deadline updated.':'Project deadline cleared.');focusProjectSuccess.current=true;setProjectSaveFocusRevision(value=>value+1);
  }catch(problem){if(!activeDeadlineEditor(draft))return;if(problem.code==='VERSION_CONFLICT'){const next={...draft,saving:false,conflict:true,error:problem.message,latest:null,unavailable:false};deadlineEditorCurrent.current=next;setProjectDeadlineDraft(next);return;}const blocked=problem.status===402&&problem.code==='SUBSCRIPTION_READ_ONLY';const next={...draft,saving:false,blocked:blocked||draft.blocked,error:problem.message||'The deadline could not be saved. Try again.'};deadlineEditorCurrent.current=next;setProjectDeadlineDraft(next);if(problem.code!=='BAD_INPUT'&&problem.code!=='BAD_DEADLINE')report(problem);
  }finally{if(activeDeadlineEditor(draft)){const latest=deadlineEditorCurrent.current;if(latest?.saving){const next={...latest,saving:false};deadlineEditorCurrent.current=next;setProjectDeadlineDraft(next);}}}
 }
 async function refreshProjectDeadline(project){const pending=deadlineEditorCurrent.current;if(!pending||pending.id!==project.id||!pending.conflict||busy)return;const scoped=createCompanyRequest(pending.companyId,problem=>{if(!activeDeadlineEditor(pending))return;setCompanyConflict(true);setError(problem.message);});const token=pending.identity;setBusy(true);try{const [latest,people]=await Promise.all([scoped('/v1/projects'),scoped('/v1/members')]);if(!activeDeadlineEditor(pending)||deadlineEditorCurrent.current?.identity!==token)return;const current=deadlineEditorCurrent.current;const record=latest.find(item=>item.id===pending.id);if(!record){const next={...current,latest:null,unavailable:true,error:'This project is no longer available in the selected company.'};deadlineEditorCurrent.current=next;setProjectDeadlineDraft(next);return;}setProjects(items=>items.map(item=>item.id===record.id?record:item));setMembers(people);const self=people.find(person=>person.user_id===user.id);const mayEdit=self?.status==='ACTIVE'&&(['OWNER','ADMIN'].includes(self.role)||(self.role==='MANAGER'&&record.manager_id===user.id));const next={...current,latest:record,reviewedVersion:record.version,unavailable:!mayEdit,error:mayEdit?'':'Your project editing permission is no longer available.'};deadlineEditorCurrent.current=next;setProjectDeadlineDraft(next);
  }catch(problem){const current=deadlineEditorCurrent.current;if(activeDeadlineEditor(pending)&&current?.identity===token){const next={...current,error:problem.message||'Could not refresh project details. Try again.'};deadlineEditorCurrent.current=next;setProjectDeadlineDraft(next);if(problem.code!=='COMPANY_CONTEXT_CHANGED')report(problem);}}finally{if(selectedCompany.current===pending.companyId)setBusy(false);}}
 function retryProjectDeadline(project){const draft=deadlineEditorCurrent.current;if(!draft?.latest||draft.unavailable||draft.blocked||draft.id!==project.id||readOnly)return;const reviewed={...draft,version:draft.reviewedVersion,conflict:false,error:'',saving:false};deadlineEditorCurrent.current=reviewed;setProjectDeadlineDraft(reviewed);saveProjectDeadline(project,true);}

 const companyRequest=selected?createCompanyRequest(selected, problem=>{setCompanyConflict(true);setError(problem.message);}):null;
 async function useCompanyAgain(){if(!selected||busy)return;setBusy(true);setError('');try{await request('/v1/organizations/select',{method:'POST',body:{organizationId:selected}});setCompanyConflict(false);setNotice('This company was selected again. Review your draft, then retry the action.');}catch(problem){setError(problem.message);setCompanyConflict(false);}finally{setBusy(false);}}
 const teamControls=<section className="erp-team-settings" aria-label="Company team">
   <CompanyMembers organization={organization} user={user} onExpired={onExpired} onMembersChanged={async()=>{const companyId=selected;try{const people=await companyRequest?.('/v1/members');if(selectedCompany.current===companyId)setMembers(people);}catch(problem){if(selectedCompany.current===companyId)report(problem);}}}/>
   <div className="section-heading"><h2>Company members</h2></div>
   <div className="directory">{members.map(person => <div className="directory-row" key={person.user_id}><div style={{ minWidth: 0, overflowWrap: 'anywhere' }}><strong>{person.name || person.email}</strong><p className="muted">{person.email}</p></div><span>{statusLabel(person.role)}{person.status==='SUSPENDED'?' · Suspended':''}</span></div>)}</div>
   {canAdmin && <details className="transcript-panel" style={{ marginTop: 24 }}><summary>Invite a company member</summary><form onSubmit={invite} style={{ marginTop: 16 }}>
    <label htmlFor="erp-invite-email">Member email</label><input id="erp-invite-email" type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} disabled={busy} />
    <label htmlFor="erp-invite-role">Company role</label><select id="erp-invite-role" value={inviteRole} onChange={event => setInviteRole(event.target.value)} disabled={busy}>{(organization?.role === 'OWNER' ? ['MEMBER', 'MANAGER', 'ADMIN'] : ['MEMBER', 'MANAGER']).map(role => <option key={role} value={role}>{statusLabel(role)}</option>)}</select>
    <button className="primary" style={{ marginTop: 16 }} disabled={busy || readOnly}>Create invitation</button>
   </form>{invitation && <div className="notice success" role="status" style={{ marginTop: 16, overflowWrap: 'anywhere' }}><p>Invitation for {invitation.email}. No email has been sent.</p><p>Company ID: {selected}</p><label htmlFor="erp-invitation-token" style={{ marginTop: 12 }}>Private invitation token</label><input id="erp-invitation-token" readOnly value={invitation.token} onFocus={event => event.target.select()} /><p>Expires: {new Date(invitation.expiresAt).toLocaleString()}. Share privately; this token grants company access.</p></div>}</details>}
 </section>;
 return <CompanyRequestProvider organizationId={selected||null} onContextChanged={problem=>{setCompanyConflict(true);setError(problem.message);}}><section className="erp-operating-workspace" aria-label="Company workspace" aria-busy={busy || loading}>
  <header className="erp-commandbar"><div className="erp-context-label"><span>Company workspace</span><strong>{organization?.name||'Choose a company'}</strong></div><div className="erp-company-picker"><label htmlFor="erp-company">Current company</label><select id="erp-company" value={selected} disabled={busy||loading} onChange={event=>selectCompany(event.target.value)}><option value="">Select a company</option>{organizations.map(item=><option key={item.id} value={item.id}>{item.name} · {statusLabel(item.role)}</option>)}</select>{organization&&<span className="erp-role-chip">{statusLabel(organization.role)}</span>}</div></header>
  {error&&<div className="notice error" role="alert"><p>{error}</p>{companyConflict&&selected?<button type="button" className="secondary" disabled={busy} onClick={useCompanyAgain}>Use this company again</button>:<button className="text-button" type="button" onClick={()=>setError('')}>Dismiss message</button>}</div>}
  {notice&&<p id="erp-project-status-notice" tabIndex={notice.startsWith('Project status updated to ')||notice.startsWith('Project deadline ')?-1:undefined} className={notice==='Company selected. Projects and members belong to this company.'?'notice success erp-selection-feedback':'notice success'} role="status">{notice}</p>}
  {projectStatusConflict&&<div ref={projectConflictPanel} tabIndex={-1} className="notice error" role="status"><p>Project “{projectStatusConflict.name}” changed while you were editing. Intended status: {statusLabel(projectStatusConflict.intendedStatus)}.</p>{projectStatusConflict.latest&&<p>Latest status: {statusLabel(projectStatusConflict.latest.status)} · version {projectStatusConflict.latest.version}. Review this before retrying.</p>}{projectStatusConflict.unavailable&&<p>This project is no longer available, so the status change cannot be retried.</p>}<button type="button" className="secondary" disabled={busy} onClick={refreshProjectConflict}>Refresh and review</button>{projectStatusConflict.latest&&!projectStatusConflict.unavailable&&<button type="button" className="primary" disabled={busy||readOnly} onClick={retryProjectConflict}>Retry intended status</button>}</div>}
  {!loading&&!organizations.length&&<p className="erp-onboarding-hint">Create your company or accept an invitation to start working.</p>}
  <div className="erp-utility-tray"><details className="erp-account-tools" open={companyToolsOpen} onToggle={event=>setCompanyToolsOpen(event.currentTarget.open)}><summary>Company tools</summary><div className="erp-account-tools-content">{organization&&<p className="muted" style={{overflowWrap:'anywhere'}}>Company ID: {selected}</p>}
  <details className="transcript-panel"><summary>Create a company</summary>
   <form onSubmit={createCompany} style={{ marginTop: 16 }}>
    <label htmlFor="erp-company-name">Company name</label><input id="erp-company-name" required maxLength={160} value={companyName} onChange={event => setCompanyName(event.target.value)} disabled={busy} />
    <button className="primary" disabled={busy || !companyName.trim()}>Create company</button>
   </form>
  </details>
  <details className="transcript-panel"><summary>Accept a company invitation</summary>
   <form onSubmit={accept} style={{ marginTop: 16 }}>
    <p className="muted" style={{ marginBottom: 16 }}>Use the company ID and invitation token shared by an administrator. Sign in with the invited email address.</p>
    <label htmlFor="erp-join-company">Inviting company ID</label><input id="erp-join-company" required value={joinOrganization} onChange={event => setJoinOrganization(event.target.value)} disabled={busy} />
    <label htmlFor="erp-join-token">Invitation token</label><input id="erp-join-token" type="password" autoComplete="off" required value={joinToken} onChange={event => setJoinToken(event.target.value)} disabled={busy} />
    <button className="primary" disabled={busy}>Accept invitation</button>
   </form>
  </details>
  </div></details>
  <AccountSecurity onExpired={onExpired} onChanged={onPasswordChanged}/>
  {selected&&!loading&&organization&&<Notifications organization={organization} onExpired={onExpired}/>}
  </div>
  {loading && <p className="loading" role="status">Loading company workspace…</p>}
  {selected && !loading && <>
   {readOnly&&<p className="notice error" role="status">Company access is read-only ({statusLabel(companyBilling.status)}). Saved records and permitted exports remain available.</p>}
    <div className="erp-company-layout">
    <nav className="company-module-navigation" aria-label="Company modules">
     <button ref={moduleMenuButton} type="button" className="erp-module-menu-trigger" aria-expanded={moduleMenuOpen} aria-controls="company-module-list" onClick={()=>setModuleMenuOpen(value=>!value)}>Company menu</button>
     <div id="company-module-list" className="erp-module-list" hidden={compactNavigation&&!moduleMenuOpen}>
      {moduleGroups.map(([group,items])=><div className="erp-module-group" key={group}><h2>{group}</h2>{items.map(([value,name])=><button key={value} type="button" className="secondary" aria-current={activeWorkspaceView===value?'page':undefined} onClick={()=>chooseModule(value)}><WorkspaceIcon name={value}/><span>{name}</span></button>)}</div>)}
     </div>
    </nav>
    <div className="erp-module-content" ref={moduleContent}>
    {activeWorkspaceView==='overview'?<OverviewWorkspace key={selected} user={user} organization={organization} billing={companyBilling} onNavigate={chooseModule} onExpired={onExpired}/>:activeWorkspaceView==='settings'?<><SettingsWorkspace key={selected} organization={organization} onExpired={onExpired} readOnly={readOnly}/>{teamControls}</>:activeWorkspaceView==='billing'&&canAdmin?<BillingWorkspace key={selected} organization={organization} onExpired={onExpired} onContextChanged={value=>{if(selectedCompany.current===value.organizationId)setCompanyBilling(value);}}/>:activeWorkspaceView==='reports'?<ReportWorkspace key={selected} organization={organization} onExpired={onExpired}/>:activeWorkspaceView==='ai'&&canAdmin?<CompanyAiWorkspace key={selected} organization={organization} members={members} onExpired={onExpired} onProjectsCreated={list=>list.forEach(project=>rememberProject(project,selected))}/>:activeWorkspaceView==='invoices'&&canAdmin?<InvoiceWorkspace key={`${selected}:${moduleIntent.status||'all'}`} userId={user.id} initialStatus={moduleIntent.status||''} organization={organization} onExpired={onExpired} seed={invoiceSeed} onSeedUsed={()=>setInvoiceSeed(null)} readOnly={readOnly}/>:activeWorkspaceView==='time'?<TimesheetWorkspace key={`${selected}:${moduleIntent.scope||'mine'}`} initialScope={moduleIntent.scope||'mine'} organization={organization} user={user} onExpired={onExpired} readOnly={readOnly}/>:activeWorkspaceView==='quotes'&&canManage?<QuotesWorkspace readOnly={readOnly} key={selected} organization={organization} user={user} onExpired={onExpired} seed={quoteSeed} onSeedUsed={()=>setQuoteSeed(null)} onInvoiceRequested={order=>{setInvoiceSeed(order);setModuleIntent({});setWorkspaceView('invoices');}}/>:activeWorkspaceView==='pipeline'&&canManage?<PipelineWorkspace readOnly={readOnly} key={selected} user={user} organization={organization} members={members} onExpired={onExpired} onQuoteRequested={deal=>{setQuoteSeed(deal);setWorkspaceView('quotes');}} onProjectCreated={project=>rememberProject(project,selected)}/>:activeWorkspaceView==='customers'&&canManage?<CustomerWorkspace readOnly={readOnly} key={selected} user={user} organization={organization} members={members} projects={projects} onExpired={onExpired}/>:<>
   <div className="section-heading"><div><p className="erp-eyebrow">Delivery</p><h2>Company projects</h2></div><span className="erp-count">{projects.length} loaded projects</span></div>
   {canManage && <details className="transcript-panel"><summary>Create a project</summary><form onSubmit={createProject} style={{ marginTop: 16 }}>
    <label htmlFor="erp-project-name">Project name</label><input id="erp-project-name" required maxLength={160} value={projectName} onChange={event => setProjectName(event.target.value)} disabled={busy} />
    <label htmlFor="erp-project-description">Project description</label><textarea id="erp-project-description" maxLength={10000} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} />
    <label htmlFor="erp-project-manager" style={{ marginTop: 16 }}>Project manager</label><select id="erp-project-manager" value={managerId} onChange={event => setManagerId(event.target.value)} disabled={busy}><option value="">Assign to me</option>{members.filter(person => person.status==='ACTIVE' && ['OWNER', 'ADMIN', 'MANAGER'].includes(person.role)).map(person => <option key={person.user_id} value={person.user_id}>{person.name || person.email}</option>)}</select>
    <button className="primary" style={{ marginTop: 16 }} disabled={busy || readOnly || !projectName.trim()}>Create project</button>
   </form></details>}
   <CompanyProjects key={selected} projects={projects} members={members} user={user} organization={organization} busy={busy} readOnly={readOnly} onChangeStatus={changeStatus} onExpired={onExpired} pendingStatus={projectStatusConflict} deadlineDraft={projectDeadlineDraft} onOpenDeadline={openProjectDeadline} onEditDeadline={editProjectDeadline} onCancelDeadline={cancelProjectDeadline} onSaveDeadline={project=>saveProjectDeadline(project)} onRefreshDeadline={refreshProjectDeadline} onRetryDeadline={retryProjectDeadline}/>
   <CompanyTasks key={selected} user={user} organization={organization} projects={projects} members={members} onExpired={onExpired} readOnly={readOnly}/>

   </>}
    </div>
    </div>
  </>}
 </section></CompanyRequestProvider>;
}
