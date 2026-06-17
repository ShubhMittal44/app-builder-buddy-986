-- ============ glass_types ============
CREATE TABLE public.glass_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  glass_type_name text NOT NULL UNIQUE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.glass_types TO authenticated;
GRANT ALL ON public.glass_types TO service_role;

ALTER TABLE public.glass_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage glass_types" ON public.glass_types
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- ============ glass_variants ============
CREATE TABLE public.glass_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  glass_type_id uuid NOT NULL REFERENCES public.glass_types(id) ON DELETE CASCADE,
  thickness text NOT NULL,
  company_purchased text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.glass_variants TO authenticated;
GRANT ALL ON public.glass_variants TO service_role;

ALTER TABLE public.glass_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage glass_variants" ON public.glass_variants
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_glass_variants_type ON public.glass_variants(glass_type_id);

-- ============ glass_stock_items ============
CREATE TABLE public.glass_stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  glass_variant_id uuid NOT NULL REFERENCES public.glass_variants(id) ON DELETE CASCADE,
  length numeric(10,2) NOT NULL,
  breadth numeric(10,2) NOT NULL,
  unit text NOT NULL DEFAULT 'ft',
  number_of_sheets integer NOT NULL DEFAULT 0,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.glass_stock_items TO authenticated;
GRANT ALL ON public.glass_stock_items TO service_role;

ALTER TABLE public.glass_stock_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage glass_stock_items" ON public.glass_stock_items
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_glass_stock_items_variant ON public.glass_stock_items(glass_variant_id);

-- ============ inventory_activity_log ============
CREATE TABLE public.inventory_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  glass_type_id uuid REFERENCES public.glass_types(id) ON DELETE SET NULL,
  glass_variant_id uuid REFERENCES public.glass_variants(id) ON DELETE SET NULL,
  glass_stock_item_id uuid REFERENCES public.glass_stock_items(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  comment text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_activity_log TO authenticated;
GRANT ALL ON public.inventory_activity_log TO service_role;

ALTER TABLE public.inventory_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage inventory_activity_log" ON public.inventory_activity_log
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_inventory_log_changed_at ON public.inventory_activity_log(changed_at DESC);

-- ============ updated_at triggers ============
CREATE TRIGGER set_glass_types_updated_at BEFORE UPDATE ON public.glass_types
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_glass_variants_updated_at BEFORE UPDATE ON public.glass_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_glass_stock_items_updated_at BEFORE UPDATE ON public.glass_stock_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();