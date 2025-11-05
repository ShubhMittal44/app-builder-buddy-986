-- Fix profiles table RLS to prevent anonymous access
-- Drop any overly permissive policies and ensure only authenticated users can access

-- First, ensure we have a clear policy structure
DROP POLICY IF EXISTS "users_can_read_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "service_role_all_access" ON public.profiles;

-- Create a strict policy that requires authentication and limits to own profile
CREATE POLICY "authenticated_users_read_own_profile" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (user_id = auth.uid());

-- Keep the update policy but ensure it's for authenticated users only
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;

CREATE POLICY "authenticated_users_update_own_profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid() 
  AND role = (SELECT role FROM profiles WHERE user_id = auth.uid() LIMIT 1)
);

-- Service role needs full access for system operations
CREATE POLICY "service_role_full_access" 
ON public.profiles 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);