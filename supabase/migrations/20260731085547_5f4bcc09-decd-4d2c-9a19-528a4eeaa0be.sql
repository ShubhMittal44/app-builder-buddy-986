-- Glass types
DROP POLICY IF EXISTS "Admins manage glass_types" ON public.glass_types;
GRANT SELECT ON public.glass_types TO authenticated;
GRANT ALL ON public.glass_types TO service_role;
CREATE POLICY "staff_select_glass_types" ON public.glass_types FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin_insert_glass_types" ON public.glass_types FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin_update_glass_types" ON public.glass_types FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin_delete_glass_types" ON public.glass_types FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Glass variants
DROP POLICY IF EXISTS "Admins manage glass_variants" ON public.glass_variants;
GRANT SELECT ON public.glass_variants TO authenticated;
GRANT ALL ON public.glass_variants TO service_role;
CREATE POLICY "staff_select_glass_variants" ON public.glass_variants FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin_insert_glass_variants" ON public.glass_variants FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin_update_glass_variants" ON public.glass_variants FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin_delete_glass_variants" ON public.glass_variants FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Stock items
DROP POLICY IF EXISTS "Admins manage glass_stock_items" ON public.glass_stock_items;
GRANT SELECT ON public.glass_stock_items TO authenticated;
GRANT ALL ON public.glass_stock_items TO service_role;
CREATE POLICY "staff_select_glass_stock_items" ON public.glass_stock_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin_insert_glass_stock_items" ON public.glass_stock_items FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin_update_glass_stock_items" ON public.glass_stock_items FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin_delete_glass_stock_items" ON public.glass_stock_items FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Activity log (history)
DROP POLICY IF EXISTS "Admins manage inventory_activity_log" ON public.inventory_activity_log;
GRANT SELECT ON public.inventory_activity_log TO authenticated;
GRANT ALL ON public.inventory_activity_log TO service_role;
CREATE POLICY "staff_select_inventory_activity_log" ON public.inventory_activity_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "admin_insert_inventory_activity_log" ON public.inventory_activity_log FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin_update_inventory_activity_log" ON public.inventory_activity_log FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin_delete_inventory_activity_log" ON public.inventory_activity_log FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));