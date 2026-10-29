import { Navigate } from 'react-router-dom';
import { useAuth, ModuleKey, PermAction } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/LoadingStates';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  module?: ModuleKey;
  action?: PermAction;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requireAdmin = false,
  module,
  action = 'view',
}) => {
  const { user, profile, loading, isAdmin, can } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (module && !can(module, action)) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
