DO $$ DECLARE d text; BEGIN
  d := pg_get_functiondef('public._inv_required_perms(jsonb)'::regprocedure);
  d := replace(d, 'perms := perms || ''edit''', 'perms := array_append(perms, ''edit'')');
  d := replace(d, 'perms := perms || ''add''', 'perms := array_append(perms, ''add'')');
  d := replace(d, 'perms := perms || CASE', 'perms := array_append(perms, CASE');
  d := replace(d, 'ELSE ''edit'' END;', 'ELSE ''edit'' END);');
  EXECUTE d;
END $$;
REVOKE ALL ON FUNCTION public._inv_required_perms(jsonb) FROM PUBLIC, anon;