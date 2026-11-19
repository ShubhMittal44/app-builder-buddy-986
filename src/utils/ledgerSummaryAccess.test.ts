/// <reference types="bun" />
import { expect, test } from 'bun:test';
import { canRequestLedgerSummary, requestLedgerSummary, type SummaryIdentity } from './ledgerSummaryAccess';

const admin: SummaryIdentity = { userId: 'admin-user', profileUserId: 'admin-user', role: 'admin', active: true, loading: false };
test('Admin receives the four summary values', async () => {
  const summary = { totalCustomers: 2, totalSale: 70000, totalReceived: 7000, outstanding: 63000 };
  expect(await requestLedgerSummary(admin, async () => summary)).toEqual(summary);
});
for (const role of ['manager', 'staff']) {
  test(`${role} never requests summary even with full module permissions`, async () => {
    let requests = 0;
    const identity = { ...admin, role, permissions: { view: true, add: true, edit: true } };
    expect(await requestLedgerSummary(identity, async () => ++requests)).toBeNull();
    expect(requests).toBe(0);
  });
}
test('refresh loading cannot reveal summaries', () => {
  expect(canRequestLedgerSummary({ ...admin, loading: true })).toBe(false);
});
test('switching accounts cannot reuse an Admin profile', () => {
  expect(canRequestLedgerSummary({ ...admin, userId: 'staff-user' })).toBe(false);
});
test('signed-out and inactive Admin cannot request summaries', () => {
  expect(canRequestLedgerSummary({ ...admin, userId: undefined })).toBe(false);
  expect(canRequestLedgerSummary({ ...admin, active: false })).toBe(false);
});