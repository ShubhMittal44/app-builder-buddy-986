# Architecture rules
- Store salesperson assignments on the customer master, never ledger transactions; reassignment must not affect accounting history.
- Use one shared filtered customer set for ledger list summaries and CSV export; fetch all pages to avoid incomplete totals and exports.
- Fetch top-level ledger summaries only through the Admin-validated, invoker-security RPC using that filtered customer set; match the current account and discard stale responses to prevent summary leakage on account changes.
- Keep cash transactions and categories in independent tables with existing module permissions, validation triggers and a protected deletion audit; no cross-module synchronization preserves accounting history.
- Income & Expenses uses the same combined filters for all-page history, exports and its Admin-validated summary RPC; use exact decimal SQL totals and integer paise validation to avoid rounding errors.
- Store Default Payment Date in account-scoped session storage and initialize transaction forms separately; navigation persists the date without changing saved entries.- Live inventory tables are Admin-write only; Manager/Staff changes go through `submit_inventory_change_request` and are applied only by the Admin-validated atomic `review_inventory_change_request` RPC, which rechecks stock and conflicts so pending requests never touch live stock.
