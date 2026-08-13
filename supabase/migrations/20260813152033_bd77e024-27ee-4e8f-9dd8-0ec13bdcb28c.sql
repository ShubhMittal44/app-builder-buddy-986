-- 1. Stands master
CREATE TABLE public.stands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stand_number text NOT NULL,
  stand_number_norm text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX stands_number_norm_uidx ON public.stands (stand_number_norm);

GRANT SELECT ON public.stands TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.stands TO authenticated;
GRANT ALL ON public.stands TO service_role;

ALTER TABLE public.stands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stands_select_authenticated" ON public.stands
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "stands_insert_admin" ON public.stands
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "stands_update_admin" ON public.stands
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "stands_delete_admin" ON public.stands
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_stand_number_norm()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.stand_number_norm := lower(regexp_replace(trim(NEW.stand_number), '\s+', '', 'g'));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_stands_norm BEFORE INSERT OR UPDATE ON public.stands
FOR EACH ROW EXECUTE FUNCTION public.set_stand_number_norm();

-- 2. Stand-wise quantities per inventory (glass stock item)
CREATE TABLE public.inventory_stand_quantities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES public.glass_stock_items(id) ON DELETE CASCADE,
  stand_id uuid NOT NULL REFERENCES public.stands(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventory_id, stand_id)
);
CREATE INDEX inventory_stand_quantities_inventory_idx ON public.inventory_stand_quantities (inventory_id);

GRANT SELECT ON public.inventory_stand_quantities TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.inventory_stand_quantities TO authenticated;
GRANT ALL ON public.inventory_stand_quantities TO service_role;

ALTER TABLE public.inventory_stand_quantities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "isq_select_authenticated" ON public.inventory_stand_quantities
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "isq_insert_admin" ON public.inventory_stand_quantities
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "isq_update_admin" ON public.inventory_stand_quantities
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "isq_delete_admin" ON public.inventory_stand_quantities
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

CREATE TRIGGER trg_isq_updated_at BEFORE UPDATE ON public.inventory_stand_quantities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Extend inventory activity log with stand-aware fields
ALTER TABLE public.inventory_activity_log
  ADD COLUMN IF NOT EXISTS stand_id uuid REFERENCES public.stands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stand_number text,
  ADD COLUMN IF NOT EXISTS previous_total_quantity integer,
  ADD COLUMN IF NOT EXISTS new_total_quantity integer,
  ADD COLUMN IF NOT EXISTS previous_stand_quantity integer,
  ADD COLUMN IF NOT EXISTS new_stand_quantity integer;