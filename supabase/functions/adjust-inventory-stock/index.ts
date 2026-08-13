import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ActionType = 'add_stock' | 'sale_stock';

interface AdjustRequest {
  inventory_id: string;
  stand_id: string;
  action_type: ActionType;
  quantity: number;
  remarks?: string;
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
      console.log('Permission denied (adjust stock):', { profileError, profile });
      return new Response(JSON.stringify({ error: 'Forbidden: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse and validate input
    const body = (await req.json().catch(() => ({}))) as Partial<AdjustRequest>;
    const inventory_id = typeof body.inventory_id === 'string' ? body.inventory_id.trim() : '';
    const stand_id = typeof body.stand_id === 'string' ? body.stand_id.trim() : '';
    const action_type = body.action_type;
    const quantity = Number(body.quantity);
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';

    if (!inventory_id) {
      return new Response(JSON.stringify({ error: 'Missing inventory_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!stand_id) {
      return new Response(JSON.stringify({ error: 'Please select a stand number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (action_type !== 'add_stock' && action_type !== 'sale_stock') {
      return new Response(JSON.stringify({ error: 'Invalid action_type' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return new Response(JSON.stringify({ error: 'Quantity must be greater than 0' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the stock item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('glass_stock_items')
      .select('id, glass_variant_id, length, breadth, unit, number_of_sheets')
      .eq('id', inventory_id)
      .maybeSingle();

    if (itemError || !item) {
      console.error('Stock item not found:', { itemError, inventory_id });
      return new Response(JSON.stringify({ error: 'Inventory item not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch the stand
    const { data: stand, error: standError } = await supabaseAdmin
      .from('stands')
      .select('id, stand_number, is_active')
      .eq('id', stand_id)
      .maybeSingle();

    if (standError || !stand) {
      console.error('Stand not found:', { standError, stand_id });
      return new Response(JSON.stringify({ error: 'Stand not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Current stand quantity for this inventory item
    const { data: standRow } = await supabaseAdmin
      .from('inventory_stand_quantities')
      .select('id, quantity')
      .eq('inventory_id', inventory_id)
      .eq('stand_id', stand_id)
      .maybeSingle();

    const previousQuantity = Number(item.number_of_sheets) || 0;
    const previousStandQuantity = Number(standRow?.quantity ?? 0);
    const qty = Math.trunc(quantity);

    if (action_type === 'sale_stock') {
      if (qty > previousStandQuantity) {
        return new Response(JSON.stringify({ error: 'Insufficient stock available in selected stand.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (qty > previousQuantity) {
        return new Response(JSON.stringify({ error: 'Insufficient stock available' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const changedQuantity = action_type === 'add_stock' ? qty : -qty;
    const newQuantity = previousQuantity + changedQuantity;
    const newStandQuantity = previousStandQuantity + changedQuantity;

    if (newQuantity < 0 || newStandQuantity < 0) {
      return new Response(JSON.stringify({ error: 'Insufficient stock available' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve glass_type_id for richer history
    const { data: variant } = await supabaseAdmin
      .from('glass_variants')
      .select('id, glass_type_id')
      .eq('id', item.glass_variant_id)
      .maybeSingle();

    // Update the stock quantity
    const { error: updateError } = await supabaseAdmin
      .from('glass_stock_items')
      .update({ number_of_sheets: newQuantity, updated_at: new Date().toISOString() })
      .eq('id', inventory_id);

    if (updateError) {
      console.error('Stock update error:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to update stock' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Upsert the stand-wise quantity
    const standUpdate = standRow
      ? await supabaseAdmin
          .from('inventory_stand_quantities')
          .update({ quantity: newStandQuantity, updated_at: new Date().toISOString() })
          .eq('id', standRow.id)
      : await supabaseAdmin
          .from('inventory_stand_quantities')
          .insert({ inventory_id, stand_id, quantity: newStandQuantity });

    if (standUpdate.error) {
      console.error('Stand quantity update error:', standUpdate.error);
      // Roll back the total change to keep data consistent
      await supabaseAdmin
        .from('glass_stock_items')
        .update({ number_of_sheets: previousQuantity })
        .eq('id', inventory_id);
      return new Response(JSON.stringify({ error: 'Failed to update stand quantity' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert history record
    const { error: logError } = await supabaseAdmin.from('inventory_activity_log').insert({
      glass_type_id: variant?.glass_type_id ?? null,
      glass_variant_id: item.glass_variant_id,
      glass_stock_item_id: inventory_id,
      action_type,
      stand_id,
      stand_number: stand.stand_number,
      previous_total_quantity: previousQuantity,
      new_total_quantity: newQuantity,
      previous_stand_quantity: previousStandQuantity,
      new_stand_quantity: newStandQuantity,
      old_value: {
        number_of_sheets: previousQuantity,
        stand_quantity: previousStandQuantity,
        length: item.length,
        breadth: item.breadth,
        unit: item.unit,
      },
      new_value: {
        number_of_sheets: newQuantity,
        stand_quantity: newStandQuantity,
        changed_quantity: changedQuantity,
        stand_number: stand.stand_number,
        length: item.length,
        breadth: item.breadth,
        unit: item.unit,
      },
      comment: remarks || null,
      changed_by: userData.user.id,
    });

    if (logError) {
      // Stock already updated; log failure but don't fail the whole operation
      console.error('Activity log insert error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        previous_quantity: previousQuantity,
        changed_quantity: changedQuantity,
        new_quantity: newQuantity,
        previous_stand_quantity: previousStandQuantity,
        new_stand_quantity: newStandQuantity,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected adjust stock error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
