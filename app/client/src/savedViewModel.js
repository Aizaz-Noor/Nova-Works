const statuses={customers:['','PROSPECT','ACTIVE','ARCHIVED'],leads:['','NEW','QUALIFIED','DISQUALIFIED','CONVERTED'],invoices:['','DRAFT','ISSUED'],projects:['','PLANNED','ACTIVE','DONE','ARCHIVED']};
export function viewKey(scope){
 if(!['customers','leads','deals','invoices','projects'].includes(scope?.module)||['userId','organizationId','role'].some(key=>typeof scope[key]!=='string'||!scope[key]))return null;
 return 'novaworks.views.v1:'+['userId','organizationId','role','module'].map(key=>encodeURIComponent(scope[key])).join(':');
}
export function cleanPreferences(module,input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid view preferences.');
 const result={q:typeof input.q==='string'?input.q.slice(0,200):''};
 if(module==='deals'){
  result.stage=typeof input.stage==='string'&&/^[A-Z][A-Z0-9_]{0,39}$/.test(input.stage)?input.stage:'';
  result.layout=input.layout==='board'?'board':'table';
 }else result.status=statuses[module]?.includes(input.status)?input.status:'';
 return result;
}
export function readViews(storage,scope){
 const key=viewKey(scope);if(!key)return [];
 const raw=storage.getItem(key);if(!raw)return [];
 let parsed;try{parsed=JSON.parse(raw);}catch{return [];}
 if(parsed?.version!==1||!Array.isArray(parsed.views))return [];
 return parsed.views.slice(0,10).filter(item=>typeof item?.name==='string'&&item.name.trim()&&item.name.length<=60).map(item=>({name:item.name.trim(),preferences:cleanPreferences(scope.module,item.preferences||{})}));
}
export function writeViews(storage,scope,views){
 const key=viewKey(scope);if(!key)throw Error('Select a company before saving a view.');
 if(!Array.isArray(views)||views.length>10)throw Error('Keep up to 10 saved views per module.');
 const clean=views.map(item=>{const name=typeof item.name==='string'?item.name.trim():'';if(!name||name.length>60)throw Error('Use a view name of 1–60 characters.');return {name,preferences:cleanPreferences(scope.module,item.preferences)};});
 if(new Set(clean.map(item=>item.name)).size!==clean.length)throw Error('Choose a different view name.');
 storage.setItem(key,JSON.stringify({version:1,views:clean}));return clean;
}
