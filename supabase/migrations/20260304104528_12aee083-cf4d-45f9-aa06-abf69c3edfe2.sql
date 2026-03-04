
-- 1) Create clients table (shared across all 3 daybook tabs)
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  client_name text NOT NULL,
  client_name_norm text NOT NULL UNIQUE,
  notes text
);

-- Trigger for updated_at
CREATE TRIGGER set_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-compute client_name_norm
CREATE OR REPLACE FUNCTION public.set_client_name_norm()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.client_name_norm := lower(trim(NEW.client_name));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_client_name_norm
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_client_name_norm();

-- RLS on clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY admin_select_clients ON public.clients FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY admin_insert_clients ON public.clients FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_update_clients ON public.clients FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_delete_clients ON public.clients FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- 2) daybook_entries
CREATE TABLE public.daybook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  entry_date date NOT NULL DEFAULT current_date,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  challan_number text NOT NULL,
  total_amount numeric(12,2),
  advance_amount numeric(12,2),
  notes text
);

CREATE INDEX idx_daybook_entries_entry_date ON public.daybook_entries(entry_date);
CREATE INDEX idx_daybook_entries_client_id ON public.daybook_entries(client_id);
CREATE INDEX idx_daybook_entries_challan ON public.daybook_entries(lower(challan_number));

CREATE TRIGGER set_daybook_entries_updated_at
  BEFORE UPDATE ON public.daybook_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.daybook_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_select_daybook ON public.daybook_entries FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY admin_insert_daybook ON public.daybook_entries FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_update_daybook ON public.daybook_entries FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_delete_daybook ON public.daybook_entries FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- 3) toughened_diary_entries
CREATE TABLE public.toughened_diary_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  entry_date date NOT NULL DEFAULT current_date,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  challan_number text NOT NULL,
  total_amount numeric(12,2),
  advance_amount numeric(12,2),
  notes text
);

CREATE INDEX idx_toughened_entries_entry_date ON public.toughened_diary_entries(entry_date);
CREATE INDEX idx_toughened_entries_client_id ON public.toughened_diary_entries(client_id);
CREATE INDEX idx_toughened_entries_challan ON public.toughened_diary_entries(lower(challan_number));

CREATE TRIGGER set_toughened_entries_updated_at
  BEFORE UPDATE ON public.toughened_diary_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.toughened_diary_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_select_toughened ON public.toughened_diary_entries FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY admin_insert_toughened ON public.toughened_diary_entries FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_update_toughened ON public.toughened_diary_entries FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_delete_toughened ON public.toughened_diary_entries FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- 4) rama_entries
CREATE TABLE public.rama_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  entry_date date NOT NULL DEFAULT current_date,
  client_id uuid NOT NULL REFERENCES public.clients(id),
  challan_number text NOT NULL,
  total_amount numeric(12,2),
  advance_amount numeric(12,2),
  notes text
);

CREATE INDEX idx_rama_entries_entry_date ON public.rama_entries(entry_date);
CREATE INDEX idx_rama_entries_client_id ON public.rama_entries(client_id);
CREATE INDEX idx_rama_entries_challan ON public.rama_entries(lower(challan_number));

CREATE TRIGGER set_rama_entries_updated_at
  BEFORE UPDATE ON public.rama_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.rama_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_select_rama ON public.rama_entries FOR SELECT TO authenticated USING (is_admin(auth.uid()));
CREATE POLICY admin_insert_rama ON public.rama_entries FOR INSERT TO authenticated WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_update_rama ON public.rama_entries FOR UPDATE TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));
CREATE POLICY admin_delete_rama ON public.rama_entries FOR DELETE TO authenticated USING (is_admin(auth.uid()));
