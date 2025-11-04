-- Create storage bucket for order files (sizes_chalan)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sizes_chalan', 
  'sizes_chalan', 
  false,
  10485760, -- 10MB limit
  array['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
);

-- Policy: Authenticated users can view files in sizes_chalan bucket
create policy "Authenticated users can view order files"
on storage.objects for select
to authenticated
using (bucket_id = 'sizes_chalan');

-- Policy: Authenticated users can upload files to sizes_chalan bucket
create policy "Authenticated users can upload order files"
on storage.objects for insert
to authenticated
with check (bucket_id = 'sizes_chalan');

-- Policy: Authenticated users can update their uploaded files
create policy "Authenticated users can update order files"
on storage.objects for update
to authenticated
using (bucket_id = 'sizes_chalan');

-- Policy: Only admins can delete files from sizes_chalan bucket
create policy "Only admins can delete order files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'sizes_chalan' AND
  is_admin(auth.uid())
);