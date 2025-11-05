-- Admin-only delete policy for orders table
-- First, drop any existing delete policies
DROP POLICY IF EXISTS "only admins can delete orders" ON public.orders;
DROP POLICY IF EXISTS "service_role_can_delete_orders" ON public.orders;

-- Create admin-only delete policy using the has_role function
CREATE POLICY "admin_only_delete_orders"
ON public.orders
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::role_enum)
);