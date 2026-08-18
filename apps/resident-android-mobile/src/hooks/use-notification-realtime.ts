import type { Tables } from '@barangayan/shared';
import { useEffect } from 'react';

import { presentNotification } from '@/lib/push-notifications';
import {
  announcementTemplate,
  driveRegistrationTemplate,
  incidentTemplate,
  medicalDriveTemplate,
  serviceRequestTemplate,
} from '@/lib/notification-templates';
import { supabase } from '@/lib/supabase';
import { uniqueChannelName } from '@/lib/realtime-channel';

/**
 * The delivery engine — opens one Supabase realtime channel per source table and presents
 * a local notification when a relevant row event fires. Mirrors the channel/subscribe/
 * cleanup pattern used by use-announcements.ts etc. All channels tear down whenever
 * `enabled` flips false, `userId`/`barangayId` change, or the component unmounts.
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
        .channel(uniqueChannelName(`push:announcements:${barangayId}`))
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'announcements', filter: `barangay_id=eq.${barangayId}` },
          (payload) => {
            const { title, body } = announcementTemplate(payload.new as Tables<'announcements'>);
            presentNotification(title, body);
          },
        )
        .subscribe(),

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

      supabase
        .channel(uniqueChannelName(`push:incidents:${userId}`))
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `reporter_id=eq.${userId}` },
          (payload) => {
            const { title, body } = incidentTemplate(payload.new as Tables<'incidents'>);
            presentNotification(title, body);
          },
        )
        .subscribe(),

      supabase
        .channel(uniqueChannelName(`push:service_requests:${userId}`))
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `resident_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as Tables<'service_requests'>;
            const previous = payload.old as Tables<'service_requests'> | null;
            const { title, body } = serviceRequestTemplate(row, previous);
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
