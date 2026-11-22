
CREATE TABLE public.inventory_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number bigint GENERATED ALWAYS AS IDENTITY,
  requested_by uuid NOT NULL,
  requester_role text NOT NULL,
  action_type text NOT NULL,
  summary text NOT NULL,
  operations jsonb NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  original_values jsonb,
  affected_stock_item_id uuid REFERENCES public.glass_stock_items(id) ON DELETE SET NULL,
  affected_stand_id uuid REFERENCES public.stands(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.inventory_change_requests TO authenticated;
GRANT ALL ON public.inventory_change_requests TO service_role;
ALTER TABLE public.inventory_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_or_admin_select ON public.inventory_change_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.is_admin(auth.uid()));
CREATE INDEX icr_status_idx ON public.inventory_change_requests(status, created_at DESC);
CREATE INDEX icr_requester_idx ON public.inventory_change_requests(requested_by, created_at DESC);
CREATE TRIGGER set_icr_updated_at BEFORE UPDATE ON public.inventory_change_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_change_requests;

ALTER TABLE public.inventory_activity_log
  ADD COLUMN IF NOT EXISTS change_request_id uuid REFERENCES public.inventory_change_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_by uuid;

-- Live inventory writes: Admin only (non-admins must use requests)
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['glass_types','glass_variants','glass_stock_items','inventory_stand_quantities','stands'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS perm_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS perm_update ON public.%I', t);
    EXECUTE format('CREATE POLICY admin_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()))', t);
    EXECUTE format('CREATE POLICY admin_update ON public.%I FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS perm_insert ON public.inventory_activity_log;
CREATE POLICY admin_insert ON public.inventory_activity_log FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._inv_norm(v text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT lower(regexp_replace(btrim(coalesce(v,'')), '\s+', '', 'g')) $$;

CREATE OR REPLACE FUNCTION public._inv_cols(tbl text) RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT CASE tbl
  WHEN 'glass_types' THEN ARRAY['glass_type_name','notes']
  WHEN 'glass_variants' THEN ARRAY['glass_type_id','thickness','company_purchased','color','notes']
  WHEN 'glass_stock_items' THEN ARRAY['glass_variant_id','length','breadth','unit','number_of_sheets','comment']
  WHEN 'stands' THEN ARRAY['stand_number','is_active','notes']
  ELSE NULL END $$;

CREATE OR REPLACE FUNCTION public._inv_resolve(vals jsonb, refs jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$ DECLARE k text; v jsonb; out jsonb := '{}'::jsonb; BEGIN
  IF vals IS NULL THEN RETURN NULL; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(vals) LOOP
    IF jsonb_typeof(v) = 'string' AND left(v #>> '{}', 5) = '$ref:' THEN
      IF NOT (refs ? substr(v #>> '{}', 6)) THEN RAISE EXCEPTION 'Invalid request reference'; END IF;
      out := out || jsonb_build_object(k, refs -> substr(v #>> '{}', 6));
    ELSE out := out || jsonb_build_object(k, v); END IF;
  END LOOP;
  RETURN out;
END $$;

-- Validates operations and returns the permissions they need
CREATE OR REPLACE FUNCTION public._inv_required_perms(ops jsonb) RETURNS text[] LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$ DECLARE op jsonb; kind text; perms text[] := ARRAY['view']; cols text[]; k text; BEGIN
  IF jsonb_typeof(ops) <> 'array' OR jsonb_array_length(ops) = 0 OR jsonb_array_length(ops) > 2000 THEN
    RAISE EXCEPTION 'Request must contain at least one change'; END IF;
  FOR op IN SELECT * FROM jsonb_array_elements(ops) LOOP
    kind := op->>'op';
    IF kind IN ('ensure','insert','update') THEN
      cols := public._inv_cols(op->>'table');
      IF cols IS NULL OR jsonb_typeof(op->'values') <> 'object' THEN RAISE EXCEPTION 'Invalid inventory change'; END IF;
      FOR k IN SELECT jsonb_object_keys(op->'values') LOOP
        IF NOT k = ANY(cols) THEN RAISE EXCEPTION 'Field % cannot be changed', k; END IF;
      END LOOP;
      IF kind = 'update' THEN
        IF op->>'id' IS NULL THEN RAISE EXCEPTION 'Invalid inventory change'; END IF;
        perms := perms || 'edit';
      ELSE perms := perms || 'add'; END IF;
    ELSIF kind = 'adjust' THEN
      IF coalesce((op->>'delta')::int, 0) = 0 THEN RAISE EXCEPTION 'Quantity must be a whole number above zero'; END IF;
      perms := perms || CASE WHEN (op->>'delta')::int > 0 THEN 'add' ELSE 'edit' END;
    ELSIF kind = 'transfer' THEN
      IF coalesce((op->>'quantity')::int, 0) <= 0 OR op->>'from_stand_id' = op->>'to_stand_id' THEN RAISE EXCEPTION 'Invalid stand transfer'; END IF;
      perms := perms || 'edit';
    ELSIF kind = 'set_stand_qty' THEN
      IF coalesce((op->>'quantity')::int, -1) < 0 THEN RAISE EXCEPTION 'Stand quantity cannot be negative'; END IF;
      perms := perms || 'edit';
    ELSE RAISE EXCEPTION 'Unsupported inventory change'; END IF;
  END LOOP;
  RETURN perms;
END $$;

CREATE OR REPLACE FUNCTION public._inv_log(entry jsonb, req_id uuid, requester uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN
  INSERT INTO public.inventory_activity_log (glass_type_id, glass_variant_id, glass_stock_item_id, action_type, old_value, new_value, comment,
    stand_id, stand_number, previous_total_quantity, new_total_quantity, previous_stand_quantity, new_stand_quantity,
    changed_by, change_request_id, requested_by)
  SELECT r.glass_type_id, r.glass_variant_id, r.glass_stock_item_id, r.action_type, r.old_value, r.new_value, r.comment,
    r.stand_id, r.stand_number, r.previous_total_quantity, r.new_total_quantity, r.previous_stand_quantity, r.new_stand_quantity,
    auth.uid(), req_id, requester
  FROM jsonb_populate_record(null::public.inventory_activity_log, entry) r;
END $$;

CREATE OR REPLACE FUNCTION public._inv_apply(req public.inventory_change_requests) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  op jsonb; kind text; tbl text; vals jsonb; refs jsonb := '{}'::jsonb; v_id uuid; cols text; wh text; m text;
  cur jsonb; k text; item public.glass_stock_items; qty int; delta int; from_q int; to_q int; v_type uuid;
  s_from text; s_to text; created boolean; logj jsonb;
BEGIN
  FOR op IN SELECT * FROM jsonb_array_elements(req.operations) LOOP
    kind := op->>'op'; tbl := op->>'table'; created := false;
    vals := public._inv_resolve(op->'values', refs);
    logj := public._inv_resolve(op->'log', refs);

    IF kind IN ('ensure','insert') THEN
      v_id := NULL;
      IF kind = 'ensure' THEN
        SELECT string_agg(CASE WHEN c IN ('length','breadth') THEN format('t.%1$I = r.%1$I', c)
                               ELSE format('public._inv_norm(t.%1$I::text) = public._inv_norm(r.%1$I::text)', c) END, ' AND ')
          INTO wh FROM jsonb_array_elements_text(op->'match') c;
        EXECUTE format('SELECT t.id FROM public.%I t, jsonb_populate_record(null::public.%I, $1) r WHERE %s LIMIT 1 FOR UPDATE OF t', tbl, tbl, wh)
          INTO v_id USING vals;
      END IF;
      IF v_id IS NULL THEN
        SELECT string_agg(quote_ident(c), ',') INTO cols FROM jsonb_object_keys(vals) c;
        EXECUTE format('INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(null::public.%I, $1) RETURNING id', tbl, cols, cols, tbl)
          INTO v_id USING vals;
        created := true;
      END IF;
      IF op->>'ref' IS NOT NULL THEN refs := refs || jsonb_build_object(op->>'ref', v_id); END IF;
      IF logj IS NOT NULL AND (created OR kind = 'insert') THEN
        IF tbl = 'glass_types' THEN logj := logj || jsonb_build_object('glass_type_id', v_id);
        ELSIF tbl = 'glass_variants' THEN logj := logj || jsonb_build_object('glass_variant_id', v_id);
        ELSIF tbl = 'glass_stock_items' THEN logj := logj || jsonb_build_object('glass_stock_item_id', v_id);
        ELSIF tbl = 'stands' THEN logj := logj || jsonb_build_object('stand_id', v_id); END IF;
        PERFORM public._inv_log(logj || jsonb_build_object('new_value', vals), req.id, req.requested_by);
      END IF;

    ELSIF kind = 'update' THEN
      v_id := (public._inv_resolve(jsonb_build_object('id', op->'id'), refs)->>'id')::uuid;
      EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1 FOR UPDATE', tbl) INTO cur USING v_id;
      IF cur IS NULL THEN RAISE EXCEPTION 'Cannot approve: the inventory record in this request no longer exists.'; END IF;
      IF op->'expected' IS NOT NULL THEN
        FOR k IN SELECT jsonb_object_keys(op->'expected') LOOP
          IF (cur->k) IS DISTINCT FROM (op->'expected'->k) AND NOT ((cur->k) = 'null'::jsonb AND op->'expected'->k IS NULL) THEN
            RAISE EXCEPTION 'Cannot approve: this record was changed after the request was submitped. Field "%" is now "%" but the request expected "%". Reject it and ask for a new request.',
              k, coalesce(cur->>k, '-'), coalesce(op->'expected'->>k, '-');
          END IF;
        END LOOP;
      END IF;
      SELECT string_agg(quote_ident(c), ',') INTO cols FROM jsonb_object_keys(vals) c;
      EXECUTE format('UPDATE public.%I SET (%s) = (SELECT %s FROM jsonb_populate_record(null::public.%I, $1)) WHERE id = $2', tbl, cols, cols, tbl)
        USING vals, v_id;
      IF tbl = 'glass_stock_items' AND EXISTS (SELECT 1 FROM public.glass_stock_items WHERE id = v_id AND number_of_sheets < 0) THEN
        RAISE EXCEPTION 'Cannot approve: stock cannot become negative.'; END IF;
      IF logj IS NOT NULL THEN PERFORM public._inv_log(logj || jsonb_build_object('old_value', cur, 'new_value', vals), req.id, req.requested_by); END IF;

    ELSIF kind = 'adjust' THEN
      delta := (op->>'delta')::int;
      SELECT * INTO item FROM public.glass_stock_items WHERE id = (public._inv_resolve(jsonb_build_object('x', op->'item_id'), refs)->>'x')::uuid FOR UPDATE;
      IF item.id IS NULL THEN RAISE EXCEPTION 'Cannot approve: the glass item in this request no longer exists.'; END IF;
      SELECT stand_number INTO s_from FROM public.stands WHERE id = (op->>'stand_id')::uuid;
      IF s_from IS NULL THEN RAISE EXCEPTION 'Cannot approve: the stand in this request no longer exists.'; END IF;
      SELECT quantity INTO qty FROM public.inventory_stand_quantities WHERE inventory_id = item.id AND stand_id = (op->>'stand_id')::uuid FOR UPDATE;
      qty := coalesce(qty, 0);
      IF qty + delta < 0 OR item.number_of_sheets + delta < 0 THEN
        RAISE EXCEPTION 'Cannot approve this request because available stock has changed. Current available quantity: % sheets. Requested quantity: % sheets.', qty, -delta;
      END IF;
      UPDATE public.glass_stock_items SET number_of_sheets = number_of_sheets + delta WHERE id = item.id;
      INSERT INTO public.inventory_stand_quantities (inventory_id, stand_id, quantity) VALUES (item.id, (op->>'stand_id')::uuid, qty + delta)
        ON CONFLICT (inventory_id, stand_id) DO UPDATE SET quantity = EXCLUDED.quantity;
      SELECT glass_type_id INTO v_type FROM public.glass_variants WHERE id = item.glass_variant_id;
      PERFORM public._inv_log(jsonb_build_object(
        'glass_type_id', v_type, 'glass_variant_id', item.glass_variant_id, 'glass_stock_item_id', item.id,
        'action_type', CASE WHEN delta > 0 THEN 'add_stock' ELSE 'sale_stock' END,
        'old_value', jsonb_build_object('number_of_sheets', item.number_of_sheets), 'new_value', jsonb_build_object('number_of_sheets', item.number_of_sheets + delta),
        'comment', op->>'remarks', 'stand_id', op->>'stand_id', 'stand_number', s_from,
        'previous_total_quantity', item.number_of_sheets, 'new_total_quantity', item.number_of_sheets + delta,
        'previous_stand_quantity', qty, 'new_stand_quantity', qty + delta), req.id, req.requested_by);

    ELSIF kind = 'transfer' THEN
      delta := (op->>'quantity')::int;
      SELECT * INTO item FROM public.glass_stock_items WHERE id = (op->>'item_id')::uuid FOR UPDATE;
      IF item.id IS NULL THEN RAISE EXCEPTION 'Cannot approve: the glass item in this request no longer exists.'; END IF;
      SELECT stand_number INTO s_from FROM public.stands WHERE id = (op->>'from_stand_id')::uuid;
      SELECT stand_number INTO s_to FROM public.stands WHERE id = (op->>'to_stand_id')::uuid;
      IF s_from IS NULL OR s_to IS NULL THEN RAISE EXCEPTION 'Cannot approve: a stand in this request no longer exists.'; END IF;
      PERFORM 1 FROM public.inventory_stand_quantities WHERE inventory_id = item.id AND stand_id IN ((op->>'from_stand_id')::uuid, (op->>'to_stand_id')::uuid) ORDER BY stand_id FOR UPDATE;
      SELECT coalesce(max(quantity),0) INTO from_q FROM public.inventory_stand_quantities WHERE inventory_id = item.id AND stand_id = (op->>'from_stand_id')::uuid;
      SELECT coalesce(max(quantity),0) INTO to_q FROM public.inventory_stand_quantities WHERE inventory_id = item.id AND stand_id = (op->>'to_stand_id')::uuid;
      IF from_q < delta THEN
        RAISE EXCEPTION 'Cannot approve this request because available stock has changed. Current available quantity: % sheets. Requested quantity: % sheets.', from_q, delta;
      END IF;
      UPDATE public.inventory_stand_quantities SET quantity = from_q - delta WHERE inventory_id = item.id AND stand_id = (op->>'from_stand_id')::uuid;
      INSERT INTO public.inventory_stand_quantities (inventory_id, stand_id, quantity) VALUES (item.id, (op->>'to_stand_id')::uuid, to_q + delta)
        ON CONFLICT (inventory_id, stand_id) DO UPDATE SET quantity = EXCLUDED.quantity;
      SELECT glass_type_id INTO v_type FROM public.glass_variants WHERE id = item.glass_variant_id;
      PERFORM public._inv_log(jsonb_build_object(
        'glass_type_id', v_type, 'glass_variant_id', item.glass_variant_id, 'glass_stock_item_id', item.id,
        'action_type', 'transfer_stock', 'comment', op->>'remarks', 'stand_id', op->>'from_stand_id', 'stand_number', s_from || ' → ' || s_to,
        'old_value', jsonb_build_object('from', from_q, 'to', to_q), 'new_value', jsonb_build_object('from', from_q - delta, 'to', to_q + delta, 'to_stand_id', op->>'to_stand_id', 'quantity', delta),
        'previous_total_quantity', item.number_of_sheets, 'new_total_quantity', item.number_of_sheets,
        'previous_stand_quantity', from_q, 'new_stand_quantity', from_q - delta), req.id, req.requested_by);

    ELSIF kind = 'set_stand_qty' THEN
      v_id := (public._inv_resolve(jsonb_build_object('x', op->'item_id'), refs)->>'x')::uuid;
      SELECT * INTO item FROM public.glass_stock_items WHERE id = v_id FOR UPDATE;
      IF item.id IS NULL THEN RAISE EXCEPTION 'Cannot approve: the glass item in this request no longer exists.'; END IF;
      m := public._inv_resolve(jsonb_build_object('x', op->'stand_id'), refs)->>'x';
      IF NOT EXISTS (SELECT 1 FROM public.stands WHERE id = m::uuid) THEN RAISE EXCEPTION 'Cannot approve: a stand in this request no longer exists.'; END IF;
      SELECT quantity INTO qty FROM public.inventory_stand_quantities WHERE inventory_id = item.id AND stand_id = m::uuid FOR UPDATE;
      IF op ? 'expected' AND coalesce(qty,0) <> coalesce((op->>'expected')::int, 0) THEN
        RAISE EXCEPTION 'Cannot approve: stand quantity changed after the request was submitted (now % sheets, expected % sheets). Reject it and ask for a new request.', coalesce(qty,0), (op->>'expected')::int;
      END IF;
      IF (op->>'quantity')::int = 0 THEN
        DELETE FROM public.inventory_stand_quantities WHERE inventory_id = item.id AND stand_id = m::uuid;
      ELSE
        INSERT INTO public.inventory_stand_quantities (inventory_id, stand_id, quantity) VALUES (item.id, m::uuid, (op->>'quantity')::int)
          ON CONFLICT (inventory_id, stand_id) DO UPDATE SET quantity = EXCLUDED.quantity;
      END IF;
      IF logj IS NOT NULL THEN
        PERFORM public._inv_log(logj || jsonb_build_object('glass_stock_item_id', item.id, 'stand_id', m, 'previous_stand_quantity', coalesce(qty,0), 'new_stand_quantity', (op->>'quantity')::int), req.id, req.requested_by);
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.submit_inventory_change_request(
  p_action_type text, p_summary text, p_operations jsonb, p_changes jsonb DEFAULT '[]'::jsonb,
  p_original_values jsonb DEFAULT NULL, p_stock_item_id uuid DEFAULT NULL, p_stand_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE perm text; v_role text; v_id uuid; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  SELECT role::text INTO v_role FROM public.profiles WHERE user_id = auth.uid() AND is_active;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Account inactive' USING ERRCODE = '42501'; END IF;
  FOREACH perm IN ARRAY public._inv_required_perms(p_operations) LOOP
    IF NOT public.has_module_perm(auth.uid(), 'inventory', perm) THEN
      RAISE EXCEPTION 'You do not have permission to submit this inventory change' USING ERRCODE = '42501';
    END IF;
  END LOOP;
  IF btrim(coalesce(p_action_type,'')) = '' OR btrim(coalesce(p_summary,'')) = '' THEN RAISE EXCEPTION 'Request details are required'; END IF;
  INSERT INTO public.inventory_change_requests (requested_by, requester_role, action_type, summary, operations, changes, original_values, affected_stock_item_id, affected_stand_id)
  VALUES (auth.uid(), v_role, left(btrim(p_action_type), 60), left(btrim(p_summary), 500), p_operations, coalesce(p_changes,'[]'::jsonb), p_original_values, p_stock_item_id, p_stand_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.review_inventory_change_request(p_request_id uuid, p_decision text, p_reason text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ DECLARE req public.inventory_change_requests; BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
  IF p_decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  SELECT * INTO req FROM public.inventory_change_requests WHERE id = p_request_id FOR UPDATE;
  IF req.id IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'This request has already been %.', req.status; END IF;
  IF p_decision = 'approve' THEN
    PERFORM public._inv_apply(req);
    UPDATE public.inventory_change_requests SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now() WHERE id = req.id;
    RETURN 'approved';
  END IF;
  UPDATE public.inventory_change_requests SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
    rejection_reason = nullif(left(btrim(coalesce(p_reason,'')), 1000), '') WHERE id = req.id;
  RETURN 'rejected';
END $$;

REVOKE ALL ON FUNCTION public._inv_apply(public.inventory_change_requests) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._inv_log(jsonb, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._inv_required_perms(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_inventory_change_request(text,text,jsonb,jsonb,jsonb,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_inventory_change_request(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_inventory_change_request(text,text,jsonb,jsonb,jsonb,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_inventory_change_request(uuid,text,text) TO authenticated;
