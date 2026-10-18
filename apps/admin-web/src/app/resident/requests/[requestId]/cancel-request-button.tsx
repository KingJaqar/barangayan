'use client';

import { useRouter } from 'next/navigation';

import { ConfirmButton } from '@/components/admin/confirm-button';
import { notify as toast } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function CancelRequestButton({ requestId }: { requestId: string }) {
  const router = useRouter();

  async function handleCancel() {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc('cancel_own_service_request', {
      p_request_id: requestId,
      p_note: 'Cancelled by resident',
    });
    if (error) {
      toast.error(`Failed to cancel: ${error.message}`);
      return;
    }
    toast.success('Request cancelled.');
    router.refresh();
  }

  return (
    <ConfirmButton
      label="Cancel Request"
      confirmLabel="Cancel this request?"
      onConfirm={handleCancel}
      title="Cancel Request"
      className="rounded-full border border-red-200 px-5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"
    />
  );
}
