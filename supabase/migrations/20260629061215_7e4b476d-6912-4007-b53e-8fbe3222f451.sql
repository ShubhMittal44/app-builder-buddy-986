-- Allow Admin, Manager, and Staff to read, create, and update orders.
-- Delete remains Admin-only.

DROP POLICY IF EXISTS admins_select_orders ON public.orders;
DROP POLICY IF EXISTS admins_insert_orders ON public.orders;
DROP POLICY IF EXISTS admins_update_orders ON public.orders;
-- Keep admin_only_delete_orders unchanged.

CREATE POLICY staff_select_orders ON public.orders
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY staff_insert_orders ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'staff')
  );

CREATE POLICY staff_update_orders ON public.orders
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'staff')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
    OR public.has_role(auth.uid(), 'staff')
  );