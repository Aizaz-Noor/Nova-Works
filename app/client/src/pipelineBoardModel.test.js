import test from 'node:test';
import assert from 'node:assert/strict';
import { groupDealsByStage } from './pipelineBoardModel.js';

test('groups only loaded deals into configured stage columns', () => {
  const grouped = groupDealsByStage([
    { id: 'a', stage_code: 'QUALIFIED' },
    { id: 'b', stage_code: 'QUALIFIED' },
    { id: 'c', stage_code: 'NEW' },
    { id: 'd', stage_code: 'REMOVED' },
  ], [
    { code: 'NEW', name: 'New' },
    { code: 'QUALIFIED', name: 'Qualified' },
    { code: 'WON', name: 'Won' },
  ]);
  assert.deepEqual(grouped.map(column => [column.code, column.deals.map(deal => deal.id)]), [
    ['NEW', ['c']], ['QUALIFIED', ['a', 'b']], ['WON', []], ['REMOVED', ['d']],
  ]);
});

test('handles empty pages and absent configured stages', () => {
  assert.deepEqual(groupDealsByStage([], [{ code: 'NEW' }]), [{ code: 'NEW', name: 'NEW', deals: [] }]);
  assert.deepEqual(groupDealsByStage([{ id: 'a', stage_code: 'NEW' }], []), [{code:'NEW',name:'NEW',deals:[{id:'a',stage_code:'NEW'}]}]);
});
