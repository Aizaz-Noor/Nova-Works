import React from 'react';

const accounts = [
  { name: 'Administrator', email: 'admin@novaworks.example', purpose: 'Create projects from a meeting' },
  { name: 'Ayesha · Manager', email: 'ayesha@novaworks.example', purpose: 'View assigned projects' },
  { name: 'Ali · Developer', email: 'ali@novaworks.example', purpose: 'View assigned tasks' },
];

export default function DemoAccounts({ onSelect, disabled }) {
  return <section className="demo-accounts" aria-labelledby="demo-accounts-title">
    <h2 id="demo-accounts-title">Explore a demo role</h2>
    <p>These are fictional accounts in a shared demo workspace. Choose one to fill the credentials, then select Sign in. Use sample data; do not paste private meetings.</p>
    <div className="demo-account-options">{accounts.map(account =>
      <button type="button" className="secondary" key={account.email} disabled={disabled}
        onClick={()=>onSelect({ email: account.email, password: 'Demo123!' })}>
        <strong>{account.name}</strong><span>{account.purpose}</span>
      </button>
    )}</div>
  </section>;
}