import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DeleteOrderRequest {
  order_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Create service role client for storage operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin via RLS-protected profiles table (no need to decode token)
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('Permission denied:', { profileError, profile });
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body (support order_id or id)
    const body = await req.json().catch(() => ({} as any));
    const rawId: string | undefined = body.order_id || body.id;
    const order_id = (typeof rawId === 'string' ? rawId.trim() : undefined) as string | undefined;
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin delete request:', { order_id });

    // Fetch order to get file information (use admin client to bypass RLS)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, files')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError || !order) {
      console.error('Order not found or read error:', { orderError, order_id });
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Deleting order:', { order_number: order.order_number, order_id });

    // Delete files from Storage
    const filesToDelete: string[] = [];
    
    // Collect file paths from files JSON field (if present)
    if ((order as any).chalan_files && Array.isArray((order as any).chalan_files)) {
      (order as any).chalan_files.forEach((file: any) => {
        if (file.path) filesToDelete.push(file.path);
      });
    }

    // Collect file paths from files JSON field (if different)
    if (order.files && Array.isArray(order.files)) {
      order.files.forEach((file: any) => {
        if (file.path) {
          filesToDelete.push(file.path);
        }
      });
    }

    // Also delete entire folder for this order
    const folderPath = `${order_id}`;
    const { data: folderFiles, error: listError } = await supabaseAdmin.storage
      .from('sizes_chalan')
      .list(folderPath);

    if (folderFiles && !listError) {
      folderFiles.forEach((file) => {
        filesToDelete.push(`${folderPath}/${file.name}`);
      });
    }

    // Delete all files from storage
    if (filesToDelete.length > 0) {
      console.log('Deleting files:', filesToDelete);
      const { error: deleteStorageError } = await supabaseAdmin.storage
        .from('sizes_chalan')
        .remove(filesToDelete);

      if (deleteStorageError) {
        console.error('Storage deletion error:', deleteStorageError);
        // Continue with order deletion even if storage fails
      } else {
        console.log(`Deleted ${filesToDelete.length} files from storage`);
      }
    }

    // Delete the order (RLS will enforce admin-only)
    const { error: deleteError } = await supabaseClient
      .from('orders')
      .delete()
      .eq('id', order_id);

    if (deleteError) {
      console.error('Order deletion error:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order deleted successfully:', order_id);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message: `Order #${order.order_number} deleted successfully`,
        files_deleted: filesToDelete.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
