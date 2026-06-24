-- Make order->customer/ledger sync run with definer rights so non-admin
-- order creators don't get blocked by the admin-only RLS on customers/ledger.

CREATE OR REPLACE FUNCTION public.order_resolve_customer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.order_sync_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale numeric(12,2);
  v_received numeric(12,2);
BEGIN
  v_sale := coalesce(NEW.total_amount, 0) + coalesce(NEW.freight_amount, 0);
  v_received := coalesce(NEW.advance_amount, 0);

  IF NEW.customer_id IS NOT NULL THEN
    UPDATE public.customer_ledger_entries
      SET customer_id = NEW.customer_id
      WHERE order_id = NEW.id AND source = 'order' AND customer_id <> NEW.customer_id;
  END IF;

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

CREATE OR REPLACE FUNCTION public.order_delete_ledger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.customer_ledger_entries WHERE order_id = OLD.id AND source = 'order';
  RETURN OLD;
END;
$$;

-- These are trigger-only functions; prevent direct API execution.
REVOKE ALL ON FUNCTION public.order_resolve_customer() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_sync_ledger() FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_delete_ledger() FROM public, anon, authenticated;