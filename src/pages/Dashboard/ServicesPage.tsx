import React, { useEffect, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { Pencil, Plus, Trash2, Loader2, Scissors } from 'lucide-react';

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

// Matches GET /api/tenant/services response. The spec describes `imageUrl?`
// while the backend column is `imagePath`; we keep both available so the
// type is tolerant of either shape returned by the API.
export interface Service {
  id: string;
  name: string;
  durationMinutes: number;
  price: number; // stored in ETB cents on the server
  active: boolean;
  imageUrl?: string | null;
  imagePath?: string | null;
}

interface ServiceFormValues {
  name: string;
  durationMinutes: number;
  priceBirr: number; // entered in Birr; converted to cents on submit
  active: boolean;
}

const emptyForm: ServiceFormValues = {
  name: '',
  durationMinutes: 30,
  priceBirr: 0,
  active: true,
};

function formatDuration(minutes: number): string {
  return `${minutes} min`;
}

function formatPrice(cents: number): string {
  const birr = (cents ?? 0) / 100;
  // "X,XXX ETB" — use grouping separators
  return `${birr.toLocaleString('en-US')} ETB`;
}

function toServicePayload(values: ServiceFormValues) {
  return {
    name: values.name.trim(),
    durationMinutes: values.durationMinutes,
    price: Math.round(values.priceBirr * 100), // Birr -> cents
    active: values.active,
  };
}

function jsonHeaders(extra: HeadersInit = {}): HeadersInit {
  return { 'Content-Type': 'application/json', ...extra };
}

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { register, handleSubmit, reset, formState } = useForm<ServiceFormValues>({
    defaultValues: emptyForm,
  });
  const { errors } = formState;

  const fetchServices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/tenant/services');
      if (!res.ok) throw new Error('Failed to load services');
      const data = (await res.json()) as Service[];
      setServices(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load services');
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    reset(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (svc: Service) => {
    setEditing(svc);
    setFormError(null);
    reset({
      name: svc.name,
      durationMinutes: svc.durationMinutes,
      priceBirr: (svc.price ?? 0) / 100,
      active: !!svc.active,
    });
    setFormOpen(true);
  };

  const onSubmit = async (values: ServiceFormValues) => {
    setFormError(null);
    setSubmitting(true);
    try {
      const payload = toServicePayload(values);
      if (editing) {
        const res = await authFetch(`/api/tenant/services/${editing.id}`, {
          method: 'PUT',
          headers: jsonHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to update service');
        }
      } else {
        const res = await authFetch('/api/tenant/services', {
          method: 'POST',
          headers: jsonHeaders(),
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to create service');
        }
      }
      setFormOpen(false);
      await fetchServices();
      showToast(
        editing ? 'Service updated' : 'Service created',
        editing ? 'The service was saved successfully.' : 'The new service was added.',
      );
    } catch (e: any) {
      setFormError(e?.message || 'Something went wrong');
      showToast(
        editing ? 'Failed to update service' : 'Failed to create service',
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
      const res = await authFetch(`/api/tenant/services/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to delete service');
      }
      setDeleteTarget(null);
      await fetchServices();
      showToast('Service deleted', 'The service was removed.');
    } catch (e: any) {
      setFormError(e?.message || 'Something went wrong');
      showToast('Failed to delete service', e?.message || 'Please try again.', 'destructive');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <StaffRedirect>
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
<h2 className="text-xl font-bold text-ink">Services</h2>
        <p className="text-sm text-ink-soft">Manage the services customers can book.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Service
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-ink-rule shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-ink-soft">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading services…
          </div>
        ) : error ? (
          <div className="p-8 text-center text-sm text-red-600">{error}</div>
        ) : services.length === 0 ? (
          <div className="p-12 text-center">
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'var(--color-ink-rule)', color: 'var(--color-ink-soft)' }}
            >
              <Scissors className="h-8 w-8" />
            </div>
            <p className="font-bold text-ink mb-2" style={{ fontFamily: 'var(--font-display)' }}>
              No services added yet.
            </p>
            <p className="text-sm text-ink-soft mb-4 max-w-xs mx-auto">
              Add the services customers can book on your public site.
            </p>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add Your First Service
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((svc) => (
                <TableRow key={svc.id}>
                  <TableCell className="font-medium text-ink">{svc.name}</TableCell>
                  <TableCell>{formatDuration(svc.durationMinutes)}</TableCell>
                  <TableCell>{formatPrice(svc.price)}</TableCell>
                  <TableCell>
                    {svc.active ? (
                      <Badge variant="success">Yes</Badge>
                    ) : (
                      <Badge variant="secondary">No</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEdit(svc)}>
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(svc)}
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

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={(o) => !submitting && setFormOpen(o)}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit service' : 'Add service'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Update the details of this service.'
                : 'Create a new service for customers to book.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="svc-name">Name</Label>
              <Input
                id="svc-name"
                placeholder="e.g. Men's haircut"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="svc-duration">Duration (minutes)</Label>
                <Input
                  id="svc-duration"
                  type="number"
                  min={1}
                  step={1}
                  {...register('durationMinutes', {
                    required: 'Duration is required',
                    valueAsNumber: true,
                    min: { value: 1, message: 'Must be at least 1 minute' },
                  })}
                />
                {errors.durationMinutes && (
                  <p className="text-xs text-red-600">{errors.durationMinutes.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="svc-price">Price (Birr)</Label>
                <Input
                  id="svc-price"
                  type="number"
                  min={0}
                  step={0.01}
                  {...register('priceBirr', {
                    required: 'Price is required',
                    valueAsNumber: true,
                    min: { value: 0, message: 'Must be 0 or more' },
                  })}
                />
                {errors.priceBirr && (
                  <p className="text-xs text-red-600">{errors.priceBirr.message}</p>
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <Checkbox {...register('active')} />
              Active
            </label>

            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}

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
                {editing ? 'Save changes' : 'Create service'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !deleting && !o && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete service</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <span className="font-semibold text-ink">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone.
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
    </div>
    </StaffRedirect>
  );
}

export default ServicesPage;
