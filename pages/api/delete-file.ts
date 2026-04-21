import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return res.status(500).json({ error: 'Supabase service key not configured on server' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRole);

    const { path } = req.body || {};
    if (!path || typeof path !== 'string') {
      return res.status(400).json({ error: 'path is required' });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'stickit-uploads';
    const { data, error } = await supabaseAdmin.storage.from(bucket).remove([path]);

    if (error) {
      console.error('delete-file error', error);
      return res.status(500).json({ error: error.message || 'Failed to delete file' });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error('delete-file handler error', err);
    const message = (err && (err as any).message) ? (err as any).message : 'Failed to delete file';
    return res.status(500).json({ error: message });
  }
}
