import pg from 'pg';
import { readFile } from 'node:fs/promises';
export async function openPostgres(connectionString,{Pool=pg.Pool,caFile=process.env.DATABASE_CA_FILE,caCert=process.env.DATABASE_CA_CERT}={}) {
 let ca=caCert;try{if(caFile)ca=await readFile(caFile,'utf8');}catch{throw new Error('Database CA certificate could not be read');}
 const address=new URL(connectionString);for(const name of ['sslmode','sslcert','sslkey','sslrootcert'])address.searchParams.delete(name);
 if(address.hostname.endsWith('.pooler.supabase.com') || address.hostname.endsWith('.supabase.co')){const bundled=await readFile(new URL('../../certs/supabase-root.pem',import.meta.url),'utf8');ca=ca?[bundled,ca]:bundled;}
 const pool=new Pool({connectionString:address.toString(),max:5,connectionTimeoutMillis:10000,statement_timeout:15000,query_timeout:20000,ssl:{rejectUnauthorized:true,...(ca?{ca}: {})}});
 pool.on('error',()=>console.error('PostgreSQL pool connection unavailable'));
 const db={kind:'postgres',query:(text,values)=>pool.query(text,values),close:()=>pool.end()};
 db.transaction=async work=>{const client=await pool.connect();let discard=false;try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){try{await client.query('ROLLBACK');}catch{discard=true;}throw error;}finally{client.release(discard?new Error('Transaction connection unusable'):undefined);}};
 try{await pool.query('SELECT 1');if(process.env.DATABASE_AUTO_MIGRATE!=='0')await pool.query(await readFile(new URL('../../migrations/001_postgres.sql',import.meta.url),'utf8'));return db;}catch(error){await pool.end();const failure=new Error('PostgreSQL initialization failed; verify private database configuration and connectivity');failure.code=/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'DATABASE_INIT_FAILED';throw failure;}
}
