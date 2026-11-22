CREATE INDEX IF NOT EXISTS ial_change_request_idx ON public.inventory_activity_log(change_request_id);
CREATE INDEX IF NOT EXISTS icr_stand_idx ON public.inventory_change_requests(affected_stand_id);
CREATE INDEX IF NOT EXISTS icr_item_idx ON public.inventory_change_requests(affected_stock_item_id);
DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public._inv_apply(public.inventory_change_requests)'::regprocedure);
  EXECUTE replace(d, 'submitped', 'submitted');
END $$;
REVOKE ALL ON FUNCTION public._inv_apply(public.inventory_change_requests) FROM PUBLIC, anon, authenticated;