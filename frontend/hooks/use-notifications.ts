import { useState, useCallback, useEffect } from 'react';
import { useAuth } from './use-auth';
import { api } from '@/lib/api';
import { errorLogger } from '@/lib/error-logger';
import type { Notification as BackendNotification, NotificationResponse } from '@/lib/types/backend';

// Frontend notification type for compatibility with existing UI
export interface Notification {
  id: string;
  type: 'trade' | 'portfolio' | 'price' | 'system' | 'leaderboard' | 'rewards' | 'wallet_tracker' | 'achievement';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  userId?: string;
  metadata?: any;
  actionUrl?: string | null;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
}

// Map backend notification category to frontend type
function mapCategoryToType(category: string): Notification['type'] {
  switch (category) {
    case 'TRADE':
      return 'trade';
    case 'PORTFOLIO':
      return 'portfolio';
    case 'LEADERBOARD':
      return 'leaderboard';
    case 'REWARDS':
      return 'rewards';
    case 'WALLET_TRACKER':
      return 'wallet_tracker';
    case 'ACHIEVEMENT':
      return 'achievement';
    case 'SYSTEM':
    case 'GENERAL':
      return 'system';
    default:
      return 'system';
  }
}

// Convert backend notification to frontend format
function convertNotification(backendNotif: BackendNotification): Notification {
  let metadata: any = {};
  try {
    metadata = backendNotif.metadata ? JSON.parse(backendNotif.metadata) : {};
  } catch (e) {
    errorLogger.error('Failed to parse notification metadata', { error: e as Error, component: 'useNotifications' });
  }

  return {
    id: backendNotif.id,
    type: mapCategoryToType(backendNotif.category),
    title: backendNotif.title,
    message: backendNotif.message,
    timestamp: new Date(backendNotif.createdAt),
    read: backendNotif.read,
    userId: backendNotif.userId,
    metadata,
    actionUrl: backendNotif.actionUrl,
  };
}

export function useNotifications() {
  const { user, isAuthenticated } = useAuth();
  const [state, setState] = useState<NotificationState>({
    notifications: [],
    unreadCount: 0,
    loading: false,
  });

  // Fetch notifications from the backend
  const fetchNotifications = useCallback(async () => {
    if (!user?.id || !isAuthenticated) return;

    setState(prev => ({ ...prev, loading: true }));

    try {
      const response = await api.get<NotificationResponse>('/api/notifications', {
        params: { limit: 50 },
      });

      if (response.data.success) {
        const notifications = response.data.notifications.map(convertNotification);
        setState({
          notifications,
          unreadCount: response.data.unreadCount,
          loading: false,
        });
      }
    } catch (error) {
      errorLogger.error('Failed to fetch notifications', { error: error as Error, component: 'useNotifications' });
      setState(prev => ({ ...prev, loading: false }));
    }
  }, [user?.id, isAuthenticated]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Poll for new notifications every 30 seconds
  useEffect(() => {
    if (!user?.id || !isAuthenticated) return;

    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [user?.id, isAuthenticated, fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!isAuthenticated) return;

    // Optimistic update
    setState(prev => ({
      ...prev,
      notifications: prev.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(0, prev.unreadCount - 1),
    }));

    try {
      await api.patch(`/api/notifications/${notificationId}/read`);
    } catch (error) {
      errorLogger.error('Failed to mark notification as read', { error: error as Error, component: 'useNotifications' });
      // Revert on error
      fetchNotifications();
    }
  }, [isAuthenticated, fetchNotifications]);

  const markAllAsRead = useCallback(async () => {
    if (!isAuthenticated || !user?.id) return;

    // Capture snapshot before mutation via functional setState
    let previousSnapshot: NotificationState | null = null;
    setState(prev => {
      previousSnapshot = { ...prev, notifications: [...prev.notifications] };
      return {
        ...prev,
        notifications: prev.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      };
    });

    try {
      await api.patch(`/api/notifications/read-all`);
      await fetchNotifications();
    } catch (error) {
      errorLogger.error('Failed to mark all notifications as read', { error: error as Error, component: 'useNotifications' });
      if (previousSnapshot) {
        setState(previousSnapshot);
      }
    }
  }, [isAuthenticated, user?.id, fetchNotifications]);

  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      notifications: [newNotification, ...prev.notifications.slice(0, 49)], // Keep max 50
      unreadCount: prev.unreadCount + (newNotification.read ? 0 : 1),
    }));
  }, []);

  const removeNotification = useCallback(async (notificationId: string) => {
    if (!isAuthenticated) return;

    // Optimistic update
    setState(prev => {
      const notification = prev.notifications.find(n => n.id === notificationId);
      return {
        ...prev,
        notifications: prev.notifications.filter(n => n.id !== notificationId),
        unreadCount: notification && !notification.read
          ? Math.max(0, prev.unreadCount - 1)
          : prev.unreadCount,
      };
    });

    try {
      await api.delete(`/api/notifications/${notificationId}`);
    } catch (error) {
      errorLogger.error('Failed to delete notification', { error: error as Error, component: 'useNotifications' });
      // Revert on error
      fetchNotifications();
    }
  }, [isAuthenticated, fetchNotifications]);

  return {
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    loading: state.loading,
    markAsRead,
    markAllAsRead,
    addNotification,
    removeNotification,
    refresh: fetchNotifications,
  };
}