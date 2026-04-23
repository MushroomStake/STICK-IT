import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';

function extractStoragePath(url?: string) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/');
    // look for the storage path after the bucket name
    // e.g. /storage/v1/object/public/<bucket>/<path>
    const idx = parts.indexOf('public');
    if (idx >= 0 && parts.length > idx + 1) {
      return parts.slice(idx + 2).join('/');
    }
    // fallback: return last segment
    return parts.slice(-1)[0];
  } catch (e) {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'Missing file id' });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'stickit-uploads';
  if (!supabaseUrl || !serviceRole) return res.status(500).json({ error: 'Supabase not configured' });

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  try {
    // fetch file row
    const { data: fileRow, error: fetchErr } = await supabaseAdmin.from('order_files').select('*').eq('id', id).single();
    if (fetchErr) {
      console.error('fetch file row error', fetchErr);
      return res.status(500).json({ error: 'Failed to fetch file' });
    }

    const fileUrl = (fileRow as any)?.file_url as string | undefined;
    const storagePath = extractStoragePath(fileUrl);
    if (storagePath) {
      await supabaseAdmin.storage.from(bucket).remove([storagePath]);
    }

    const { error: delErr } = await supabaseAdmin.from('order_files').delete().eq('id', id);
    if (delErr) {
      console.error('delete order_files row error', delErr);
      return res.status(500).json({ error: delErr.message || 'Failed to delete file entry' });
    }

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('delete-order-file error', err);
    return res.status(500).json({ error: err?.message || 'Failed' });
  }
}
