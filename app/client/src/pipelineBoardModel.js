export function groupDealsByStage(deals = [], stages = []) {
  const columns = stages.map(stage => ({ code: stage.code, name: stage.name || stage.label || stage.code, deals: [] }));
  const byCode = new Map(columns.map(column => [column.code, column]));
  for (const deal of deals) {
    let column = byCode.get(deal.stage_code);
    if (!column) { column = { code: deal.stage_code || 'UNSPECIFIED', name: deal.stage_code || 'Unspecified stage', deals: [] }; byCode.set(deal.stage_code, column); columns.push(column); }
    column.deals.push(deal);
  }
  return columns;
}
