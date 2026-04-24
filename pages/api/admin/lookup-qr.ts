import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { qr } = req.query as { qr?: string };
    if (!qr || typeof qr !== 'string') return res.status(400).json({ error: 'qr parameter required' });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) return res.status(500).json({ error: 'Supabase not configured' });

    const supabaseAdmin = createClient(supabaseUrl, serviceRole);

    const { data: order, error: orderErr } = await supabaseAdmin.from('orders').select('*').eq('qr_code', qr).single();
    if (orderErr || !order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const { data: files } = await supabaseAdmin.from('order_files').select('*').eq('order_id', order.id).order('id', { ascending: true });

    return res.status(200).json({ order, files: files ?? [] });
  } catch (e) {
    console.error('lookup-qr error', e);
    return res.status(500).json({ error: 'Failed to lookup QR' });
  }
}
