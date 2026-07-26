import { toast } from './use-toast';
import type { ToastVariant } from './toast';

export const showToast = (
  title: string,
  description?: string,
  variant?: ToastVariant,
) =>
  toast({
    title,
    description,
    variant,
  });
