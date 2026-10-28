import test from 'node:test';
import assert from 'node:assert/strict';
import {errorHandler} from '../src/middleware/errorHandler.js';

test('unexpected API failures log only safe diagnostic metadata', t => {
 const calls=[];
 t.mock.method(console,'error',(...args)=>calls.push(args));
 const error=Object.assign(new Error('private SQL and credential contents'),{code:'ECONNRESET'});
 const response={headersSent:false,status(value){this.statusCode=value;return this;},json(value){this.body=value;}};
 errorHandler(error,{method:'GET',path:'/api/v1/projects',body:{password:'private'}},response,()=>{});
 assert.equal(response.statusCode,500);
 assert.deepEqual(calls,[['NovaWorks request failure',{code:'ECONNRESET',kind:'Error',method:'GET',path:'/api/v1/projects'}]]);
 assert.equal(JSON.stringify(calls).includes('private'),false);
 assert.equal(response.body.error.code,'INTERNAL_ERROR');
});
