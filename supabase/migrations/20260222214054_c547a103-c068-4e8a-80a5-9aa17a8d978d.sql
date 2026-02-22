
-- ============================================
-- STAFF MANAGEMENT MODULE - DATABASE SCHEMA
-- ============================================

-- A) STAFF MEMBERS (master list)
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  staff_name text NOT NULL,
  monthly_salary numeric(12,2) NOT NULL,
  active boolean DEFAULT true,
  notes text
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_staff_members_updated_at
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- A) STAFF TRANSACTIONS
CREATE TABLE public.staff_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  staff_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  money_taken numeric(12,2) NOT NULL DEFAULT 0,
  notes text
);

ALTER TABLE public.staff_transactions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_staff_transactions_updated_at
  BEFORE UPDATE ON public.staff_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- B) VEHICLES (master list)
CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  vehicle_number text NOT NULL UNIQUE,
  vehicle_type text NOT NULL,
  active boolean DEFAULT true,
  notes text
);

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- B) VEHICLE TRANSACTIONS
CREATE TABLE public.vehicle_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  amount numeric(12,2) NOT NULL,
  reason text NOT NULL,
  notes text
);

ALTER TABLE public.vehicle_transactions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_vehicle_transactions_updated_at
  BEFORE UPDATE ON public.vehicle_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- C) OTHER ENTRIES
CREATE TABLE public.other_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  service text NOT NULL,
  amount numeric(12,2) NOT NULL,
  notes text
);

ALTER TABLE public.other_entries ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_other_entries_updated_at
  BEFORE UPDATE ON public.other_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================
-- RLS POLICIES - ADMIN ONLY ACCESS
-- ============================================

-- Staff Members policies
CREATE POLICY "admin_select_staff_members" ON public.staff_members
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_insert_staff_members" ON public.staff_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_update_staff_members" ON public.staff_members
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_delete_staff_members" ON public.staff_members
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Staff Transactions policies
CREATE POLICY "admin_select_staff_transactions" ON public.staff_transactions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_insert_staff_transactions" ON public.staff_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_update_staff_transactions" ON public.staff_transactions
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_delete_staff_transactions" ON public.staff_transactions
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Vehicles policies
CREATE POLICY "admin_select_vehicles" ON public.vehicles
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_insert_vehicles" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_update_vehicles" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_delete_vehicles" ON public.vehicles
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Vehicle Transactions policies
CREATE POLICY "admin_select_vehicle_transactions" ON public.vehicle_transactions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_insert_vehicle_transactions" ON public.vehicle_transactions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_update_vehicle_transactions" ON public.vehicle_transactions
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_delete_vehicle_transactions" ON public.vehicle_transactions
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Other Entries policies
CREATE POLICY "admin_select_other_entries" ON public.other_entries
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "admin_insert_other_entries" ON public.other_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_update_other_entries" ON public.other_entries
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admin_delete_other_entries" ON public.other_entries
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_staff_transactions_staff_id ON public.staff_transactions(staff_id);
CREATE INDEX idx_staff_transactions_entry_date ON public.staff_transactions(entry_date);
CREATE INDEX idx_vehicle_transactions_vehicle_id ON public.vehicle_transactions(vehicle_id);
CREATE INDEX idx_vehicle_transactions_entry_date ON public.vehicle_transactions(entry_date);
CREATE INDEX idx_other_entries_entry_date ON public.other_entries(entry_date);
