function toCsvRow(values: (string | number | null | undefined)[]): string {
  return values.map(v => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }).join(',');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

const dateStr = () => new Date().toISOString().split('T')[0];

export function exportStaffMembers(data: any[]) {
  const headers = ['Staff Name', 'Monthly Salary', 'Active', 'Notes', 'Created At'];
  const rows = data.map(d => toCsvRow([d.staff_name, d.monthly_salary, d.active ? 'Yes' : 'No', d.notes, d.created_at]));
  downloadCsv([headers.join(','), ...rows].join('\n'), `staff_members_${dateStr()}.csv`);
}

export function exportStaffTransactions(data: any[], suffix?: string) {
  const headers = ['Staff Name', 'Entry Date', 'Money Taken', 'Notes', 'Created At'];
  const rows = data.map(d => toCsvRow([d.staff_name ?? '', d.entry_date, d.money_taken, d.notes, d.created_at]));
  downloadCsv([headers.join(','), ...rows].join('\n'), `staff_transactions${suffix || '_' + dateStr()}.csv`);
}

export function exportVehicles(data: any[]) {
  const headers = ['Vehicle Number', 'Vehicle Type', 'Active', 'Notes', 'Created At'];
  const rows = data.map(d => toCsvRow([d.vehicle_number, d.vehicle_type, d.active ? 'Yes' : 'No', d.notes, d.created_at]));
  downloadCsv([headers.join(','), ...rows].join('\n'), `vehicles_${dateStr()}.csv`);
}

export function exportVehicleTransactions(data: any[], suffix?: string) {
  const headers = ['Vehicle Number', 'Entry Date', 'Amount', 'Reason', 'Notes', 'Created At'];
  const rows = data.map(d => toCsvRow([d.vehicle_number ?? '', d.entry_date, d.amount, d.reason, d.notes, d.created_at]));
  downloadCsv([headers.join(','), ...rows].join('\n'), `vehicle_transactions${suffix || '_' + dateStr()}.csv`);
}

export function exportOtherEntries(data: any[], suffix?: string) {
  const headers = ['Entry Date', 'Service', 'Amount', 'Notes', 'Created At'];
  const rows = data.map(d => toCsvRow([d.entry_date, d.service, d.amount, d.notes, d.created_at]));
  downloadCsv([headers.join(','), ...rows].join('\n'), `other_entries${suffix || '_' + dateStr()}.csv`);
}
