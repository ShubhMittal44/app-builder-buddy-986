# RGH Order Management - Testing Guide

## Testing Checklist

### Authentication & Authorization ✅

#### Login Flow
- [ ] User can login with valid credentials
- [ ] Invalid credentials show error message
- [ ] Password reset email is sent
- [ ] Session persists across page reloads
- [ ] Logout works correctly

#### Role-Based Access
- [ ] **Admin**: Can access all features and admin panel
- [ ] **Manager**: Can create orders, upload files, see all orders
- [ ] **Staff**: Can view orders, update specific stages, read-only files
- [ ] Non-authenticated users are redirected to login

### Order Management ✅

#### Create Order (Manager/Admin only)
- [ ] Form validation works (customer name required)
- [ ] Balance calculates correctly: `Total - Advance + Freight`
- [ ] Order number is auto-generated (10 digits)
- [ ] Order date defaults to today
- [ ] Can upload files during creation
- [ ] Timeline entry created on order creation
- [ ] Redirects to order workspace after creation

#### View Orders
- [ ] Orders table loads all orders (for manager/admin)
- [ ] Search works across: order number, customer name, city, address, phone
- [ ] Stage filter shows correct orders
- [ ] Date range filter works correctly
- [ ] Column sorting works for all columns
- [ ] Balance displays correctly for each order
- [ ] Real-time updates appear when another user changes an order

#### Order Workspace
- [ ] Order details load correctly
- [ ] Can edit order information and save
- [ ] Balance updates in real-time when amounts change
- [ ] Stage stepper shows current stage
- [ ] Stage transition buttons show/hide based on validation

#### Stage Progression
Test each stage transition with required validations:

1. **Intake → Assign Site**
   - [ ] Button is always enabled
   - [ ] Moves to assign_site stage successfully

2. **Assign Site → Processing**
   - [ ] Button disabled until assign_site is selected
   - [ ] Shows validation error if clicked without selection
   - [ ] Moves to processing stage when valid

3. **Processing → Dispatch**
   - [ ] Button disabled until processing_site is selected
   - [ ] Shows validation error if clicked without selection
   - [ ] Moves to dispatch stage when valid

4. **Dispatch → Fitting**
   - [ ] Button disabled until at least one file is uploaded
   - [ ] Shows validation error if no files present
   - [ ] Moves to fitting stage when files exist

5. **Fitting → Closed**
   - [ ] Shows confirmation dialog before closing
   - [ ] Moves to closed stage on confirmation
   - [ ] No further actions available in closed stage

#### Timeline
- [ ] Shows all stage transitions
- [ ] Displays user who made each change
- [ ] Shows correct timestamps
- [ ] Updates in real-time for all viewers

### File Management ✅

#### File Upload (Manager/Admin only)
- [ ] Can drag and drop files
- [ ] Can click to select files
- [ ] Multiple files can be uploaded
- [ ] Upload progress is displayed
- [ ] Success message shows after upload
- [ ] Files appear in order workspace immediately
- [ ] File metadata stored in database correctly

#### File Access
- [ ] Uploaded files display with correct names
- [ ] Can download files successfully
- [ ] Downloaded file matches uploaded file
- [ ] **Manager/Admin**: Can delete files
- [ ] **Staff**: Cannot delete files (read-only)
- [ ] Real-time updates show new files to all users

#### File Validation
- [ ] Cannot progress to Dispatch stage without files
- [ ] Validation error shows clear message
- [ ] Uploading files enables stage progression

### Real-time Features ✅

#### Live Updates
- [ ] Open same order in two browser windows
- [ ] Edit in one window, changes appear in other
- [ ] Timeline updates appear immediately
- [ ] Stage changes sync across all viewers
- [ ] File uploads appear in all open windows

#### User Presence
- [ ] Online users appear in header/sidebar
- [ ] User goes offline when tab closed
- [ ] Presence works on specific order pages
- [ ] Multiple users shown correctly

### Push Notifications ✅

#### Notification Permissions
- [ ] Can request notification permission
- [ ] Permission modal appears correctly
- [ ] Notification settings persisted

#### Notifications
- [ ] Notification appears on order stage change
- [ ] Notification shows order number and customer
- [ ] Clicking notification focuses window
- [ ] Notification auto-dismisses after 5 seconds
- [ ] Works on desktop browsers
- [ ] Works on mobile PWA

### Analytics Dashboard ✅

#### Financial Metrics
- [ ] Total revenue calculates correctly
- [ ] Total advances sum correctly
- [ ] Total freight calculates correctly
- [ ] Outstanding balance is accurate: `Total - Advance + Freight`

#### Stage Distribution
- [ ] Shows count for each stage
- [ ] Chart displays correctly
- [ ] Percentages add up to 100%

#### Time-Based Analysis
- [ ] Orders this week count is accurate
- [ ] Orders this month count is accurate
- [ ] Filters work correctly

#### Top Customers
- [ ] Lists customers by order count
- [ ] Shows correct numbers
- [ ] Limited to top 5

#### City Distribution
- [ ] Shows orders per city
- [ ] Calculates percentages correctly

### Data Export ✅

#### CSV Export
- [ ] Export button downloads file
- [ ] CSV contains all visible orders
- [ ] Headers are correct
- [ ] Data formats correctly (dates, numbers)
- [ ] File opens in Excel/spreadsheet apps

### PWA Functionality ✅

#### Installation
- [ ] Install prompt appears (desktop Chrome/Edge)
- [ ] Can install from menu (mobile browsers)
- [ ] App icon appears on home screen/desktop
- [ ] App launches in standalone mode

#### Offline Capability
- [ ] App loads when offline (after first visit)
- [ ] Shows offline indicator when disconnected
- [ ] Previously viewed data accessible offline
- [ ] Reconnects automatically when online

#### Performance
- [ ] First load under 3 seconds
- [ ] Navigation between pages is instant
- [ ] Images load efficiently
- [ ] No layout shift during load

### Mobile Responsiveness ✅

#### Layout
- [ ] Orders table scrolls horizontally on mobile
- [ ] Forms use single column on mobile
- [ ] Navigation collapses to menu on mobile
- [ ] Touch targets are at least 44px
- [ ] Text is readable without zooming

#### Interactions
- [ ] Can tap to select dropdowns
- [ ] File upload works on mobile
- [ ] Date picker is mobile-friendly
- [ ] Stepper works on small screens

### Error Handling ✅

#### Network Errors
- [ ] Shows error toast on API failure
- [ ] Can retry failed operations
- [ ] Error messages are user-friendly
- [ ] App doesn't crash on network errors

#### Validation Errors
- [ ] Form validation shows clear messages
- [ ] Stage transition errors are descriptive
- [ ] Required field indicators work

#### Edge Cases
- [ ] Handles missing data gracefully
- [ ] Works with very long customer names
- [ ] Handles large file uploads
- [ ] Works with many orders (100+)

### Security Testing ✅

#### Authentication
- [ ] Cannot access app without login
- [ ] Session expires appropriately
- [ ] Cannot bypass login with direct URLs

#### Authorization
- [ ] **Staff** cannot create orders
- [ ] **Staff** cannot delete files
- [ ] **Staff** cannot access admin panel
- [ ] Users cannot change their own role
- [ ] Users can only see their own profile

#### Data Protection
- [ ] Customer PII not exposed to unauthorized users
- [ ] File URLs are authenticated
- [ ] No sensitive data in browser console
- [ ] RLS policies prevent unauthorized access

## Performance Benchmarks

### Target Metrics
- First Contentful Paint: < 1.5s
- Time to Interactive: < 3.0s
- Largest Contentful Paint: < 2.5s
- Cumulative Layout Shift: < 0.1
- First Input Delay: < 100ms

### Database Performance
- Orders list query: < 200ms
- Single order query: < 100ms
- Order creation: < 500ms
- File upload: < 2s per MB

## Browser Compatibility

Test on these browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Mobile Safari (iOS)
- [ ] Chrome Mobile (Android)

## Test Users

Create these test users in Supabase:

1. **Admin User**
   - Email: admin@ramaglass.com
   - Role: admin

2. **Manager User**
   - Email: manager@ramaglass.com
   - Role: manager

3. **Staff User**
   - Email: staff@ramaglass.com
   - Role: staff

## Automated Testing (Future)

Recommended testing framework setup:

```typescript
// Example: Order creation test
describe('Order Creation', () => {
  it('creates order with valid data', async () => {
    // Login as manager
    // Navigate to /new
    // Fill form
    // Submit
    // Verify redirect to workspace
    // Verify order appears in database
  });

  it('prevents staff from creating orders', async () => {
    // Login as staff
    // Navigate to /new
    // Verify access denied or button disabled
  });
});
```

## Reporting Issues

When reporting issues, include:
1. User role (admin/manager/staff)
2. Browser and version
3. Steps to reproduce
4. Expected vs actual behavior
5. Screenshot or screen recording
6. Console errors (F12 → Console)
7. Network errors (F12 → Network)

## Success Criteria

Phase 8 is complete when:
- [ ] All security issues resolved
- [ ] All role-based access controls tested
- [ ] All order workflows function correctly
- [ ] File management works for all roles
- [ ] Real-time updates work reliably
- [ ] PWA installs and works offline
- [ ] Mobile experience is excellent
- [ ] Performance meets benchmarks
- [ ] No critical bugs remain
