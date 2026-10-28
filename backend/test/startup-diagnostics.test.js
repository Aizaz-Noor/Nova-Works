import test from 'node:test';
import assert from 'node:assert/strict';
import {startupDiagnostic} from '../src/services/startupDiagnostics.js';
test('startup diagnostics identify known checks without logging arbitrary messages',()=>{
 assert.deepEqual(startupDiagnostic(Object.assign(new Error('private environment data'),{startupPhase:'runtime',code:'53300'})),{phase:'runtime',reason:'UNEXPECTED_ERROR',code:'53300',kind:'Error'});
 assert.equal(startupDiagnostic(new Error('MFA encryption configuration is invalid')).reason,'MFA_CONFIGURATION_INVALID');
});
