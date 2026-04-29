import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { Buffer } from 'buffer';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { newPassword } = req.body || {};
  if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'newPassword is required (min 6 chars)' });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).json({ error: 'Supabase not configured' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);
  const token = (req.cookies && (req.cookies as any).admin_auth) || null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });

  try {
    let user: any = null;
    try {
      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token as string);
      if (!userErr && userData?.user) user = userData.user;
    } catch (e) {
      console.error('supabase getUser call failed', e);
    }

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
      if (payload?.sub) {
        try {
          const maybe = await (supabaseAdmin.auth as any).admin.getUserById(payload.sub);
          if (maybe && maybe.data) user = maybe.data.user ?? maybe.data ?? null;
        } catch (e) {
          console.error('admin.getUserById fallback failed', e);
        }
      }
    }

    if (!user || !user.id) return res.status(401).json({ error: 'Invalid admin session' });

    // Use admin API to update user's password
    // @ts-ignore-next-line
    const { data, error } = await (supabaseAdmin.auth as any).admin.updateUserById(user.id, { password: newPassword });
    if (error) {
      console.error('change-password error', error);
      return res.status(500).json({ error: 'Failed to change password' });
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('change-password handler error', err);
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
