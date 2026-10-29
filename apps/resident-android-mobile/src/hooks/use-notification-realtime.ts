import type { Tables } from '@barangayan/shared';
import { useEffect } from 'react';

import { presentNotification } from '@/lib/push-notifications';
import { driveRegistrationTemplate, medicalDriveTemplate } from '@/lib/notification-templates';
import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel';

/**
 * Local alerts for the Health events (medical drives and drive registrations), kept as they
 * are by the notifications plan (D13). Announcements, document requests and incident reports
 * are presented from the server's event/outbox push, so they have no branch here. All
 * channels tear down whenever `enabled` flips false, `userId`/`barangayId` change, or the
 * component unmounts.
 */
export function useNotificationRealtime(
  enabled: boolean,
  userId: string | null,
  barangayId: string | null,
) {
  useEffect(() => {
    if (!enabled || !userId || !barangayId) return;

    const channels = [
      supabase
        .channel(uniqueChannelName(`push:drive_registrations:${userId}`))
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'drive_registrations', filter: `user_id=eq.${userId}` },
          async (payload) => {
            const row = payload.new as Tables<'drive_registrations'>;
            const { data: drive } = await supabase
              .from('medical_drives')
              .select('title')
              .eq('id', row.drive_id)
              .single();
            const { title, body } = driveRegistrationTemplate(row, drive?.title ?? 'your drive registration');
            presentNotification(title, body);
          },
        )
        .subscribe(),

      supabase
        .channel(uniqueChannelName(`push:medical_drives:${barangayId}`))
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'medical_drives', filter: `barangay_id=eq.${barangayId}` },
          (payload) => {
            const row = payload.new as Tables<'medical_drives'>;
            if (!row.is_active) return;
            const { title, body } = medicalDriveTemplate(row);
            presentNotification(title, body);
          },
        )
        .subscribe(),
    ];

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [enabled, userId, barangayId]);
}
