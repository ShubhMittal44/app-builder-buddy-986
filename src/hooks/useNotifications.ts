import { useEffect, useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface NotificationPermission {
  granted: boolean;
  denied: boolean;
  default: boolean;
}

export const useNotifications = () => {
  const [permission, setPermission] = useState<NotificationPermission>({
    granted: false,
    denied: false,
    default: true,
  });
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    const isSupported = 'Notification' in window && 'serviceWorker' in navigator;
    setSupported(isSupported);

    if (isSupported) {
      updatePermissionState();
    }
  }, []);

  const updatePermissionState = () => {
    if (!('Notification' in window)) return;

    const currentPermission = Notification.permission;
    setPermission({
      granted: currentPermission === 'granted',
      denied: currentPermission === 'denied',
      default: currentPermission === 'default',
    });
  };

  const requestPermission = async (): Promise<boolean> => {
    if (!supported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      updatePermissionState();

      if (result === 'granted') {
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive order update notifications',
        });
        return true;
      } else if (result === 'denied') {
        toast({
          title: 'Notifications Blocked',
          description: 'Please enable notifications in your browser settings',
          variant: 'destructive',
        });
        return false;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast({
        title: 'Error',
        description: 'Failed to request notification permission',
        variant: 'destructive',
      });
      return false;
    }
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (!supported || !permission.granted) {
      console.warn('Cannot send notification: permission not granted or not supported');
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('Error sending notification:', error);
    }
  };

  const notifyOrderUpdate = (orderNumber: number, stage: string, customerName: string) => {
    sendNotification(`Order #${orderNumber} Updated`, {
      body: `${customerName}'s order moved to ${stage}`,
      tag: `order-${orderNumber}`,
      requireInteraction: false,
    });
  };

  const notifyNewOrder = (orderNumber: number, customerName: string) => {
    sendNotification(`New Order Received`, {
      body: `Order #${orderNumber} from ${customerName}`,
      tag: `order-${orderNumber}`,
      requireInteraction: true,
    });
  };

  return {
    supported,
    permission,
    requestPermission,
    sendNotification,
    notifyOrderUpdate,
    notifyNewOrder,
  };
};
