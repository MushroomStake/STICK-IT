import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).json({ error: 'Supabase not configured' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  const token = (req.cookies && (req.cookies as any).admin_auth) || null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    let user: any = null;

    // First try the standard API that verifies the access token
    try {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token as string);
      if (!userErr && userData?.user) user = userData.user;
    } catch (e) {
      console.error('supabase getUser call failed', e);
    }

    // Fallback: attempt to decode token payload to recover email or sub
    if (!user) {
      const decodeJwt = (t: string) => {
        try {
          const parts = t.split('.');
          if (parts.length < 2) return null;
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          return payload as any;
        } catch (e) {
          return null;
        }
      };

      const payload = decodeJwt(token as string);
      if (payload?.email) {
        user = { id: payload.sub ?? null, email: payload.email };
      } else if (payload?.sub) {
        try {
          // Try admin getUserById as a last resort (service role key required)
          const maybe = await (supabaseAdmin.auth as any).admin.getUserById(payload.sub);
          if (maybe && maybe.data) {
            // some versions return { data: { user } } while others return data directly
            user = maybe.data.user ?? maybe.data ?? null;
          }
        } catch (e) {
          console.error('admin.getUserById fallback failed', e);
        }
      }
    }

    if (!user || !user.email) return res.status(401).json({ error: 'Invalid admin session' });
    const email = user.email || '';

    if (req.method === 'GET') {
      const { data: profileData, error: profileErr } = await supabaseAdmin.from('admin_profiles').select('*').eq('email', email).maybeSingle();
      if (profileErr) {
        return res.status(200).json({ user: { id: user.id, email }, profile: null });
      }
      return res.status(200).json({ user: { id: user.id, email }, profile: profileData ?? null });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const { first_name, middle_name, last_name } = req.body || {};
      const row = {
        user_id: user.id,
        email,
        first_name: first_name ?? null,
        middle_name: middle_name ?? null,
        last_name: last_name ?? null,
        updated_at: new Date().toISOString(),
      } as any;

      const { data, error } = await supabaseAdmin.from('admin_profiles').upsert(row, { onConflict: 'email' }).select().maybeSingle();
      if (error) {
        console.error('profile upsert error', error);
        return res.status(500).json({ error: 'Profile update failed' });
      }
      return res.status(200).json({ ok: true, profile: data });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    console.error('profile handler error', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
