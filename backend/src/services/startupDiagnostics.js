const reasons = new Map([
 ['MFA encryption configuration is invalid','MFA_CONFIGURATION_INVALID'],
 ['Commercial platform requires a restricted PostgreSQL runtime role','RUNTIME_ROLE_UNSAFE'],
 ['Runtime must not own tables, inherit roles or have permanent DDL permission','RUNTIME_PRIVILEGES_UNSAFE'],
 ['Runtime must not rewrite or delete company memberships','MEMBERSHIP_PRIVILEGES_UNSAFE'],
 ['Unsafe company member lifecycle policy or function privileges','MEMBERSHIP_POLICY_UNSAFE'],
 ['PostgreSQL runtime schema is missing project/task version columns; apply migration 025 before startup','PROJECT_SCHEMA_INCOMPLETE']
]);
export function startupDiagnostic(error) {
 return {
  phase: ['database','runtime','application'].includes(error.startupPhase) ? error.startupPhase : 'configuration',
  reason: reasons.get(error.message) || (error.message?.startsWith('Missing forced ') ? 'TENANT_POLICY_MISSING' : 'UNEXPECTED_ERROR'),
  code: /^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : 'UNCLASSIFIED',
  kind: ['Error','TypeError','ReferenceError','SyntaxError','RangeError'].includes(error.name) ? error.name : 'Error'
 };
}
