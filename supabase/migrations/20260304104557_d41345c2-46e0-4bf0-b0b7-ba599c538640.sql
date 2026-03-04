
-- Fix function search path for set_client_name_norm
CREATE OR REPLACE FUNCTION public.set_client_name_norm()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.client_name_norm := lower(trim(NEW.client_name));
  RETURN NEW;
END;
$$;
