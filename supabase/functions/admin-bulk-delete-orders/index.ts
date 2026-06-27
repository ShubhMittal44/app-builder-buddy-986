import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkDeleteRequest {
  ids?: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Identify the authenticated user (pass token explicitly — no session in edge runtime)
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin via RLS-protected profiles table (scoped to this user)
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('Permission denied (bulk):', { profileError, profile });
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { ids }: BulkDeleteRequest = await req.json();

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(JSON.stringify({ error: 'No ids provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Admin bulk delete request:', { count: ids.length });

    // Fetch orders to gather storage file paths (use admin client to bypass RLS)
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, files')
      .in('id', ids);

    if (fetchError) {
      console.error('Failed to fetch orders for bulk delete', fetchError);
      return new Response(JSON.stringify({ error: 'Failed to fetch orders' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const filesToDelete: string[] = [];

    // Collect file paths from JSON fields
    for (const order of orders ?? []) {
      const otherFiles: any[] = Array.isArray((order as any)?.files) ? (order as any).files : [];

      otherFiles.forEach((f) => f?.path && filesToDelete.push(f.path));

      // Also list entire order folder
      const folderPath = `${order.id}`;
      const { data: folderFiles, error: listError } = await supabaseAdmin.storage
        .from('sizes_chalan')
        .list(folderPath);
      if (!listError && folderFiles) {
        folderFiles.forEach((file) => filesToDelete.push(`${folderPath}/${file.name}`));
      }
    }

    // Remove duplicates
    const uniqueFiles = Array.from(new Set(filesToDelete));

    if (uniqueFiles.length > 0) {
      console.log('Deleting files (bulk):', uniqueFiles.length);
      const { error: storageError } = await supabaseAdmin.storage
        .from('sizes_chalan')
        .remove(uniqueFiles);
      if (storageError) {
        console.error('Bulk storage deletion error:', storageError);
        // Continue with DB deletion even if storage fails
      }
    }

    // Delete orders using the service role client (admin already verified)
    const { error: deleteError } = await supabaseAdmin
      .from('orders')
      .delete()
      .in('id', ids);

    if (deleteError) {
      console.error('Bulk order deletion error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, deletedIds: ids, files_deleted: uniqueFiles.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected bulk delete error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
