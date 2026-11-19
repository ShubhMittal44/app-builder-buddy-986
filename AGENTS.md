# Architecture rules
- Store salesperson assignments on the customer master, never ledger transactions; reassignment must not affect accounting history.
- Use one shared filtered customer set for ledger list summaries and CSV export; fetch all pages to avoid incomplete totals and exports.
- Fetch top-level ledger summaries only through the Admin-validated, invoker-security RPC using that filtered customer set; match the current account and discard stale responses to prevent summary leakage on account changes.