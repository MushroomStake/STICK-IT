import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

function mmToPt(mm: number) {
  return (mm * 72) / 25.4;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, page = '1', dpi = '150' } = req.query as any;
  if (!id) return res.status(400).send('missing id');

  const DPI = parseInt(dpi, 10) || 150;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).send('supabase not configured');

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);
  const CACHE_BUCKET = process.env.SUPABASE_CACHE_BUCKET || 'stickit-exports';

  // Try cached page image
  try {
    const { data: cached, error: cachedErr } = await supabaseAdmin.storage.from(CACHE_BUCKET).download(cacheKey);
    if (!cachedErr && cached) {
      if (typeof (cached as any).arrayBuffer === 'function') {
        const arr = await (cached as any).arrayBuffer();
        const buf = Buffer.from(arr);
        res.setHeader('Content-Type', 'image/png');
        return res.send(buf);
      } else if (Buffer.isBuffer(cached)) {
        res.setHeader('Content-Type', 'image/png');
        return res.send(cached as Buffer);
      }
    }
  } catch (e) {
    console.warn('cache check failed', e);
  }

  try {
    const { data: orderData } = await supabaseAdmin.from('orders').select('*').eq('id', id).single();
    const { data: filesData } = await supabaseAdmin.from('order_files').select('*').eq('order_id', id).order('id', { ascending: true });
    const files = filesData || [];

    // determine numPrints
    let numPrints = 10;
    if (orderData?.deal_title) {
      const digits = (orderData.deal_title.match(/\d+/) || [])[0];
      if (digits) numPrints = parseInt(digits, 10);
    }
    if (!numPrints) {
      const sumQty = files.reduce((s: number, f: any) => s + (f.quantity ?? 1), 0);
      numPrints = sumQty > 0 ? sumQty : 10;
    }

    // build image URL list expanded by quantity
    const imgs: string[] = [];
    for (const f of files) {
      const q = f.quantity ?? 1;
      for (let i = 0; i < q; i++) imgs.push(f.file_url);
    }
    if (imgs.length === 0 && files[0]) imgs.push(files[0].file_url);
    while (imgs.length < numPrints) imgs.push(imgs[0]);
    if (imgs.length > numPrints) imgs.length = numPrints;

    // fixed 10-per-page layout
    const perPage = 10;
    const pageIndex = Math.max(0, parseInt(page as string, 10) - 1);
    const cacheKey = `order_pages/${id}/page-${pageIndex + 1}.png`;
    const pagesNeeded = Math.max(1, Math.ceil(imgs.length / perPage));
    if (pageIndex >= pagesNeeded) return res.status(400).send('page out of range');

    const pageImgs = imgs.slice(pageIndex * perPage, pageIndex * perPage + perPage);

    // A4 in points -> convert to pixels for DPI
    const A4_W_PT = mmToPt(210);
    const A4_H_PT = mmToPt(297);
    const marginMM = 3;
    const marginPt = mmToPt(marginMM);

    const cols = 2;
    const rows = 5; // fixed

    const cellWPt = (A4_W_PT - marginPt * 2) / cols;
    const cellHPt = (A4_H_PT - marginPt * 2) / rows;
    const paddingPt = Math.min(cellWPt, cellHPt) * 0.02;

    const widthPx = Math.round((A4_W_PT / 72) * DPI);
    const heightPx = Math.round((A4_H_PT / 72) * DPI);
    const marginPx = Math.round((marginPt / 72) * DPI);
    const cellWPx = Math.floor((widthPx - marginPx * 2) / cols);
    const cellHPx = Math.floor((heightPx - marginPx * 2) / rows);
    const paddingPx = Math.round(Math.min(cellWPx, cellHPx) * 0.02);

    // create base white canvas
    const base = sharp({ create: { width: widthPx, height: heightPx, channels: 3, background: '#ffffff' } });

    const composites: { input: Buffer; left: number; top: number }[] = [];

    for (let i = 0; i < perPage; i++) {
      const url = pageImgs[i];
      if (!url) continue;
      try {
        const fetched = await fetch(url);
        if (!fetched.ok) throw new Error('fetch failed');
        const arrayBuffer = await fetched.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const img = sharp(buffer);
        const meta = await img.metadata();
        const w = meta.width ?? 0;
        const h = meta.height ?? 0;
        const sizeCrop = Math.max(1, Math.min(w || 1, h || 1));
        const leftCrop = Math.floor((w - sizeCrop) / 2);
        const topCrop = Math.floor((h - sizeCrop) / 2);

        // target pixel size = targetSizePt * DPI/72
        const targetSizePt = Math.min(cellWPt - paddingPt * 2, cellHPt - paddingPt * 2);
        const targetPx = Math.max(1, Math.round((targetSizePt / 72) * DPI));

        const squareBuf = await img.extract({ left: leftCrop, top: topCrop, width: sizeCrop, height: sizeCrop }).resize(targetPx, targetPx).png().toBuffer();

        const col = i % cols;
        const row = Math.floor(i / cols);

        const left = marginPx + col * cellWPx + Math.floor((cellWPx - targetPx) / 2);
        const top = marginPx + row * cellHPx + Math.floor((cellHPx - targetPx) / 2);

        composites.push({ input: squareBuf, left, top });
      } catch (err) {
        // skip
        continue;
      }
    }

    const out = await base.composite(composites).png().toBuffer();

    // Attempt to upload to cache bucket (best-effort)
    try {
      await supabaseAdmin.storage.from(CACHE_BUCKET).upload(cacheKey, out, { contentType: 'image/png', upsert: true });
    } catch (uploadErr) {
      console.warn('failed to upload page cache', uploadErr);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(out);
  } catch (err: any) {
    console.error('order-page error', err);
    return res.status(500).send(err?.message || 'failed');
  }
}
