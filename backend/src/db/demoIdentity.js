import { demoUsers } from './seed.js';

// The public fixture directory is independent of commercial identities and company
// memberships. Neither an email suffix nor an organization invitation grants entry.
export function demoIdentityPredicate(alias, bind) {
 return `(${demoUsers.map(([id,,email,role])=>`(${alias}.id=${bind(id)} AND ${alias}.email=${bind(`${email}@novaworks.example`)} AND ${alias}.role=${bind(role)})`).join(' OR ')})`;
}
