# Customer Ledger salesperson feature
- [x] Restrict the four ledger summary cards and summary response to Admin; preserve authorized records and exports.
- [x] Verify with 15 passing rule/calculation tests, an anonymous API rejection, direct-URL login redirect, and successful preview compilation.
- [ ] Signed-in summary API/UI checks for Admin, Manager and Staff: blocked by external unmanaged Supabase session access; read-query execution cannot impersonate authenticated API roles.
- [ ] Publish the targeted summary restriction: blocked because publishing was declined; database authorization update is already applied.
- [x] Add salesperson master and optional customer reference with existing ledger permissions.
- [x] Add management, assignments, counts, filtering, and filtered CSV export in Customer Ledger only.
- [x] Test rules and check public preview; report authenticated verification limitation.
- [ ] Signed-in assignment, management, and export checks: blocked by external unmanaged Supabase session access.