CREATE OR REPLACE FUNCTION public.admin_customer_ledger_summary(customer_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
    'totalCustomers', (SELECT count(*) FROM public.customers WHERE id = ANY(customer_ids)),
    'totalSale', coalesce(sum(CASE WHEN e.entry_type = 'Sale' THEN e.amount ELSE 0 END), 0),
    'totalReceived', coalesce(sum(CASE WHEN e.entry_type = 'Amount Received' THEN e.amount ELSE 0 END), 0),
    'outstanding', coalesce(sum(CASE WHEN e.entry_type = 'Amount Received' THEN -e.amount ELSE e.amount END), 0)
  ) INTO result
  FROM public.customer_ledger_entries e
  JOIN public.customers c ON c.id = e.customer_id
  WHERE c.id = ANY(customer_ids);
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_customer_ledger_summary(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_customer_ledger_summary(uuid[]) TO authenticated;
COMMENT ON FUNCTION public.admin_customer_ledger_summary(uuid[]) IS 'Admin-only summary of the shared filtered ledger customer set. Invoker security preserves RLS; no elevated credentials or changes to ledger records.';