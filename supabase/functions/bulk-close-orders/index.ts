import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BulkCloseRequest {
  order_ids: string[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Client scoped to the caller's auth (for identity + admin check via RLS)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Identify the authenticated user (pass token explicitly — no session in edge runtime)
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin via RLS-protected profiles table (scoped to this user)
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, email, display_name')
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (profileError || !profile || profile.role !== 'admin') {
      console.log('Permission denied (bulk close):', { profileError, profile });
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate request body
    const body = await req.json().catch(() => ({} as any));
    const orderIds: string[] = Array.isArray(body.order_ids) ? body.order_ids : [];
    const ids = orderIds
      .filter((v) => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No order_ids provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin bulk close request:', { count: ids.length });

    // Service-role client for the updates (admin already verified)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch selected orders
    const { data: orders, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, stage, timeline, total_amount, freight_amount')
      .in('id', ids);

    if (fetchError) {
      console.error('Failed to fetch orders for bulk close:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch orders' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userName = profile.display_name || profile.email || 'Unknown';
    let closedCount = 0;
    let alreadyClosedCount = 0;

    for (const order of orders ?? []) {
      if (order.stage === 'closed') {
        alreadyClosedCount++;
        continue;
      }

      const currentTimeline = Array.isArray(order.timeline) ? order.timeline : [];
      const newEntry = {
        timestamp: new Date().toISOString(),
        user: userName,
        action: 'bulk_force_close',
        label: 'Order closed directly from bulk action',
        from_stage: order.stage,
        to_stage: 'closed',
      };

      // Mark as fully paid: advance covers total so balance becomes 0
      const fullyPaidAdvance = Number(order.total_amount ?? 0);

      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({
          stage: 'closed',
          advance_amount: fullyPaidAdvance,
          timeline: [...currentTimeline, newEntry],
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('Failed to close order:', { id: order.id, updateError });
        continue;
      }
      closedCount++;
    }

    console.log('Bulk close complete:', { closedCount, alreadyClosedCount });

    return new Response(
      JSON.stringify({ ok: true, closed_count: closedCount, already_closed_count: alreadyClosedCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected bulk close error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
