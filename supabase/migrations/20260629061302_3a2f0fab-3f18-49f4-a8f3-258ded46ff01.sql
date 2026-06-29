DROP POLICY IF EXISTS admins_select_order_files ON storage.objects;
DROP POLICY IF EXISTS admins_insert_order_files ON storage.objects;
DROP POLICY IF EXISTS admins_update_order_files ON storage.objects;
-- Keep admins_delete_order_files unchanged (file deletion stays admin-only).

CREATE POLICY staff_select_order_files ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'sizes_chalan' AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'staff')
    )
  );

CREATE POLICY staff_insert_order_files ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'sizes_chalan' AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'staff')
    )
  );

CREATE POLICY staff_update_order_files ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'sizes_chalan' AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'staff')
    )
  )
  WITH CHECK (
    bucket_id = 'sizes_chalan' AND (
      public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'manager')
      OR public.has_role(auth.uid(), 'staff')
    )
  );