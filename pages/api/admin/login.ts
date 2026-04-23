import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).json({ error: 'Supabase not configured' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  try {
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (error) {
      console.error('admin login failed', error);
      return res.status(401).json({ error: error.message || 'Invalid credentials' });
    }

    const session = (data as any)?.session;
    if (!session) return res.status(500).json({ error: 'Failed to create session' });

    // Set a secure, httpOnly cookie to mark admin session
    const maxAge = 60 * 60 * 24 * 7; // 7 days
    res.setHeader('Set-Cookie', [`admin_auth=${session.access_token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax`]);

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('admin login error', err);
    return res.status(500).json({ error: err?.message || 'Login failed' });
  }
}
