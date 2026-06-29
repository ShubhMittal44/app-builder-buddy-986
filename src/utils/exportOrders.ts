import { Order } from '@/hooks/useOrders';

export const exportToCSV = (orders: Order[], filename: string = 'orders.csv') => {
  if (orders.length === 0) {
    alert('No orders to export');
    return;
  }

  // Define CSV headers
  const headers = [
    'Order Number',
    'Stage',
    'Order Type',
    'Customer Name',
    'Phone',
    'Address',
    'City',
    'Order Date',
    'Estimated Duration',
    'Total Amount',
    'Advance Amount',
    'Balance',
    'Assign Site',
    'Processing Site',
    'Notes',
    'Created At',
  ];

  // Convert orders to CSV rows
  const rows = orders.map(order => {
    const balance = (order.total_amount || 0) - (order.advance_amount || 0) + (order.freight_amount || 0);
    
    return [
      order.order_number,
      order.stage,
      order.customer_name,
      order.phone || '',
      order.address || '',
      order.city || '',
      order.order_date,
      order.estimated_duration || '',
      order.total_amount || 0,
      order.advance_amount || 0,
      order.freight_amount || 0,
      balance,
      order.assign_site || '',
      order.processing_site || '',
      order.notes || '',
      order.created_at || '',
    ].map(value => {
      // Escape quotes and wrap in quotes if contains comma or quote
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',');
  });

  // Combine headers and rows
  const csv = [headers.join(','), ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

export const exportToJSON = (orders: Order[], filename: string = 'orders.json') => {
  if (orders.length === 0) {
    alert('No orders to export');
    return;
  }

  const json = JSON.stringify(orders, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};
