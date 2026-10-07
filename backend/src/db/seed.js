import { pathToFileURL } from 'node:url';
import { openDatabase, transaction } from './database.js';
import { hashPassword } from '../services/passwords.js';
export const demoUsers = [
 ['ADMIN','Admin','admin','ADMIN','Administrator',['Company overview','transcript creation']],
 ['PM01','Ayesha Khan','ayesha','MANAGER','Web PM',['Web projects','client coordination']],
 ['PM02','Bilal Ahmed','bilal','MANAGER','Mobile PM',['Mobile projects','delivery planning']],
 ['PM03','Hina Malik','hina','MANAGER','AI PM',['AI projects','requirement review']],
 ['DEV01','Ali Raza','ali','AGENT','Full-Stack',['React','frontend integration']],
 ['DEV02','Hamza Shah','hamza','AGENT','Full-Stack',['Node.js','databases','APIs']],
 ['DEV03','Sara Noor','sara','AGENT','App Developer',['Flutter','mobile UI']],
 ['DEV04','Usman Tariq','usman','AGENT','App Developer',['Flutter','integration','testing']],
 ['DEV05','Zain Abbas','zain','AGENT','AI Developer',['LLMs','extraction','prompts']],
 ['DEV06','Maryam Asif','maryam','AGENT','AI Developer',['Retrieval','document processing']]
];
export function seedUsers(db) {
 const insert = db.prepare(`INSERT INTO users(id,name,email,password_hash,role,specialization,skills)
 VALUES(?,?,?,?,?,?,?) ON CONFLICT(email) DO NOTHING`);
 transaction(db, () => {
  for (const [id,name,email,role,specialization,skills] of demoUsers)
   insert.run(id,name,`${email}@novaworks.example`,hashPassword('Demo123!'),role,specialization,JSON.stringify(skills));
 });
 return db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 const db = openDatabase(); console.log(`Seed complete: ${seedUsers(db)} users.`); db.close();
}
