import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Role = 'admin' | 'manager' | 'staff';
const MODULES = ['orders', 'inventory', 'daybook', 'customer_ledger'] as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const token = authHeader.replace('Bearer ', '');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Identify caller from their JWT (edge runtime has no session; must pass token explicitly)
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user) return json({ error: 'Unauthorized' }, 401);
    const callerId = userData.user.id;

    // Authoritative admin check scoped to the caller's own profile row
    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role, is_active').eq('user_id', callerId).maybeSingle();
    if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
      return json({ error: 'Admin access required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const displayName = (typeof body.display_name === 'string' && body.display_name.trim()) ||
      body.user_metadata?.display_name || email.split('@')[0];
    const roleIn = body.role ?? body.user_metadata?.role;
    const role: Role = ['admin', 'manager', 'staff'].includes(roleIn) ? roleIn : 'staff';
    const permissions = Array.isArray(body.permissions) ? body.permissions : [];

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) return json({ error: 'Valid email is required' }, 400);
    if (password.length < 8 || password.length > 72) return json({ error: 'Password must be 8–72 characters' }, 400);
    if (String(displayName).length > 100) return json({ error: 'Name too long' }, 400);

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { display_name: displayName },
    });
    if (createError || !created?.user) return json({ error: createError?.message || 'Failed to create user' }, 400);
    const userId = created.user.id;

    const { error: profileErr } = await supabaseAdmin.from('profiles').upsert(
      { user_id: userId, email, display_name: displayName, role, is_active: true },
      { onConflict: 'user_id' },
    );
    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId); // roll back partial creation
      console.error('Profile upsert error:', profileErr);
      return json({ error: 'Failed to save user profile' }, 500);
    }

    if (role !== 'admin') {
      const rows = MODULES.map((m) => {
        const p = permissions.find((x: any) => x?.module_key === m) ?? {};
        const can_add = !!p.can_add, can_edit = !!p.can_edit;
        return { user_id: userId, module_key: m, can_view: !!p.can_view || can_add || can_edit, can_add, can_edit, updated_by: callerId };
      });
      const { error: permErr } = await supabaseAdmin.from('user_module_permissions').upsert(rows, { onConflict: 'user_id,module_key' });
      if (permErr) console.error('Permission save error:', permErr);
    }

    await supabaseAdmin.from('user_admin_audit_log').insert({
      target_user_id: userId, target_email: email, action: 'user_created',
      new_value: { role, display_name: displayName, permissions: role === 'admin' ? 'full' : permissions },
      changed_by: callerId,
    });

    return json({ success: true, user: { user_id: userId, email, display_name: displayName, role } });
  } catch (err) {
    console.error('Unexpected error:', err);
    return json({ error: 'Internal server error' }, 500);
  }
});
