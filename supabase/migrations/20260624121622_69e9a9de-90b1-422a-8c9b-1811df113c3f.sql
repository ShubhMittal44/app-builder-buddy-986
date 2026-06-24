-- =========================================================
-- 1) CUSTOMERS TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_name_norm text NOT NULL UNIQUE,
  phone text,
  address text,
  city text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view customers" ON public.customers
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert customers" ON public.customers
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update customers" ON public.customers
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete customers" ON public.customers
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- Normalize customer name + maintain updated_at
CREATE OR REPLACE FUNCTION public.set_customer_name_norm()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.customer_name_norm := lower(trim(NEW.customer_name));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customers_norm ON public.customers;
CREATE TRIGGER trg_customers_norm
  BEFORE INSERT OR UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_customer_name_norm();

-- =========================================================
-- 2) LEDGER ENTRIES TABLE
-- =========================================================
CREATE TABLE IF NOT EXISTS public.customer_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  entry_type text NOT NULL CHECK (entry_type IN ('Sale','Amount Received','Opening Balance','Adjustment')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_mode text,
  notes text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('order','manual')),
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_ledger_entries TO authenticated;
GRANT ALL ON public.customer_ledger_entries TO service_role;

ALTER TABLE public.customer_ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view ledger" ON public.customer_ledger_entries
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert ledger" ON public.customer_ledger_entries
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update ledger" ON public.customer_ledger_entries
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can delete ledger" ON public.customer_ledger_entries
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- updated_at maintenance for ledger entries
DROP TRIGGER IF EXISTS trg_ledger_updated_at ON public.customer_ledger_entries;
CREATE TRIGGER trg_ledger_updated_at
  BEFORE UPDATE ON public.customer_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ledger_customer ON public.customer_ledger_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_ledger_order ON public.customer_ledger_entries(order_id);
-- one order-sourced row per (order, type)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ledger_order_type
  ON public.customer_ledger_entries(order_id, entry_type)
  WHERE source = 'order';

-- =========================================================
-- 3) ORDERS -> CUSTOMER LINK
-- =========================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);

-- Resolve / create customer for an order (BEFORE INSERT OR UPDATE)
CREATE OR REPLACE FUNCTION public.order_resolve_customer()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_norm text;
  v_customer_id uuid;
BEGIN
  v_norm := lower(trim(coalesce(NEW.customer_name, '')));
  IF v_norm = '' THEN
    NEW.customer_id := NULL;
    RETURN NEW;
  END IF;

  SELECT id INTO v_customer_id FROM public.customers WHERE customer_name_norm = v_norm LIMIT 1;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (customer_name, phone, address, city)
    VALUES (trim(NEW.customer_name), NEW.phone, NEW.address, NEW.city)
    RETURNING id INTO v_customer_id;
  END IF;

  NEW.customer_id := v_customer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_resolve_customer ON public.orders;
CREATE TRIGGER trg_orders_resolve_customer
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_resolve_customer();

-- Sync ledger entries from an order (AFTER INSERT OR UPDATE)
CREATE OR REPLACE FUNCTION public.order_sync_ledger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_sale numeric(12,2);
  v_received numeric(12,2);
BEGIN
  v_sale := coalesce(NEW.total_amount, 0) + coalesce(NEW.freight_amount, 0);
  v_received := coalesce(NEW.advance_amount, 0);

  -- keep linked entries pointing at the right customer
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customer_ledger_entries
      SET customer_id = NEW.customer_id
      WHERE order_id = NEW.id AND source = 'order' AND customer_id <> NEW.customer_id;
  END IF;

  -- SALE
  IF NEW.customer_id IS NOT NULL AND v_sale > 0 THEN
    UPDATE public.customer_ledger_entries
      SET amount = v_sale, customer_id = NEW.customer_id, entry_date = NEW.order_date, updated_at = now()
      WHERE order_id = NEW.id AND source = 'order' AND entry_type = 'Sale';
    IF NOT FOUND THEN
      INSERT INTO public.customer_ledger_entries (customer_id, entry_date, entry_type, amount, source, order_id, notes)
      VALUES (NEW.customer_id, NEW.order_date, 'Sale', v_sale, 'order', NEW.id, 'Auto from order #' || NEW.order_number);
    END IF;
  ELSE
    DELETE FROM public.customer_ledger_entries WHERE order_id = NEW.id AND source = 'order' AND entry_type = 'Sale';
  END IF;

  -- AMOUNT RECEIVED
  IF NEW.customer_id IS NOT NULL AND v_received > 0 THEN
    UPDATE public.customer_ledger_entries
      SET amount = v_received, customer_id = NEW.customer_id, entry_date = NEW.order_date, updated_at = now()
      WHERE order_id = NEW.id AND source = 'order' AND entry_type = 'Amount Received';
    IF NOT FOUND THEN
      INSERT INTO public.customer_ledger_entries (customer_id, entry_date, entry_type, amount, source, order_id, notes)
      VALUES (NEW.customer_id, NEW.order_date, 'Amount Received', v_received, 'order', NEW.id, 'Advance from order #' || NEW.order_number);
    END IF;
  ELSE
    DELETE FROM public.customer_ledger_entries WHERE order_id = NEW.id AND source = 'order' AND entry_type = 'Amount Received';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_sync_ledger ON public.orders;
CREATE TRIGGER trg_orders_sync_ledger
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_sync_ledger();

-- Remove linked ledger entries when an order is deleted
CREATE OR REPLACE FUNCTION public.order_delete_ledger()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM public.customer_ledger_entries WHERE order_id = OLD.id AND source = 'order';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_delete_ledger ON public.orders;
CREATE TRIGGER trg_orders_delete_ledger
  BEFORE DELETE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_delete_ledger();

-- =========================================================
-- 4) BACKFILL (idempotent) — fire triggers on every existing order
-- =========================================================
UPDATE public.orders SET customer_name = customer_name WHERE customer_name IS NOT NULL AND trim(customer_name) <> '';