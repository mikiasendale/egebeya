import React, { useState, useEffect } from 'react';
import { format, startOfDay } from 'date-fns';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

import { EthiopianDayPicker } from '../../components/EthiopianDayPicker';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';

export function Bookings() {
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [calendarDisplay, setCalendarDisplay] = useState<'ethiopian' | 'gregorian'>('ethiopian'); // assume ethiopian by default or fetch it

  useEffect(() => {
    // Fetch the tenant's calendar preference from the public page payload.
    const tenantSlug = localStorage.getItem('tenantSlug');
    if (tenantSlug) {
      fetch('/api/public/page', { headers: { 'X-Tenant-Slug': tenantSlug } })
        .then(res => res.json())
        .then(data => {
          if (data.tenant?.calendar_display) {
            setCalendarDisplay(data.tenant.calendar_display);
          }
        })
        .catch(console.error);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [date]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const res = await authFetch(`/api/bookings?date=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setBookings(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const res = await authFetch(`/api/bookings/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        fetchBookings();
        showToast('Booking updated', `Status set to ${newStatus}.`);
      } else {
        const body = await res.json().catch(() => ({}));
        showToast('Failed to update status', body.error || 'Please try again.', 'destructive');
      }
    } catch (error) {
      console.error('Failed to update status', error);
      showToast('Failed to update status', 'Network error.', 'destructive');
    }
  };

  function downloadCsv() {
    const headers = [
      'Customer Name',
      'Phone',
      'Service',
      'Staff',
      'Start Time',
      'Status',
    ];

    function escapeCell(value: any): string {
      const s = value == null ? '' : String(value);
      // CSV-formula-injection guard: when a cell starts with one of the
      // characters Excel/Sheets/LibreOffice interpret as a formula (=, +,
      // -, @, tab, CR), prepend a single quote so the spreadsheet renders
      // the value as text instead of evaluating it (which could otherwise
      // execute DDE/network actions on the owner's machine when they open
      // an export containing attacker-controlled customer_name strings).
      const needsQuote = /^[=+\-@\t\r]/.test(s);
      let escaped = s;
      if (needsQuote) escaped = `'${escaped}`;
      if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n')) {
        return `"${escaped.replace(/"/g, '""')}"`;
      }
      return escaped;
    }

    function formatStartTime(ms: number): string {
      if (!ms) return '';
      try {
        const d = new Date(ms);
        // ISO-ish local time, readable in spreadsheets.
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
      } catch {
        return '';
      }
    }

    const rows = bookings.map((b) => [
      escapeCell(b.customerName),
      escapeCell(b.customerPhone),
      escapeCell(b.serviceName),
      escapeCell(b.staffName),
      escapeCell(formatStartTime(b.startTime)),
      escapeCell(b.status),
    ]);

    const csv = [headers.map(escapeCell).join(','), ...rows.map((r) => r.join(','))].join('\n');
    const url = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookings-${format(date, 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="flex flex-col md:flex-row gap-6" style={{ fontFamily: 'var(--font-body)' }}>
      <div className="w-full md:w-80 bg-paper-bleached p-4 rounded-xl border border-ink-rule">
        {calendarDisplay === 'ethiopian' ? (
          <div className="flex justify-center">
            <EthiopianDayPicker 
              selected={date}
              onSelect={(d) => d && setDate(d)}
            />
          </div>
        ) : (
          <DayPicker
            mode="single"
            selected={date}
            onSelect={(d) => d && setDate(d)}
            className="mx-auto"
          />
        )}
      </div>
      
      <div className="flex-1 bg-paper-bleached rounded-xl border border-ink-rule overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-rule flex flex-wrap justify-between items-center gap-3">
          <h2 className="text-lg font-bold text-ink">Appointments on {format(date, 'MMM d, yyyy')}</h2>
          <div className="text-sm text-ink-soft">{bookings.length} total</div>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={bookings.length === 0 || loading}
            className="border border-ink-rule bg-paper-bleached text-ink hover:bg-paper-raised px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-ink-soft">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-paper-raised rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-ink-stamp">📅</span>
            </div>
            <p className="text-ink-soft font-medium mb-2">No bookings for this date</p>
            <p className="text-sm text-ink-stamp">Select another date or wait for new bookings.</p>
          </div>
        ) : (
          <div className="divide-y divide-ink-rule">
            {bookings.map(booking => (
              <div key={booking.id} className="p-6 hover:bg-paper-raised transition-colors">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg text-ink">{format(new Date(booking.startTime), 'HH:mm')}</span>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full 
                        ${booking.status === 'confirmed' ? 'bg-telebirr/10 text-telebirr-deep' : ''}
      ${booking.status === 'pending' ? 'bg-accent-secondary/10 text-accent-secondary-deep' : ''}
      ${booking.status === 'cancelled' ? 'bg-accent text-accent-deep' : ''}
                        ${booking.status === 'completed' ? 'bg-ink/10 text-ink' : ''}
                        ${booking.status === 'no_show' ? 'bg-paper-raised text-ink-soft' : ''}
                      `}>
                        {booking.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-medium text-ink">{booking.customerName}</div>
                    <div className="text-sm text-ink-soft flex items-center gap-4 mt-1">
                      <span>📱 {booking.customerPhone}</span>
                      <span>✂️ {booking.serviceName} ({booking.staffName})</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {booking.status === 'pending' && (
                      <button onClick={() => updateStatus(booking.id, 'confirmed')} className="px-3 py-1.5 text-sm bg-telebirr/10 text-telebirr-deep hover:opacity-80 font-medium rounded-md border border-telebirr/30">
                        Confirm
                      </button>
                    )}
                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                      <button onClick={() => updateStatus(booking.id, 'completed')} className="px-3 py-1.5 text-sm bg-ink/10 text-ink hover:opacity-80 font-medium rounded-md border border-ink/30">
                        Complete
                      </button>
                    )}
                    <select 
                      value={booking.status}
                      onChange={(e) => updateStatus(booking.id, e.target.value)}
                      className="px-3 py-1.5 text-sm border border-ink-rule rounded-md focus:outline-none focus:border-ink"
                      style={{ color: 'var(--color-ink)', fontFamily: 'var(--font-body)' }}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="completed">Completed</option>
                      <option value="no_show">No Show</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
