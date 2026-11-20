import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export function PaymentDatePicker({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" aria-label={label} className="justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{date ? format(date, 'dd MMM yyyy') : label}</Button></PopoverTrigger>
    <PopoverContent className="w-auto p-0 pointer-events-auto" align="start"><Calendar mode="single" selected={date} defaultMonth={date} onSelect={day => { if (day) { onChange(format(day, 'yyyy-MM-dd')); setOpen(false); } }} initialFocus className="pointer-events-auto" /></PopoverContent>
  </Popover>;
}