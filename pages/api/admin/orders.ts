import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).json({ error: 'Supabase not configured' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  try {
    const { id, page = '1', limit = '10', search = '', status = 'all', promo = 'all' } = req.query as Record<string, string>;
    // if id is provided, return single order + files
    if (id) {
      const { data: order, error: orderErr } = await supabaseAdmin.from('orders').select('*').eq('id', id).single() as any;
      if (orderErr) {
        console.error('fetch order error', orderErr);
        return res.status(500).json({ error: orderErr.message || 'Failed to fetch order' });
      }
      const { data: files, error: filesErr } = await supabaseAdmin.from('order_files').select('*').eq('order_id', id).order('id', { ascending: true }) as any;
      if (filesErr) {
        console.error('fetch files error', filesErr);
        return res.status(500).json({ error: filesErr.message || 'Failed to fetch order files' });
      }
      return res.status(200).json({ order: order ?? null, files: files ?? [] });
    }
    const p = Math.max(1, parseInt(page || '1', 10));
    const l = Math.max(1, parseInt(limit || '10', 10));
    const start = (p - 1) * l;
    const end = p * l - 1;

    const applyFilters = (qb: any) => {
      let q = qb;
      if (search) q = q.ilike('full_name', `%${search}%`);
      if (status && status !== 'all') q = q.eq('status', status);
      if (promo && promo !== 'all') q = q.eq('deal_id', promo);
      return q;
    };

    // total count with filters
    const { count: totalCount } = await applyFilters(supabaseAdmin.from('orders').select('*', { count: 'exact', head: true })) as any;

    // paginated rows
    const { data: orders, error } = await applyFilters(supabaseAdmin.from('orders').select('*')).order('created_at', { ascending: false }).range(start, end) as any;
    if (error) throw error;

    // total pending/completed (global)
    const { count: pendingCount } = await supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'pending') as any;
    const { count: completedCount } = await supabaseAdmin.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'completed') as any;

    return res.status(200).json({ orders: orders ?? [], totalCount: totalCount ?? 0, pendingCount: pendingCount ?? 0, completedCount: completedCount ?? 0 });
  } catch (err: any) {
    console.error('admin/orders error', err);
    return res.status(500).json({ error: err?.message || 'Failed' });
  }
}
