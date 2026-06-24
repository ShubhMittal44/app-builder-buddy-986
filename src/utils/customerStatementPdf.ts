import type { Customer, LedgerEntry } from '@/hooks/useCustomerLedger';
import { signedAmount } from '@/hooks/useCustomerLedger';

const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN');
const esc = (s: string | null | undefined) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');

export function printCustomerStatement(
  customer: Customer,
  entries: LedgerEntry[],
  orderNumbers: Record<string, number>,
  range?: { from?: string; to?: string },
) {
  const sorted = [...entries].sort((a, b) =>
    a.entry_date === b.entry_date ? a.created_at.localeCompare(b.created_at) : a.entry_date.localeCompare(b.entry_date)
  );

  let running = 0;
  const rows = sorted.map(e => {
    running += signedAmount(e);
    const sale = e.entry_type === 'Amount Received' ? '' : fmt(Number(e.amount));
    const recv = e.entry_type === 'Amount Received' ? fmt(Number(e.amount)) : '';
    const orderLabel = e.order_id ? ` (Order #${orderNumbers[e.order_id] ?? ''})` : '';
    const bal = running === 0 ? 'Settled' : running > 0 ? `${fmt(running)} Pending` : `${fmt(running)} Adv`;
    return `<tr>
      <td>${esc(e.entry_date)}</td>
      <td>${esc(e.entry_type)}</td>
      <td>${esc(e.notes)}${orderLabel}</td>
      <td class="num">${sale}</td>
      <td class="num">${recv}</td>
      <td class="num">${bal}</td>
    </tr>`;
  }).join('');

  const finalBal = running;
  const finalLabel = finalBal === 0 ? 'Settled' : finalBal > 0 ? `${fmt(finalBal)} Pending` : `${fmt(finalBal)} Advance / Extra Received`;
  const rangeText = range && (range.from || range.to)
    ? `<p class="meta">Statement period: ${esc(range.from || '—')} to ${esc(range.to || '—')}</p>` : '';

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
  <title>Statement - ${esc(customer.customer_name)}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; font-size: 12px; }
    h1 { font-size: 20px; margin: 0; color: #1e40af; }
    .sub { color: #64748b; font-size: 12px; margin: 2px 0 16px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .card h2 { font-size: 14px; margin: 0 0 6px; }
    .meta { margin: 2px 0; color: #334155; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: 7px 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
    td.num, th.num { text-align: right; white-space: nowrap; }
    tfoot td { font-weight: bold; border-top: 2px solid #1e40af; font-size: 13px; }
    .final { margin-top: 16px; text-align: right; font-size: 15px; font-weight: bold; }
  </style></head>
  <body>
    <h1>Rama Glass House</h1>
    <p class="sub">Customer Account Statement</p>
    <div class="card">
      <h2>${esc(customer.customer_name)}</h2>
      ${customer.phone ? `<p class="meta">Phone: ${esc(customer.phone)}</p>` : ''}
      ${customer.address ? `<p class="meta">Address: ${esc(customer.address)}</p>` : ''}
      ${customer.city ? `<p class="meta">City: ${esc(customer.city)}</p>` : ''}
      ${rangeText}
      <p class="meta">Generated: ${new Date().toLocaleString('en-IN')}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th><th>Type</th><th>Notes</th>
          <th class="num">Sale</th><th class="num">Received</th><th class="num">Balance</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:24px">No entries</td></tr>'}</tbody>
    </table>
    <p class="final">Final Balance: ${finalLabel}</p>
    <script>window.onload = function(){ window.print(); }</script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
}
