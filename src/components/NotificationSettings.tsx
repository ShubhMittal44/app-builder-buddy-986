import { useState } from 'react';
import { Bell, BellOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useNotifications } from '@/hooks/useNotifications';
import { Badge } from '@/components/ui/badge';

export const NotificationSettings = () => {
  const { supported, permission, requestPermission } = useNotifications();
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [newOrders, setNewOrders] = useState(true);
  const [stageChanges, setStageChanges] = useState(true);

  const handleEnableNotifications = async () => {
    await requestPermission();
  };

  if (!supported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="w-5 h-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Push Notifications
          {permission.granted && (
            <Badge variant="outline" className="ml-2">
              <Check className="w-3 h-3 mr-1" />
              Enabled
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Receive real-time notifications about order updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!permission.granted && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enable push notifications to receive real-time alerts about order status changes,
              new orders, and important updates.
            </p>
            <Button onClick={handleEnableNotifications} className="w-full">
              Enable Push Notifications
            </Button>
          </div>
        )}

        {permission.granted && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="order-updates">Order Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when orders are updated
                </p>
              </div>
              <Switch
                id="order-updates"
                checked={orderUpdates}
                onCheckedChange={setOrderUpdates}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="new-orders">New Orders</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when new orders are created
                </p>
              </div>
              <Switch
                id="new-orders"
                checked={newOrders}
                onCheckedChange={setNewOrders}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="stage-changes">Stage Changes</Label>
                <p className="text-sm text-muted-foreground">
                  Notify when order stage changes
                </p>
              </div>
              <Switch
                id="stage-changes"
                checked={stageChanges}
                onCheckedChange={setStageChanges}
              />
            </div>
          </div>
        )}

        {permission.denied && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">
              Notifications are blocked. Please enable them in your browser settings to receive
              real-time updates.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
