
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE public.user_module_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  module_key text NOT NULL CHECK (module_key IN ('orders','inventory','daybook','customer_ledger')),
  can_view boolean NOT NULL DEFAULT false,
  can_add boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (user_id, module_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_module_permissions TO authenticated;
GRANT ALL ON public.user_module_permissions TO service_role;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ump_select ON public.user_module_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY ump_insert ON public.user_module_permissions FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY ump_update ON public.user_module_permissions FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY ump_delete ON public.user_module_permissions FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- keep view consistent with add/edit
CREATE OR REPLACE FUNCTION public.ump_normalize() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.can_add OR NEW.can_edit THEN NEW.can_view := true; END IF;
  NEW.updated_at := now();
  NEW.updated_by := coalesce(auth.uid(), NEW.updated_by);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ump_normalize BEFORE INSERT OR UPDATE ON public.user_module_permissions FOR EACH ROW EXECUTE FUNCTION public.ump_normalize();

CREATE TABLE public.user_admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid,
  target_email text,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.user_admin_audit_log TO authenticated;
GRANT ALL ON public.user_admin_audit_log TO service_role;
ALTER TABLE public.user_admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY uaal_select ON public.user_admin_audit_log FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.audit_ump() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_admin_audit_log (target_user_id, target_email, action, old_value, new_value, changed_by)
  VALUES (coalesce(NEW.user_id, OLD.user_id),
          (SELECT email FROM public.profiles WHERE user_id = coalesce(NEW.user_id, OLD.user_id)),
          'permission_update',
          CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object('module',OLD.module_key,'view',OLD.can_view,'add',OLD.can_add,'edit',OLD.can_edit) END,
          CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object('module',NEW.module_key,'view',NEW.can_view,'add',NEW.can_add,'edit',NEW.can_edit) END,
          auth.uid());
  RETURN coalesce(NEW, OLD);
END $$;
CREATE TRIGGER trg_audit_ump AFTER INSERT OR UPDATE OR DELETE ON public.user_module_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_ump();

CREATE OR REPLACE FUNCTION public.audit_profile_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    INSERT INTO public.user_admin_audit_log (target_user_id, target_email, action, old_value, new_value, changed_by)
    VALUES (NEW.user_id, NEW.email, 'role_change', jsonb_build_object('role',OLD.role), jsonb_build_object('role',NEW.role), auth.uid());
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    INSERT INTO public.user_admin_audit_log (target_user_id, target_email, action, old_value, new_value, changed_by)
    VALUES (NEW.user_id, NEW.email, CASE WHEN NEW.is_active THEN 'account_reactivated' ELSE 'account_deactivated' END,
            jsonb_build_object('is_active',OLD.is_active), jsonb_build_object('is_active',NEW.is_active), auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_audit_profiles AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.audit_profile_changes();

-- authoritative permission check
CREATE OR REPLACE FUNCTION public.has_module_perm(_user_id uuid, _module text, _action text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = 'admin' AND is_active) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_module_permissions p
      JOIN public.profiles pr ON pr.user_id = p.user_id AND pr.is_active
      WHERE p.user_id = _user_id AND p.module_key = _module
        AND CASE _action WHEN 'view' THEN p.can_view WHEN 'add' THEN p.can_add WHEN 'edit' THEN p.can_edit ELSE false END)
  END
$$;
REVOKE EXECUTE ON FUNCTION public.has_module_perm(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_perm(uuid, text, text) TO authenticated, service_role;

-- deactivated admins lose admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _user_id AND role = 'admin' AND is_active);
$$;

-- seed existing manager/staff with current access
INSERT INTO public.user_module_permissions (user_id, module_key, can_view, can_add, can_edit)
SELECT user_id, 'orders', true, true, true FROM public.profiles WHERE role IN ('manager','staff')
ON CONFLICT DO NOTHING;
INSERT INTO public.user_module_permissions (user_id, module_key, can_view, can_add, can_edit)
SELECT user_id, 'inventory', true, false, false FROM public.profiles WHERE role IN ('manager','staff')
ON CONFLICT DO NOTHING;

-- ===== ORDERS =====
DROP POLICY IF EXISTS staff_select_orders ON public.orders;
DROP POLICY IF EXISTS staff_insert_orders ON public.orders;
DROP POLICY IF EXISTS staff_update_orders ON public.orders;
DROP POLICY IF EXISTS admin_only_delete_orders ON public.orders;
CREATE POLICY perm_select_orders ON public.orders FOR SELECT TO authenticated USING (public.has_module_perm(auth.uid(),'orders','view'));
CREATE POLICY perm_insert_orders ON public.orders FOR INSERT TO authenticated WITH CHECK (public.has_module_perm(auth.uid(),'orders','add'));
CREATE POLICY perm_update_orders ON public.orders FOR UPDATE TO authenticated USING (public.has_module_perm(auth.uid(),'orders','edit')) WITH CHECK (public.has_module_perm(auth.uid(),'orders','edit'));
CREATE POLICY admin_delete_orders ON public.orders FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS staff_select_order_files ON storage.objects;
DROP POLICY IF EXISTS staff_insert_order_files ON storage.objects;
DROP POLICY IF EXISTS staff_update_order_files ON storage.objects;
CREATE POLICY perm_select_order_files ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'sizes_chalan' AND public.has_module_perm(auth.uid(),'orders','view'));
CREATE POLICY perm_insert_order_files ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'sizes_chalan' AND (public.has_module_perm(auth.uid(),'orders','add') OR public.has_module_perm(auth.uid(),'orders','edit')));
CREATE POLICY perm_update_order_files ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'sizes_chalan' AND public.has_module_perm(auth.uid(),'orders','edit')) WITH CHECK (bucket_id = 'sizes_chalan' AND public.has_module_perm(auth.uid(),'orders','edit'));

-- ===== generic helper to rebuild module policies =====
DO $$
DECLARE r record; pol record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('glass_types','inventory'),('glass_variants','inventory'),('glass_stock_items','inventory'),
    ('inventory_activity_log','inventory'),('stands','inventory'),('inventory_stand_quantities','inventory'),
    ('daybook_entries','daybook'),('rama_entries','daybook'),('toughened_diary_entries','daybook'),('clients','daybook'),
    ('customers','customer_ledger'),('customer_ledger_entries','customer_ledger')
  ) AS t(tbl, mod) LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=r.tbl LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol.policyname, r.tbl);
    END LOOP;
    EXECUTE format('CREATE POLICY perm_select ON public.%I FOR SELECT TO authenticated USING (public.has_module_perm(auth.uid(), %L, ''view''))', r.tbl, r.mod);
    -- add OR edit may create supporting rows (logs, stand breakups, variants) in inventory; other modules: add only
    IF r.mod = 'inventory' THEN
      EXECUTE format('CREATE POLICY perm_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_module_perm(auth.uid(), %L, ''add'') OR public.has_module_perm(auth.uid(), %L, ''edit''))', r.tbl, r.mod, r.mod);
    ELSIF r.tbl = 'clients' THEN
      EXECUTE format('CREATE POLICY perm_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_module_perm(auth.uid(), %L, ''add'') OR public.has_module_perm(auth.uid(), %L, ''edit''))', r.tbl, r.mod, r.mod);
    ELSE
      EXECUTE format('CREATE POLICY perm_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.has_module_perm(auth.uid(), %L, ''add''))', r.tbl, r.mod);
    END IF;
    IF r.tbl = 'inventory_activity_log' THEN
      EXECUTE format('CREATE POLICY perm_update ON public.%I FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))', r.tbl);
    ELSE
      EXECUTE format('CREATE POLICY perm_update ON public.%I FOR UPDATE TO authenticated USING (public.has_module_perm(auth.uid(), %L, ''edit'')) WITH CHECK (public.has_module_perm(auth.uid(), %L, ''edit''))', r.tbl, r.mod, r.mod);
    END IF;
    EXECUTE format('CREATE POLICY admin_delete ON public.%I FOR DELETE TO authenticated USING (public.is_admin(auth.uid()))', r.tbl);
  END LOOP;
END $$;
