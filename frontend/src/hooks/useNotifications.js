/**
 * useNotifications — polling hook for user notifications
 */
import { useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../services/appointmentAPI';

export function useNotifications(pollIntervalMs = 30000) {
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationAPI.getAll();
      const data = res.data.data;
      setNotifications(data.notifications || []);
      setUnread(data.unread_count || 0);
    } catch {
      // Silently fail — no toast spam
    }
  }, []);

  const markRead = useCallback(async (id) => {
    await notificationAPI.markRead(id).catch(() => {});
    setNotifications(n => n.map(x => x.id === id ? { ...x, is_read: true } : x));
    setUnread(u => Math.max(0, u - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationAPI.markAllRead().catch(() => {});
    setNotifications(n => n.map(x => ({ ...x, is_read: true })));
    setUnread(0);
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  return { notifications, unread, loading, refresh, markRead, markAllRead };
}
