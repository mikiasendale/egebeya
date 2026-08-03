import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, Trash2, Loader2, CalendarClock } from 'lucide-react';

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { authFetch } from '../../lib/api';
import { showToast } from '../../components/ui/toast-helper';
import { StaffRedirect } from './StaffRedirect';

// Shape returned by the enhanced GET /api/tenant/staff (each staff row gets
// a `services` array of { id, name } from the joined staff_services table).
export interface StaffMember {
  id: string;
  name: string;
  title: string | null;
  bio?: string | null;
  imagePath?: string | null;
  userId?: string | null;
  active: boolean;
  services: { id: string; name: string }[];
}

interface ServiceLite {
  id: string;
  name: string;
}

interface StaffFormValues {
  name: string;
  title: string;
}

const emptyStaffForm: StaffFormValues = { name: '', title: '' };

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

interface AvailabilityEntry {
  id?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

function jsonHeaders(extra: HeadersInit = {}): HeadersInit {
  return { 'Content-Type': 'application/json', ...extra };
}

export function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<ServiceLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / edit dialog
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Invite-login dialog
  const [inviteTarget, setInviteTarget] = useState<StaffMember | null>(null);
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteResult, setInviteResult] = useState<string | null>(null);

  // Manage-services dialog
  const [servicesTarget, setServicesTarget] = useState<StaffMember | null>(null);
  const [servicesPick, setServicesPick] = useState<string[]>([]);
  const [savingServices, setSavingServices] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);

  // Availability dialog
  const [availabilityTarget, setAvailabilityTarget] = useState<StaffMember | null>(null);
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<StaffFormValues>({
    defaultValues: emptyStaffForm,
  });
  const { errors } = formState;

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/tenant/staff');
      if (!res.ok) throw new Error('Failed to load staff');
      const data = (await res.json()) as StaffMember[];
      setStaff(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load staff');
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchServices = useCallback(async () => {
    try {
      const res = await authFetch('/api/tenant/services');
      if (!res.ok) return;
      const data = (await res.json()) as ServiceLite[];
      setServices(Array.isArray(data) ? data.map((s: any) => ({ id: s.id, name: s.name })) : []);
    } catch {
      // Non-fatal: services picker will simply be empty.
    }
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchServices();
  }, [fetchStaff, fetchServices]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    reset(emptyStaffForm);
    setFormOpen(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setFormError(null);
    reset({ name: s.name, title: s.title ?? '' });
    setFormOpen(true);
  };

  const onSubmit = async (values: StaffFormValues) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = { name: values.name.trim(), title: values.title.trim() };
      if (editing) {
        const res = await authFetch(`/api/tenant/staff/${editing.id}`, {
          method: 'PUT',
          headers: jsonHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to update staff');
        }
      } else {
        const res = await authFetch('/api/tenant/staff', {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to create staff');
        }
      }
      setFormOpen(false);
      await fetchStaff();
      showToast(
        editing ? 'Staff updated' : 'Staff member added',
        editing ? 'Changes saved successfully.' : 'The new staff member was created.',
      );
    } catch (e: any) {
      setFormError(e?.message || 'Something went wrong');
      showToast(
        editing ? 'Failed to update staff' : 'Failed to create staff',
        e?.message || 'Please try again.',
        'destructive',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`/api/tenant/staff/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete staff');
      }
      setDeleteTarget(null);
      await fetchStaff();
      showToast('Staff deleted', 'The staff member was removed.');
    } catch (e: any) {
      setFormError(e?.message || 'Something went wrong');
      showToast('Failed to delete staff', e?.message || 'Please try again.', 'destructive');
    } finally {
      setDeleting(false);
    }
  };

  // ---- Invite login ----
  const openInvite = (s: StaffMember) => {
    setInviteTarget(s);
    setInvitePhone('');
    setInviteEmail('');
    setInviteError(null);
    setInviteResult(null);
  };

  const submitInvite = async () => {
    if (!inviteTarget) return;
    setInviteError(null);
    setInviteResult(null);
    if (!invitePhone.trim()) {
      setInviteError('Phone number is required');
      return;
    }
    setInviting(true);
    try {
      const res = await authFetch('/api/tenant/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: inviteTarget.name,
          phone: invitePhone.trim(),
          email: inviteEmail.trim() || undefined,
          staff_id: inviteTarget.id,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Failed to invite');
      setInviteResult(body.resetUrl || 'Invite created. Share the reset link with the staff member.');
      await fetchStaff();
      showToast('Invite created', 'A password-setup link was generated.');
    } catch (e: any) {
      setInviteError(e?.message || 'Something went wrong');
      showToast('Failed to invite', e?.message || 'Please try again.', 'destructive');
    } finally {
      setInviting(false);
    }
  };

  // ---- Manage services ----
  const openManageServices = (s: StaffMember) => {
    setServicesTarget(s);
    setServicesPick((s.services || []).map(sv => sv.id));
    setServicesError(null);
  };

  const toggleService = (id: string) => {
    setServicesPick(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    );
  };

  const saveServices = async () => {
    if (!servicesTarget) return;
    setSavingServices(true);
    setServicesError(null);
    try {
      const res = await authFetch(`/api/tenant/staff/${servicesTarget.id}/services`, {
        method: 'POST',
        headers: jsonHeaders(),
        body: JSON.stringify({ service_ids: servicesPick }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to assign services');
      }
      setServicesTarget(null);
      await fetchStaff();
      showToast('Services assigned', 'The staff member\'s services were updated.');
    } catch (e: any) {
      setServicesError(e?.message || 'Something went wrong');
      showToast('Failed to assign services', e?.message || 'Please try again.', 'destructive');
    } finally {
      setSavingServices(false);
    }
  };

  // ---- Availability ----
  const openAvailability = async (s: StaffMember) => {
    setAvailabilityTarget(s);
    setAvailabilityError(null);
    setAvailability([]);
    setLoadingAvailability(true);
    try {
      const res = await authFetch(`/api/tenant/staff/${s.id}/availability`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load availability');
      }
      const data = (await res.json()) as AvailabilityEntry[];
      setAvailability(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setAvailabilityError(e?.message || 'Something went wrong');
    } finally {
      setLoadingAvailability(false);
    }
  };

  const toggleAvailabilityDay = (day: number) => {
    setAvailability(prev => {
      const exists = prev.find(a => a.dayOfWeek === day);
      if (exists) {
        return prev.filter(a => a.dayOfWeek !== day);
      }
      return [...prev, { dayOfWeek: day, startTime: '09:00', endTime: '17:00' }];
    });
  };

  const updateAvailabilityTime = (day: number, field: 'startTime' | 'endTime', value: string) => {
    setAvailability(prev =>
      prev.map(a => (a.dayOfWeek === day ? { ...a, [field]: value } : a)),
    );
  };

  const saveAvailability = async () => {
    if (!availabilityTarget) return;
    // Basic validation: ensure end > start where applicable.
    for (const a of availability) {
      if (a.startTime >= a.endTime) {
        setAvailabilityError(
          `${DAYS_OF_WEEK[a.dayOfWeek].label}: start time must be before end time`,
        );
        return;
      }
    }
    setSavingAvailability(true);
    setAvailabilityError(null);
    try {
      const res = await authFetch(`/api/tenant/staff/${availabilityTarget.id}/availability`, {
        method: 'PUT',
        headers: jsonHeaders(),
        body: JSON.stringify({
          availability: availability.map(a => ({
            dayOfWeek: a.dayOfWeek,
            startTime: a.startTime,
            endTime: a.endTime,
          })),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to set availability');
      }
      setAvailabilityTarget(null);
      showToast('Availability saved', 'The staff member\'s weekly hours were updated.');
    } catch (e: any) {
      setAvailabilityError(e?.message || 'Something went wrong');
      showToast('Failed to save availability', e?.message || 'Please try again.', 'destructive');
    } finally {
      setSavingAvailability(false);
    }
  };

  const servicesCellText = (s: StaffMember) =>
    s.services && s.services.length
      ? s.services.map(sv => sv.name).join(', ')
      : '—';

  return (
    <StaffRedirect>
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-ink">Staff</h2>
          <p className="text-sm text-ink-soft">
            Manage staff, the services they offer, and their weekly availability.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Staff
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-ink-rule shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading staff…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">{error}</div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-paper-raised">
              <Plus className="h-6 w-6 text-ink-stamp" />
            </div>
            <p className="font-medium text-ink">No staff yet. Add your first team member.</p>
            <p className="text-sm text-ink-soft mt-1">
              Staff are the people customers can book appointments with.
            </p>
            <Button className="mt-4" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Staff
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-ink">{s.name}</TableCell>
                  <TableCell>{s.title || '—'}</TableCell>
                  <TableCell className="max-w-xs">
                    <span className="block truncate text-ink-soft" title={servicesCellText(s)}>
                      {servicesCellText(s)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {s.active ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openManageServices(s)}
                      >
                        Manage Services
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openAvailability(s)}
                      >
                        <CalendarClock className="h-4 w-4" />
                        Availability
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      {!s.userId && (
                        <Button variant="outline" size="sm" onClick={() => openInvite(s)}>
                          <Plus className="h-4 w-4" />
                          Invite login
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(s)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create / Edit staff dialog */}
      <Dialog open={formOpen} onOpenChange={o => !submitting && setFormOpen(o)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit staff' : 'Add staff'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update this staff member’s name and title.'
                : 'Create a new staff member. You can assign services and set availability afterwards.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">Name</Label>
              <Input
                id="staff-name"
                placeholder="e.g. Abebe Bekele"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="staff-title">Title</Label>
              <Input
                id="staff-title"
                placeholder="e.g. Senior Barber"
                {...register('title')}
              />
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing ? 'Save changes' : 'Create staff'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={o => !deleting && !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete staff</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-ink">{deleteTarget?.name}</span>? This
              will also remove their service assignments and availability. This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite login dialog */}
      <Dialog
        open={!!inviteTarget}
        onOpenChange={o => !inviting && !o && setInviteTarget(null)}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Invite {inviteTarget?.name} to log in</DialogTitle>
            <DialogDescription>
              This creates a staff login for the member. They set their own password using the
              link below (valid for 15 minutes).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="invite-phone">Phone number</Label>
              <Input
                id="invite-phone"
                placeholder="+251911234567"
                value={invitePhone}
                onChange={e => setInvitePhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email (optional)</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="staff@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>

            {inviteError && <p className="text-sm text-accent">{inviteError}</p>}

            {inviteResult && (
              <div className="rounded-md border border-ink-rule bg-surface-raised p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Password-setup link (share with the staff member)
                </p>
                <p className="mt-1 break-all text-sm text-ink">{inviteResult}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setInviteTarget(null)}
                disabled={inviting}
              >
                Close
              </Button>
              <Button onClick={submitInvite} disabled={inviting || !!inviteResult}>
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                {inviteResult ? 'Invite created' : 'Create invite'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage services dialog */}
      <Dialog
        open={!!servicesTarget}
        onOpenChange={o => !savingServices && !o && setServicesTarget(null)}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage services — {servicesTarget?.name}</DialogTitle>
            <DialogDescription>
              Select the services this staff member can be booked for.
            </DialogDescription>
          </DialogHeader>

          {services.length === 0 ? (
        <p className="text-sm text-ink-soft">
          You haven't created any services yet. Add services first, then assign them here.
        </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {services.map(sv => {
                const checked = servicesPick.includes(sv.id);
                return (
                  <label
                    key={sv.id}
                    className="flex cursor-pointer items-center gap-3 rounded-md border border-ink-rule px-3 py-2 text-sm hover:bg-paper-raised"
                  >
                    <Checkbox checked={checked} onChange={() => toggleService(sv.id)} />
                    <span className="text-ink">{sv.name}</span>
                  </label>
                );
              })}
            </div>
          )}

          {servicesError && <p className="text-sm text-red-600">{servicesError}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setServicesTarget(null)}
              disabled={savingServices}
            >
              Cancel
            </Button>
            <Button onClick={saveServices} disabled={savingServices || services.length === 0}>
              {savingServices && <Loader2 className="h-4 w-4 animate-spin" />}
              Save services
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Availability dialog */}
      <Dialog
        open={!!availabilityTarget}
        onOpenChange={o => !savingAvailability && !o && setAvailabilityTarget(null)}
      >
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl">
          <DialogHeader>
            <DialogTitle>Weekly availability — {availabilityTarget?.name}</DialogTitle>
            <DialogDescription>
              Select working days and set the start/end time for each. Days you leave
              unchecked mean the staff member is unavailable.
            </DialogDescription>
          </DialogHeader>

          {loadingAvailability ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading availability…
          </div>
          ) : (
            <div className="space-y-3">
              {DAYS_OF_WEEK.map(day => {
                const entry = availability.find(a => a.dayOfWeek === day.value);
                const checked = !!entry;
                return (
                  <div
                    key={day.value}
                    className="flex flex-col gap-3 rounded-md border border-ink-rule p-3 sm:flex-row sm:items-center"
                  >
                    <label className="flex w-40 shrink-0 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                      <Checkbox
                        checked={checked}
                        onChange={() => toggleAvailabilityDay(day.value)}
                      />
                      {day.label}
                    </label>

                    <div
                      className={`flex flex-1 flex-wrap items-center gap-2 ${
                        checked ? '' : 'opacity-50 pointer-events-none'
                      }`}
                    >
                      <Input
                        type="time"
                        value={entry?.startTime ?? '09:00'}
                        onChange={e =>
                          entry &&
                          updateAvailabilityTime(day.value, 'startTime', e.target.value)
                        }
                        className="w-32"
                        disabled={!checked}
                        aria-label={`${day.label} start time`}
                      />
                      <span className="text-ink-stamp">to</span>
                      <Input
                        type="time"
                        value={entry?.endTime ?? '17:00'}
                        onChange={e =>
                          entry &&
                          updateAvailabilityTime(day.value, 'endTime', e.target.value)
                        }
                        className="w-32"
                        disabled={!checked}
                        aria-label={`${day.label} end time`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {availabilityError && <p className="text-sm text-red-600">{availabilityError}</p>}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAvailabilityTarget(null)}
              disabled={savingAvailability}
            >
              Cancel
            </Button>
            <Button
              onClick={saveAvailability}
              disabled={savingAvailability || loadingAvailability}
            >
              {savingAvailability && <Loader2 className="h-4 w-4 animate-spin" />}
              Save availability
            </Button>
          </DialogFooter>
       </DialogContent>
     </Dialog>
   </div>
   </StaffRedirect>
  );
}

export default StaffPage;
