import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { orderId, status } = req.body || {};
  if (!orderId || !status) return res.status(400).json({ error: 'Missing orderId or status' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).json({ error: 'Supabase not configured' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  try {
    const { error } = await supabaseAdmin.from('orders').update({ status }).eq('id', orderId);
    if (error) {
      console.error('update-order-status error', error);
      return res.status(500).json({ error: error.message || 'Failed to update order status' });
    }
    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('update-order-status exception', err);
    return res.status(500).json({ error: err?.message || 'Failed' });
  }
}
