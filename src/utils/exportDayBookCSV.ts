import { DayBookEntry } from '@/hooks/useDayBook';

export function exportDayBookCSV(
  entries: (DayBookEntry & { client_name?: string })[],
  tabName: string,
  dateSuffix: string
) {
  const header = 'Date,Client Name,Challan Number,Total Amount,Advance,Balance,Notes';
  const rows = entries.map(e => {
    const total = Number(e.total_amount ?? 0);
    const advance = Number(e.advance_amount ?? 0);
    const balance = total - advance;
    const notes = (e.notes ?? '').replace(/"/g, '""');
    return `${e.entry_date},"${e.client_name ?? ''}","${e.challan_number}",${total},${advance},${balance},"${notes}"`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tabName}${dateSuffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
