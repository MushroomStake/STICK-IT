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

    const { paths } = req.body || {};
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return res.status(400).json({ error: 'paths required' });
    }

    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'stickit-uploads';
    const urls: Record<string, string | null> = {};

    for (const p of paths) {
      try {
        // try public URL first
        const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(p) as any;
        let publicUrl = (publicData as any)?.publicUrl ?? null;

        if (!publicUrl) {
          const { data: signedData, error: signedError } = await supabaseAdmin.storage.from(bucket).createSignedUrl(p, 60 * 60);
          if (!signedError && signedData && (signedData as any).signedUrl) {
            publicUrl = (signedData as any).signedUrl;
          }
        }

        urls[p] = publicUrl ?? null;
      } catch (e) {
        urls[p] = null;
      }
    }

    return res.status(200).json({ urls });
  } catch (err) {
    console.error('file-urls handler error', err);
    const message = (err && (err as any).message) ? (err as any).message : 'Failed to get file urls';
    return res.status(500).json({ error: message });
  }
}
