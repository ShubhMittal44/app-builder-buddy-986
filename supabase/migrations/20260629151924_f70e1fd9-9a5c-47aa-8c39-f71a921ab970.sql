ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'Daybook';

UPDATE public.orders
  SET order_type = 'Daybook'
  WHERE order_type IS NULL OR order_type NOT IN ('Daybook', 'Toughened');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_order_type_check'
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_order_type_check
      CHECK (order_type IN ('Daybook', 'Toughened'));
  END IF;
END $$;