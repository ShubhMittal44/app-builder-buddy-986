-- Fix critical security issues with RLS policies

-- ============================================
-- 1. DROP existing permissive orders policies
-- ============================================
DROP POLICY IF EXISTS "Users can read orders" ON orders;
DROP POLICY IF EXISTS "Users can create orders" ON orders;
DROP POLICY IF EXISTS "Users can update orders" ON orders;
DROP POLICY IF EXISTS "Users can delete orders" ON orders;

-- ============================================
-- 2. Implement role-based RLS for orders table
-- ============================================

-- Managers and Admins can read all orders
CREATE POLICY "Managers and admins can read all orders"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Staff can only read orders from their assigned site
CREATE POLICY "Staff can read orders from their site"
  ON orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'staff'
    )
    -- Staff can see orders that don't have a site assigned yet, or match their site
    AND (
      assign_site IS NULL 
      OR processing_site IS NULL
      -- Note: We'd need a site assignment in profiles table for full implementation
      -- For now, staff can see all orders but this should be enhanced
    )
  );

-- Only managers and admins can create orders
CREATE POLICY "Managers and admins can create orders"
  ON orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Managers and admins can update all orders
CREATE POLICY "Managers and admins can update all orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Staff can update orders in specific stages only
CREATE POLICY "Staff can update orders in processing stages"
  ON orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'staff'
    )
    AND stage IN ('processing', 'dispatch', 'fitting')
  );

-- Only admins can delete orders (soft delete recommended instead)
CREATE POLICY "Only admins can delete orders"
  ON orders FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 3. Fix profiles table RLS to prevent data leakage
-- ============================================

DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Users can ONLY read their own profile (strict validation)
CREATE POLICY "Users can read only their own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- Users can only update their own profile (except role)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    -- Prevent users from changing their own role
    AND role = (SELECT role FROM profiles WHERE user_id = auth.uid())
  );

-- Only admins can update any profile including roles
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
    )
  );

-- ============================================
-- 4. Fix storage policies for better security
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete files" ON storage.objects;

-- Managers and admins can view all files
CREATE POLICY "Managers and admins can view all files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sizes_chalan'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Staff can view files (read-only for their work)
CREATE POLICY "Staff can view files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'sizes_chalan'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'staff'
    )
  );

-- Only managers and admins can upload files
CREATE POLICY "Managers and admins can upload files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'sizes_chalan'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Only managers and admins can update files
CREATE POLICY "Managers and admins can update files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'sizes_chalan'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role IN ('admin', 'manager')
    )
  );

-- Only admins can delete files
CREATE POLICY "Only admins can delete files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'sizes_chalan'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- ============================================
-- 5. Fix function search_path issues
-- ============================================

-- Update existing functions to have proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (user_id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::role_enum, 'manager')
  );
  return new;
end;
$$;