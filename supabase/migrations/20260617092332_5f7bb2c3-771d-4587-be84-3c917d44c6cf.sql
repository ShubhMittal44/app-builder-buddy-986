-- 1. ORDERS: replace permissive "true" policies with admin-only access
DROP POLICY IF EXISTS "authenticated users can read orders" ON public.orders;
DROP POLICY IF EXISTS "authenticated users can insert orders" ON public.orders;
DROP POLICY IF EXISTS "authenticated users can update orders" ON public.orders;
DROP POLICY IF EXISTS "authenticated_users_can_select_orders" ON public.orders;
DROP POLICY IF EXISTS "authenticated_users_can_insert_orders" ON public.orders;
DROP POLICY IF EXISTS "authenticated_users_can_update_orders" ON public.orders;

CREATE POLICY "admins_select_orders" ON public.orders
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()));

CREATE POLICY "admins_insert_orders" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "admins_update_orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
-- admin_only_delete_orders already exists and remains in force

-- 2. STORAGE (sizes_chalan): remove broad/role policies, keep admin-only
DROP POLICY IF EXISTS "Authenticated users can update order files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload order files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view order files" ON storage.objects;
DROP POLICY IF EXISTS "Managers and admins can update files" ON storage.objects;
DROP POLICY IF EXISTS "Managers and admins can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Managers and admins can view all files" ON storage.objects;
DROP POLICY IF EXISTS "Staff can view files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete files" ON storage.objects;
DROP POLICY IF EXISTS "Only admins can delete order files" ON storage.objects;

CREATE POLICY "admins_select_order_files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'sizes_chalan' AND is_admin(auth.uid()));

CREATE POLICY "admins_insert_order_files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sizes_chalan' AND is_admin(auth.uid()));

CREATE POLICY "admins_update_order_files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'sizes_chalan' AND is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'sizes_chalan' AND is_admin(auth.uid()));

CREATE POLICY "admins_delete_order_files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'sizes_chalan' AND is_admin(auth.uid()));

-- 3. Harden new-user trigger: always lowest privilege, ignore client-supplied role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  insert into public.profiles (user_id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'staff'::role_enum
  );
  return new;
end;
$function$;

-- 4. Fix mutable search_path on helper function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$;

-- 5. Restrict SECURITY DEFINER helpers to signed-in users only (RLS still works)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, role_enum) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, role_enum) TO authenticated;