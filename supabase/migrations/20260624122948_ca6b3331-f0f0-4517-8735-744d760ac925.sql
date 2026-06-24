-- Allow admins to read all profiles (needed for User Management list)
CREATE POLICY "admins_read_all_profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Allow admins to update any profile (role / display name changes)
CREATE POLICY "admins_update_all_profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));