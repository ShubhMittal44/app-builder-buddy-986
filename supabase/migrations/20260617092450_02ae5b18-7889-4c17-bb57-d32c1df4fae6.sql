-- handle_new_user is a trigger function; direct EXECUTE access is not needed by anyone.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;