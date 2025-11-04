import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface UserPresence {
  user_id: string;
  email: string;
  display_name: string;
  online_at: string;
  viewing_order?: string;
}

export const useRealtimePresence = (orderId?: string) => {
  const { user, profile } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([]);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!user) return;

    // Create a channel for presence tracking
    const channelName = orderId ? `order:${orderId}` : 'orders:global';
    const presenceChannel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    // Track sync events
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState<UserPresence>();
        const users = Object.values(state).flat();
        setOnlineUsers(users);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      });

    // Subscribe to the channel
    presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        // Track user presence
        await presenceChannel.track({
          user_id: user.id,
          email: user.email || '',
          display_name: profile?.display_name || user.email?.split('@')[0] || 'Unknown',
          online_at: new Date().toISOString(),
          viewing_order: orderId,
        });
      }
    });

    setChannel(presenceChannel);

    // Cleanup
    return () => {
      presenceChannel.untrack();
      presenceChannel.unsubscribe();
    };
  }, [user, profile, orderId]);

  const updatePresence = async (data: Partial<UserPresence>) => {
    if (!channel || !user) return;

    await channel.track({
      user_id: user.id,
      email: user.email || '',
      display_name: profile?.display_name || user.email?.split('@')[0] || 'Unknown',
      online_at: new Date().toISOString(),
      viewing_order: orderId,
      ...data,
    });
  };

  return {
    onlineUsers,
    updatePresence,
  };
};
