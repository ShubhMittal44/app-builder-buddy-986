# RGH Order Management - Deployment Guide

## Production Readiness Checklist

### Security ✅
- [x] Role-based access control implemented
- [x] RLS policies configured for all tables
- [x] Proper authentication with Supabase Auth
- [x] File upload security with role-based permissions
- [x] Profile data protection with strict RLS
- [x] Function search_path security configured

### Performance ✅
- [x] PWA configuration with service worker
- [x] Supabase caching strategy implemented
- [x] Real-time subscriptions optimized
- [x] Code splitting with React Router
- [x] Asset optimization in Vite config

### Features ✅
- [x] Complete order management workflow (6 stages)
- [x] File upload and management
- [x] Real-time updates and presence tracking
- [x] Analytics dashboard
- [x] Push notifications
- [x] Data export (CSV)
- [x] Search and filtering
- [x] Role-based UI (admin, manager, staff)

## Environment Configuration

### Required Supabase Settings

1. **Authentication**
   - Email authentication enabled
   - Password requirements configured
   - Enable leaked password protection (recommended)

2. **Storage Bucket**
   - Bucket: `sizes_chalan`
   - RLS policies applied
   - File size limits configured

3. **Database**
   - All migrations applied
   - RLS enabled on all tables
   - Indexes created for performance

## User Roles

### Admin
- Full access to all features
- Can manage users and roles
- Can delete orders and files
- Access to all analytics

### Manager
- Can create and modify orders
- Can upload and manage files
- Full read access to orders
- Access to analytics

### Staff
- Can view orders (with site restrictions ready for implementation)
- Can update orders in processing, dispatch, and fitting stages
- Can view files (read-only)
- Limited analytics access

## Security Considerations

### Implemented Security Measures

1. **Data Access Control**
   - Managers and admins can access all orders
   - Staff can access orders (site-based restrictions framework in place)
   - Users can only access their own profile data
   - Admins can manage all user profiles

2. **File Security**
   - Only managers and admins can upload files
   - All authenticated users can view files based on role
   - Only admins can delete files
   - Files stored in secure Supabase storage

3. **Role Protection**
   - Users cannot change their own roles
   - Only admins can modify user roles
   - Role validation on all critical operations

### Recommended Additional Security

1. **Enable Leaked Password Protection**
   - Navigate to Supabase Auth settings
   - Enable leaked password detection
   - Configure password strength requirements

2. **Implement Site Assignment**
   - Add `assigned_site` column to profiles table
   - Update staff RLS policies to filter by assigned site
   - This will restrict staff to only see orders for their site

3. **Audit Logging**
   - Monitor timeline entries for suspicious activity
   - Review file access patterns
   - Track failed authentication attempts

## Performance Optimization

### Implemented Optimizations

1. **PWA Caching**
   - Service worker caches static assets
   - NetworkFirst strategy for Supabase API
   - 24-hour cache expiration

2. **Real-time Efficiency**
   - Targeted subscriptions per order/channel
   - Automatic cleanup on component unmount
   - Presence tracking with deduplication

3. **Database Performance**
   - Indexes on frequently queried fields
   - Optimized RLS policies with EXISTS
   - Proper order_number sequencing

### Recommended Monitoring

1. **Database Metrics**
   - Query performance (check slow queries)
   - Connection pool utilization
   - Storage usage trends

2. **Application Metrics**
   - Page load times
   - API response times
   - Error rates
   - Real-time connection stability

## Deployment Steps

### 1. Pre-deployment Verification

```bash
# Run type checking
npm run type-check

# Build for production
npm run build

# Test build locally
npm run preview
```

### 2. Database Migration

All migrations are already applied. Verify in Supabase dashboard:
- Check table structures
- Verify RLS policies
- Test with different user roles

### 3. Environment Variables

Ensure these are configured:
- Supabase URL
- Supabase Anon Key
- (Service Role Key for admin operations - if needed)

### 4. PWA Configuration

Verify manifest.json settings in `vite.config.ts`:
- App name and description
- Icons (192x192 and 512x512)
- Theme colors match design system
- Start URL and scope configured

### 5. Post-deployment Testing

Test these critical workflows:
1. User authentication (login/logout)
2. Create new order (as manager/admin)
3. Progress order through all stages
4. File upload and download
5. Real-time updates (open same order in two tabs)
6. Push notifications (after granting permission)
7. Analytics dashboard
8. Data export
9. Mobile PWA installation

## Troubleshooting

### Common Issues

1. **Cannot see orders after login**
   - Check user role in profiles table
   - Verify RLS policies are active
   - Ensure user is authenticated

2. **File upload fails**
   - Check user role (must be manager or admin)
   - Verify storage bucket permissions
   - Check file size limits

3. **Real-time updates not working**
   - Verify realtime is enabled on orders table
   - Check browser console for subscription errors
   - Ensure proper cleanup in useEffect

4. **Push notifications not appearing**
   - Request notification permission
   - Check browser notification settings
   - Verify service worker is active

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review error logs in Supabase
   - Check database performance metrics
   - Monitor storage usage

2. **Monthly**
   - Review and optimize slow queries
   - Clean up old files if needed
   - Update dependencies

3. **Quarterly**
   - Security audit
   - Performance optimization review
   - User feedback incorporation

## Support

For issues or questions:
1. Check Supabase logs: [Dashboard](https://supabase.com/dashboard/project/cqyqjjhfwfydgusavlng)
2. Review console errors in browser DevTools
3. Check network requests for API errors
4. Verify database state in SQL editor

## Next Steps for Enhancement

1. **Site Assignment Implementation**
   - Add site field to profiles
   - Update staff RLS to filter by site
   - Add site management UI for admins

2. **Advanced Analytics**
   - Performance metrics per site
   - Time tracking for each stage
   - Customer satisfaction tracking

3. **Notifications Enhancement**
   - Email notifications for critical updates
   - SMS notifications (optional)
   - Configurable notification rules

4. **Offline Mode Enhancement**
   - Queue order updates offline
   - Sync when connection restored
   - Conflict resolution UI
