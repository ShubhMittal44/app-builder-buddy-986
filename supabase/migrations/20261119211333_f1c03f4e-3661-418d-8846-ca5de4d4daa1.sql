CREATE TABLE public.ledger_salespersons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL,
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ledger_salespersons TO authenticated;
GRANT ALL ON public.ledger_salespersons TO service_role;
ALTER TABLE public.ledger_salespersons ENABLE ROW LEVEL SECURITY;
CREATE POLICY ledger_salespersons_view ON public.ledger_salespersons FOR SELECT TO authenticated USING (public.has_module_perm(auth.uid(), 'customer_ledger', 'view'));
CREATE POLICY ledger_salespersons_add ON public.ledger_salespersons FOR INSERT TO authenticated WITH CHECK (public.has_module_perm(auth.uid(), 'customer_ledger', 'add'));
CREATE POLICY ledger_salespersons_edit ON public.ledger_salespersons FOR UPDATE TO authenticated USING (public.has_module_perm(auth.uid(), 'customer_ledger', 'edit')) WITH CHECK (public.has_module_perm(auth.uid(), 'customer_ledger', 'edit'));
CREATE POLICY ledger_salespersons_delete ON public.ledger_salespersons FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));
CREATE UNIQUE INDEX ledger_salespersons_name_unique ON public.ledger_salespersons (lower(btrim(name)));
CREATE FUNCTION public.normalize_ledger_salesperson() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.name := btrim(NEW.name);
 IF NEW.name = '' THEN RAISE EXCEPTION 'Salesperson name is required'; END IF;
 NEW.updated_at := now();
 RETURN NEW;
END; $$;
CREATE TRIGGER normalize_ledger_salesperson BEFORE INSERT OR UPDATE ON public.ledger_salespersons FOR EACH ROW EXECUTE FUNCTION public.normalize_ledger_salesperson();
ALTER TABLE public.customers ADD COLUMN assigned_salesperson_id uuid NULL REFERENCES public.ledger_salespersons(id) ON DELETE RESTRICT;
CREATE INDEX customers_assigned_salesperson_idx ON public.customers(assigned_salesperson_id);
CREATE FUNCTION public.validate_ledger_salesperson_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP = 'UPDATE' AND NEW.assigned_salesperson_id IS NOT DISTINCT FROM OLD.assigned_salesperson_id THEN RETURN NEW; END IF;
 IF NEW.assigned_salesperson_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ledger_salespersons WHERE id = NEW.assigned_salesperson_id AND is_active FOR SHARE) THEN
  RAISE EXCEPTION 'Choose an active salesperson';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_ledger_salesperson_assignment BEFORE INSERT OR UPDATE OF assigned_salesperson_id ON public.customers FOR EACH ROW EXECUTE FUNCTION public.validate_ledger_salesperson_assignment();
REVOKE EXECUTE ON FUNCTION public.normalize_ledger_salesperson() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_ledger_salesperson_assignment() FROM PUBLIC, anon, authenticated;