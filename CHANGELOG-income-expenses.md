# Income & Expenses

- Independent manual cash-basis income and expense transactions; no imports, synchronization or modifications to existing accounting modules.
- Per-user, session-persisted Default Payment Date initialized in Asia/Kolkata; individual transaction overrides remain independent.
- Fourteen seeded categories with creation, renaming and deactivation; historical category references are preserved and deletion cannot orphan transactions.
- Exact decimal amounts, optional payment mode and note, duplicate-save protection, editing and Admin-only deletion with protected audit history.
- Combined date, type, multi-category and search filters; paginated history and all-matching-record Excel/CSV exports.
- Income & Expenses added to Users → Manage Permissions, Home modules, mobile navigation and the module's desktop sidebar. New Manager/Staff access remains disabled until granted.
- Total Income, Total Expenses and Net Cash Flow are requested only by Admin through a server-authorized summary function using the same filters across all records.

## Verification
- 28 cash-flow, permissions and existing ledger regression tests passed; preview compilation succeeded.
- Unsigned summary requests rejected; unsigned table requests return no records; direct module access redirects to login at desktop, tablet and mobile sizes.
- Authenticated end-to-end checks are unavailable for this external Supabase connection; real Admin/Manager/Staff CRUD and export checks remain unverified.
- Existing password-leak protection and three privileged-function warnings predate this change and were not modified.