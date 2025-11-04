import { Users, Circle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useRealtimePresence, UserPresence } from '@/hooks/useRealtimePresence';
import { Badge } from '@/components/ui/badge';

interface OnlineUsersProps {
  orderId?: string;
}

export const OnlineUsers = ({ orderId }: OnlineUsersProps) => {
  const { onlineUsers } = useRealtimePresence(orderId);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (onlineUsers.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Online Users
          <Badge variant="secondary" className="ml-auto">
            {onlineUsers.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          {orderId ? 'Viewing this order' : 'Active in the system'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {onlineUsers.map((user) => (
            <div key={user.user_id} className="flex items-center gap-3">
              <div className="relative">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(user.display_name)}
                  </AvatarFallback>
                </Avatar>
                <Circle className="absolute -bottom-1 -right-1 w-4 h-4 fill-green-500 text-green-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.display_name}</p>
                <p className="text-xs text-muted-foreground">{getTimeAgo(user.online_at)}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
