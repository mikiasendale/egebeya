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
    // Optionally fetch settings if we had a dedicated endpoint, but we can decode token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // If settings were in token, we could use them.
        // For now let's try fetching public settings if we know the subdomain.
        const tenantSlug = localStorage.getItem('tenantSlug');
        if (tenantSlug) {
           fetch('/api/public/page', { headers: { 'X-Tenant-Slug': tenantSlug }})
             .then(res => res.json())
             .then(data => {
               if (data.tenant?.settings?.calendar_display) {
                 setCalendarDisplay(data.tenant.settings.calendar_display);
               }
             })
             .catch(console.error);
        }
      } catch(e) {}
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
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
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
    <div className="flex flex-col md:flex-row gap-6">
      <div className="w-full md:w-80 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
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
      
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-lg font-bold">Appointments on {format(date, 'MMM d, yyyy')}</h2>
          <div className="text-sm text-gray-500">{bookings.length} total</div>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={bookings.length === 0 || loading}
            className="border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>
        
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl text-gray-400">📅</span>
            </div>
            <p className="text-gray-500 font-medium mb-2">No bookings for this date</p>
            <p className="text-sm text-gray-400">Select another date or wait for new bookings.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {bookings.map(booking => (
              <div key={booking.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-bold text-lg">{format(new Date(booking.startTime), 'HH:mm')}</span>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full 
                        ${booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : ''}
                        ${booking.status === 'pending' ? 'bg-amber-100 text-amber-800' : ''}
                        ${booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : ''}
                        ${booking.status === 'completed' ? 'bg-blue-100 text-blue-800' : ''}
                        ${booking.status === 'no_show' ? 'bg-gray-100 text-gray-800' : ''}
                      `}>
                        {booking.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900">{booking.customerName}</div>
                    <div className="text-sm text-gray-500 flex items-center gap-4 mt-1">
                      <span>📱 {booking.customerPhone}</span>
                      <span>✂️ {booking.serviceName} ({booking.staffName})</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {booking.status === 'pending' && (
                      <button onClick={() => updateStatus(booking.id, 'confirmed')} className="px-3 py-1.5 text-sm bg-green-50 text-green-600 hover:bg-green-100 font-medium rounded-md border border-green-200">
                        Confirm
                      </button>
                    )}
                    {(booking.status === 'pending' || booking.status === 'confirmed') && (
                      <button onClick={() => updateStatus(booking.id, 'completed')} className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium rounded-md border border-blue-200">
                        Complete
                      </button>
                    )}
                    <select 
                      value={booking.status}
                      onChange={(e) => updateStatus(booking.id, e.target.value)}
                      className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-[#1E3A8A]"
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
