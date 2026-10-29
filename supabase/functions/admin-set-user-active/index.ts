import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const { data: u, error } = await admin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (error || !u?.user) return json({ error: 'Unauthorized' }, 401);

    const { data: caller } = await admin.from('profiles').select('role, is_active').eq('user_id', u.user.id).maybeSingle();
    if (!caller || caller.role !== 'admin' || !caller.is_active) return json({ error: 'Admin access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const userId = typeof body.user_id === 'string' ? body.user_id : '';
    const active = body.active === true;
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return json({ error: 'Invalid user_id' }, 400);
    if (userId === u.user.id) return json({ error: 'You cannot deactivate your own account' }, 400);

    const { error: banErr } = await admin.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' });
    if (banErr) return json({ error: banErr.message }, 400);

    // Audit row is written by the profiles trigger; record actor explicitly too
    const { error: upErr } = await admin.from('profiles').update({ is_active: active }).eq('user_id', userId);
    if (upErr) return json({ error: 'Failed to update account status' }, 500);
    await admin.from('user_admin_audit_log')
      .update({ changed_by: u.user.id })
      .eq('target_user_id', userId).is('changed_by', null)
      .in('action', ['account_deactivated', 'account_reactivated']);

    return json({ success: true });
  } catch (e) {
    console.error(e);
    return json({ error: 'Internal server error' }, 500);
  }
});
