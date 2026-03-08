ALTER TABLE public.staff_members
ADD COLUMN IF NOT EXISTS staff_type text;

ALTER TABLE public.staff_members
ADD CONSTRAINT staff_members_staff_type_check
CHECK (staff_type IS NULL OR staff_type IN ('Shop staff','Godown staff'));