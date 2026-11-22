import { describe, expect, test } from 'bun:test';
import { adjustRequest, transferRequest, updateRequest, breakupRequest, importRequests, diffFields } from './inventoryRequests';

describe('inventory approval requests', () => {
  test('staff sale of 5 from stand 1 (12) proposes 7 on stand, 15 total', () => {
    const d = adjustRequest({ item_id: 'i', stand_id: 's1', mode: 'sale_stock', quantity: 5, label: 'x', standLabel: '1', currentTotal: 20, currentStand: 12 });
    expect(d.operations).toEqual([{ op: 'adjust', item_id: 'i', stand_id: 's1', delta: -5, remarks: null }]);
    expect(d.changes.map(c => c.proposed)).toEqual([7, 15]);
  });
  test('add stock of 10 is a +10 movement', () => {
    const d = adjustRequest({ item_id: 'i', stand_id: 's3', mode: 'add_stock', quantity: 10, label: 'x', standLabel: '3', currentTotal: 20, currentStand: 0 });
    expect((d.operations[0] as any).delta).toBe(10);
    expect(d.changes[1].proposed).toBe(30);
  });
  test('zero quantity is refused', () => {
    expect(() => adjustRequest({ item_id: 'i', stand_id: 's', mode: 'add_stock', quantity: 0, label: '', standLabel: '', currentTotal: 0, currentStand: 0 })).toThrow();
  });
  test('transfer 5 from stand 1 to 2 keeps total', () => {
    const d = transferRequest({ item_id: 'i', from: 'a', to: 'b', quantity: 5, label: '', fromLabel: '1', toLabel: '2', fromQty: 12, toQty: 8 });
    expect(d.changes.map(c => c.proposed)).toEqual([7, 13]);
    expect(() => transferRequest({ item_id: 'i', from: 'a', to: 'a', quantity: 5, label: '', fromLabel: '', toLabel: '', fromQty: 9, toQty: 9 })).toThrow();
  });
  test('variant edit sends only changed fields with original snapshot', () => {
    const before = { id: 'v', thickness: '8mm', company_purchased: 'AIS', color: 'Clear', notes: null };
    const d = updateRequest('glass_variants', 'edit_glass_variant', 's', before, { thickness: '10mm', company_purchased: 'Gold Plus', color: 'Clear', notes: '' }, {}, {})!;
    const op = d.operations[0] as any;
    expect(op.values).toEqual({ thickness: '10mm', company_purchased: 'Gold Plus' });
    expect(op.expected).toEqual({ thickness: '8mm', company_purchased: 'AIS' });
  });
  test('no-op edit creates no request', () => {
    expect(diffFields({ a: 1 }, { a: 1 }).changes).toHaveLength(0);
  });
  test('removed stand in breakup is set to 0 with expected prior value', () => {
    const d = breakupRequest('i', 'x', [{ stand_id: 'a', quantity: 4 }], [{ stand_id: 'b', quantity: 4 }], id => id)!;
    expect(d.operations).toContainEqual(expect.objectContaining({ stand_id: 'a', quantity: 0, expected: 4 }));
    expect(d.operations).toContainEqual(expect.objectContaining({ stand_id: 'b', quantity: 4, expected: 0 }));
  });
  test('import creates one request per item and contains no delete', () => {
    const rs = importRequests([
      { glassType: 'Clear', thickness: '12 mm', company: 'AIS', color: '', size: { length: 8, breadth: 12, unit: 'ft' }, totalSheets: 20, notes: '', stands: [{ standNumber: '1', standId: null, sheets: 12 }] },
      { glassType: 'Clear', thickness: '8 mm', company: 'AIS', color: '', size: { length: 8, breadth: 4, unit: 'ft' }, totalSheets: 5, notes: '', stands: [] },
    ], { createMissingStands: true });
    expect(rs).toHaveLength(2);
    expect(rs.flatMap(r => r.operations.map(o => o.op))).not.toContain('delete');
  });
});
