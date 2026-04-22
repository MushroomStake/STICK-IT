import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

type FilePayload = {
  uploadedUrl?: string | null;
  name?: string;
  quantity?: number;
  removeBackground?: boolean;
  border?: boolean;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return res.status(500).json({ error: 'Supabase not configured on server' });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  try {
    const { reservationName, dealId, dealTitle, dealPrice, files, qrValue, deletePaths } = req.body as {
      reservationName: string;
      dealId?: string;
      dealTitle?: string;
      dealPrice?: number;
      files?: FilePayload[];
      qrValue?: string;
      deletePaths?: string[];
    };

    if (!reservationName || !qrValue) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // insert order
    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert([
        {
          qr_code: qrValue,
          full_name: reservationName,
          deal_id: dealId || null,
          deal_title: dealTitle || null,
          total_price: dealPrice ?? null,
          status: 'pending',
        },
      ])
      .select()
      .single();

    if (orderError) {
      console.error('order insert error', orderError);
      return res.status(500).json({ error: 'Failed to create order' });
    }

    const orderId = orderData.id;

    // insert files if any
    if (files && Array.isArray(files) && files.length) {
      const rows = files
        .filter((f) => f.uploadedUrl)
        .map((f) => ({
          order_id: orderId,
          file_url: f.uploadedUrl,
          file_name: f.name || null,
          quantity: f.quantity ?? 1,
          remove_background: !!f.removeBackground,
          border: !!f.border,
        }));

      if (rows.length) {
        const { error: filesError } = await supabaseAdmin.from('order_files').insert(rows);
        if (filesError) {
          console.error('files insert error', filesError);
          // don't fail the whole request, but report partial failure
          return res.status(500).json({ error: 'Order created but failed to save files' });
        }
      }
    }

    // Attempt to delete any leftover/previous file versions that were recorded by the client.
    // This is best-effort: failures are logged but do not prevent order creation.
    try {
      const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'stickit-uploads';
      if (deletePaths && Array.isArray(deletePaths) && deletePaths.length > 0) {
        const safePaths = deletePaths.filter((p) => typeof p === 'string' && p.length > 0);
        if (safePaths.length > 0) {
          const { error: delError } = await supabaseAdmin.storage.from(bucket).remove(safePaths);
          if (delError) console.warn('create-order: failed to remove some old files', delError);
        }
      }
    } catch (e) {
      console.warn('create-order: cleanup deletePaths failed', e);
    }

    return res.status(200).json({ orderId });
  } catch (err) {
    console.error('create-order error', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
}
