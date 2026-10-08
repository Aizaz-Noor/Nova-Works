import session from 'express-session';
export class PostgresSessionStore extends session.Store{
 constructor(db,{now=Date.now}={}){super();this.db=db;this.now=now;this.nextCleanup=0;this.cleanupPending=null;}
 expiry(value){const expiration=value.cookie?.expires?new Date(value.cookie.expires).getTime():NaN;const maxAge=value.cookie?.maxAge;return Number.isFinite(expiration)?expiration:this.now()+(Number.isFinite(maxAge)&&maxAge>=0?maxAge:8*60*60*1000);}
 cleanup(){const time=this.now();if(this.cleanupPending||time<this.nextCleanup)return;this.nextCleanup=time+60000;try{this.cleanupPending=this.db.query(`DELETE FROM novaworks.sessions WHERE sid IN (SELECT sid FROM novaworks.sessions WHERE expires_at<=$1 ORDER BY expires_at,sid LIMIT 100) AND expires_at<=$1`,[time]).catch(()=>{}).finally(()=>{this.cleanupPending=null;});}catch{this.cleanupPending=null;}}
 get(sid,cb){this.cleanup();this.db.query('SELECT data FROM novaworks.sessions WHERE sid=$1 AND expires_at>$2',[sid,this.now()]).then(r=>cb(null,r.rows[0]?.data||null),()=>cb(new Error('Session database unavailable')));}
 set(sid,value,cb=()=>{}){this.cleanup();this.db.query('INSERT INTO novaworks.sessions(sid,data,expires_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(sid) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at',[sid,JSON.stringify(value),this.expiry(value)]).then(()=>cb(null),()=>cb(new Error('Session database unavailable')));}
 destroy(sid,cb=()=>{}){this.cleanup();this.db.query('DELETE FROM novaworks.sessions WHERE sid=$1',[sid]).then(()=>cb(null),()=>cb(new Error('Session database unavailable')));}
 touch(sid,value,cb=()=>{}){this.cleanup();this.db.query('UPDATE novaworks.sessions SET data=$2::jsonb,expires_at=$3 WHERE sid=$1',[sid,JSON.stringify(value),this.expiry(value)]).then(()=>cb(null),()=>cb(new Error('Session database unavailable')));}
}
