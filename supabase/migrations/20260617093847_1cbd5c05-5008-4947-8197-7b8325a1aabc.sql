-- 1. Add optional color column to glass_variants
ALTER TABLE public.glass_variants ADD COLUMN IF NOT EXISTS color text;

-- 2. Seed default glass types + default thickness variants idempotently
DO $$
DECLARE
  v_type_names text[] := ARRAY[
    'Float Glass','Clear Glass','Toughened Glass','Laminated Glass','Lacquered Glass',
    'Mirror','Frosted Glass','Tinted Glass','Reflective Glass','Pattern Glass',
    'Fluted Glass','DGU Glass','Extra Clear Glass','One Way Glass','Bend Glass','Designer Glass'
  ];
  v_thicknesses text[] := ARRAY['3.5 mm','4 mm','5 mm','6 mm','8 mm','10 mm','12 mm','15 mm','19 mm'];
  v_name text;
  v_thick text;
  v_type_id uuid;
BEGIN
  FOREACH v_name IN ARRAY v_type_names LOOP
    -- find existing type case-insensitively
    SELECT id INTO v_type_id
    FROM public.glass_types
    WHERE trim(lower(glass_type_name)) = trim(lower(v_name))
    LIMIT 1;

    -- insert type if missing
    IF v_type_id IS NULL THEN
      INSERT INTO public.glass_types (glass_type_name, notes)
      VALUES (v_name, NULL)
      RETURNING id INTO v_type_id;
    END IF;

    -- insert default thickness variants if missing
    FOREACH v_thick IN ARRAY v_thicknesses LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.glass_variants
        WHERE glass_type_id = v_type_id
          AND trim(lower(thickness)) = trim(lower(v_thick))
          AND trim(lower(coalesce(company_purchased,''))) = 'general'
          AND coalesce(color,'') = ''
      ) THEN
        INSERT INTO public.glass_variants (glass_type_id, thickness, company_purchased, color, notes)
        VALUES (v_type_id, v_thick, 'General', NULL, NULL);
      END IF;
    END LOOP;
  END LOOP;
END $$;