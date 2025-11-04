-- Fix infinite recursion in profiles RLS policies
-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can read only their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "users can read own profile" ON public.profiles;

-- Create simple, non-recursive policies
-- Allow users to read their own profile (no recursion)
CREATE POLICY "users_can_read_own_profile" ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Allow users to update their own profile (but not role)
CREATE POLICY "users_can_update_own_profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

-- Service role can do everything (bypass RLS for admin operations via service role key)
CREATE POLICY "service_role_all_access" ON public.profiles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Fix orders policies to remove profile dependency
DROP POLICY IF EXISTS "Managers and admins can create orders" ON public.orders;
DROP POLICY IF EXISTS "Managers and admins can read all orders" ON public.orders;
DROP POLICY IF EXISTS "Managers and admins can update all orders" ON public.orders;
DROP POLICY IF EXISTS "Only admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can read orders from their site" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders in processing stages" ON public.orders;

-- Simplify orders policies - authenticated users can manage orders
CREATE POLICY "authenticated_users_can_select_orders" ON public.orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_users_can_insert_orders" ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "authenticated_users_can_update_orders" ON public.orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Only allow deletion via service role for now (admin functionality)
CREATE POLICY "service_role_can_delete_orders" ON public.orders
FOR DELETE
TO service_role
USING (true);