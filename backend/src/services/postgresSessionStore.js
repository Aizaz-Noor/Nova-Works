import session from 'express-session';
export class PostgresSessionStore extends session.Store{
 constructor(db){super();this.db=db;}
 expiry(value){const expiration=new Date(value.cookie?.expires).getTime();return Number.isFinite(expiration)?expiration:Date.now()+(value.cookie?.maxAge??8*60*60*1000);}
 get(sid,cb){this.db.query('SELECT data FROM novaworks.sessions WHERE sid=$1 AND expires_at>$2',[sid,Date.now()]).then(r=>cb(null,r.rows[0]?.data||null),()=>cb(new Error('Session database unavailable')));}
 set(sid,value,cb=()=>{}){this.db.query('INSERT INTO novaworks.sessions(sid,data,expires_at) VALUES($1,$2::jsonb,$3) ON CONFLICT(sid) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at',[sid,JSON.stringify(value),this.expiry(value)]).then(()=>cb(null),()=>cb(new Error('Session database unavailable')));}
 destroy(sid,cb=()=>{}){this.db.query('DELETE FROM novaworks.sessions WHERE sid=$1',[sid]).then(()=>cb(null),()=>cb(new Error('Session database unavailable')));}
 touch(sid,value,cb=()=>{}){this.db.query('UPDATE novaworks.sessions SET data=$2::jsonb,expires_at=$3 WHERE sid=$1',[sid,JSON.stringify(value),this.expiry(value)]).then(()=>cb(null),()=>cb(new Error('Session database unavailable')));}
}
