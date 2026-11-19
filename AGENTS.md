# Architecture rules
- Store salesperson assignments on the customer master, never ledger transactions; reassignment must not affect accounting history.
- Use one shared filtered customer set for ledger list summaries and CSV export; fetch all pages to avoid incomplete totals and exports.