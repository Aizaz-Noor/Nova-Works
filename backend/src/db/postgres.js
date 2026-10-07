import pg from 'pg';
import { readFile } from 'node:fs/promises';
export async function openPostgres(connectionString) {
 let ca=process.env.DATABASE_CA_CERT;try{if(process.env.DATABASE_CA_FILE)ca=await readFile(process.env.DATABASE_CA_FILE,'utf8');}catch{throw new Error('Database CA certificate could not be read');}
 const address=new URL(connectionString);for(const name of ['sslmode','sslcert','sslkey','sslrootcert'])address.searchParams.delete(name);
 const pool=new pg.Pool({connectionString:address.toString(),max:5,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true,...(ca?{ca}: {})}});
 pool.on('error',()=>console.error('PostgreSQL pool connection unavailable'));
 const db={kind:'postgres',query:(text,values)=>pool.query(text,values),close:()=>pool.end()};
 db.transaction=async work=>{const client=await pool.connect();try{await client.query('BEGIN');const result=await work(client);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}};
 try{await pool.query('SELECT 1');await pool.query(await readFile(new URL('../../migrations/001_postgres.sql',import.meta.url),'utf8'));return db;}catch(error){await pool.end();const failure=new Error('PostgreSQL initialization failed; verify private database configuration and connectivity');failure.code=/^[A-Z0-9_]+$/.test(error.code||'')?error.code:'DATABASE_INIT_FAILED';throw failure;}
}
