import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ForceCloseRequest {
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
      console.log('Permission denied:', { profileError, profile });
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Parse request body
    const body = await req.json().catch(() => ({} as any));
    const rawId: string | undefined = body.order_id || body.id;
    const order_id = (typeof rawId === 'string' ? rawId.trim() : undefined) as string | undefined;
    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'Missing order_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Admin force close request:', { order_id });

    // Fetch current order to get timeline and stage
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, order_number, stage, timeline')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError || !order) {
      console.error('Order not found or read error:', { orderError, order_id });
      return new Response(
        JSON.stringify({ error: 'Order not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.stage === 'closed') {
      return new Response(
        JSON.stringify({ error: 'Order is already closed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build updated timeline
    const currentTimeline = Array.isArray(order.timeline) ? order.timeline : [];
    const userName = profile.display_name || profile.email || 'Unknown';
    const newEntry = {
      timestamp: new Date().toISOString(),
      user: userName,
      action: 'Order force closed',
      from_stage: order.stage,
      to_stage: 'closed',
    };

    // Update order to closed with new timeline entry
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        stage: 'closed',
        timeline: [...currentTimeline, newEntry],
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Force close update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to close order' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Order force closed successfully:', order_id);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Order #${order.order_number} has been force closed`,
        from_stage: order.stage,
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
