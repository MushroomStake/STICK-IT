import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).json({ error: 'Supabase not configured' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  try {
    const { status = 'all', search = '', promo = 'all' } = req.query as Record<string, string>;

    const applyFilters = (qb: any) => {
      let q = qb;
      if (search) q = q.ilike('full_name', `%${search}%`);
      if (status && status !== 'all') q = q.eq('status', status);
      if (promo && promo !== 'all') q = q.eq('deal_id', promo);
      return q;
    };

    const { data: orders, error } = await applyFilters(supabaseAdmin.from('orders').select('*')).order('created_at', { ascending: false }) as any;
    if (error) {
      console.error('export-orders fetch error', error);
      return res.status(500).json({ error: error.message || 'Failed to fetch orders' });
    }

    // try to require xlsx; if not available, fallback to CSV
    let XLSX: any = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      XLSX = require('xlsx');
    } catch (e) {
      XLSX = null;
    }

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const generatedAt = now.toLocaleString('en-US');
    const reportTitle = 'Stick IT - Orders Report';
    const filtersLine = `Status: ${status} | Promo: ${promo} | Search: ${search}`;

    const rows: any[] = [];
    // header template
    rows.push([reportTitle]);
    rows.push([`Generated At: ${generatedAt}`]);
    rows.push([filtersLine]);
    rows.push([]);

    const header = ['Order ID', 'QR Code', 'Customer Name', 'Phone', 'Deal', 'Status', 'Total Price', 'Created At'];
    rows.push(header);

    for (const o of (orders || [])) {
      rows.push([
        o.id || '',
        o.qr_code || '',
        o.full_name || '',
        o.phone_number || '',
        o.deal_title || '',
        o.status || '',
        o.total_price ?? '',
        o.created_at || '',
      ]);
    }

    if (XLSX) {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      // set reasonable column widths
      ws['!cols'] = [ { wch: 36 }, { wch: 20 }, { wch: 30 }, { wch: 18 }, { wch: 30 }, { wch: 18 }, { wch: 12 }, { wch: 22 } ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Orders');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
      const filename = `stickit_orders_${status}_${dateStr}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      return res.status(200).send(buf);
    }

    // Fallback: CSV
    const csvRows = rows.map(r => r.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const filename = `stickit_orders_${status}_${dateStr}.csv`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'text/csv');
    return res.status(200).send(csvRows);
  } catch (err: any) {
    console.error('export-orders handler error', err);
    return res.status(500).json({ error: err?.message || 'Export failed' });
  }
}
