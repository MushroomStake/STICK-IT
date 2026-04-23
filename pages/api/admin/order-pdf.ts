import { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';

function mmToPt(mm: number) {
  return (mm * 72) / 25.4;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query as any;
  if (!id) return res.status(400).send('missing id');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).send('supabase not configured');

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);

  const CACHE_BUCKET = process.env.SUPABASE_CACHE_BUCKET || 'stickit-exports';
  const cacheKey = `order_pdfs/order_${id}.pdf`;

  // Try to serve cached PDF from Supabase storage
  try {
    const { data: cached, error: cachedErr } = await supabaseAdmin.storage.from(CACHE_BUCKET).download(cacheKey);
    if (!cachedErr && cached) {
      // cached may be a Buffer in Node or a Blob-like object
      if (typeof (cached as any).arrayBuffer === 'function') {
        const arr = await (cached as any).arrayBuffer();
        const buf = Buffer.from(arr);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=order_${id}.pdf`);
        return res.send(buf);
      } else if (Buffer.isBuffer(cached)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=order_${id}.pdf`);
        return res.send(cached as Buffer);
      }
    }
  } catch (e) {
    // ignore cache errors, continue to generate
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

    // PDF page sizes (points)
    const A4_W_PT = mmToPt(210);
    const A4_H_PT = mmToPt(297);
    const marginMM = 3; // smaller page margin to maximize printable area
    const marginPt = mmToPt(marginMM);

    // Fixed layout: 10 stickers per page, 2 columns x 5 rows
    const cols = 2;
    const perPage = 10;
    const rows = perPage / cols; // 5

    const cellW = (A4_W_PT - marginPt * 2) / cols;
    const cellH = (A4_H_PT - marginPt * 2) / rows;
    // reduce padding and use square cells for images to maximize coverage
    const paddingPt = Math.min(cellW, cellH) * 0.02;

    const pdfDoc = await PDFDocument.create();
    const DPI = 150; // target resolution for embedded images (pixels per inch)

    const pagesNeeded = Math.max(1, Math.ceil(numPrints / perPage));

    for (let p = 0; p < pagesNeeded; p++) {
      const page = pdfDoc.addPage([A4_W_PT, A4_H_PT]);

      for (let i = 0; i < perPage; i++) {
        const globalIndex = p * perPage + i;
        if (globalIndex >= imgs.length) break;
        const url = imgs[globalIndex];

        // fetch image bytes and center-crop to 1:1 using sharp
          try {
          const fetched = await fetch(url);
          if (!fetched.ok) throw new Error('failed fetch');
          const arrayBuffer = await fetched.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          let embedded: any;
          try {
            const img = sharp(buffer);
            const meta = await img.metadata();
            const w = meta.width ?? 0;
            const h = meta.height ?? 0;

            // target pixel size based on PDF targetSize (computed below)
            // we'll compute pixelSize after targetSize is known and then resize.
            if (w > 0 && h > 0) {
              const sizeCrop = Math.min(w, h);
              const left = Math.floor((w - sizeCrop) / 2);
              const top = Math.floor((h - sizeCrop) / 2);

              // compute targetSize in points
              const availableW = cellW - paddingPt * 2;
              const availableH = cellH - paddingPt * 2;
              const targetSizePt = Math.min(availableW, availableH);
              const pixelSize = Math.max(1, Math.round(targetSizePt * (DPI / 72)));

              const squareBuf = await img.extract({ left, top, width: sizeCrop, height: sizeCrop }).resize(pixelSize, pixelSize).png().toBuffer();
              embedded = await pdfDoc.embedPng(squareBuf);
            } else {
              const squareBuf = await img.png().toBuffer();
              embedded = await pdfDoc.embedPng(squareBuf);
            }
          } catch (sharpErr) {
            // fallback to embedding original bytes
            const uint8 = new Uint8Array(arrayBuffer);
            const lower = url.split('?')[0].toLowerCase();
            if (lower.endsWith('.png')) {
              embedded = await pdfDoc.embedPng(uint8);
            } else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
              embedded = await pdfDoc.embedJpg(uint8);
            } else {
              try { embedded = await pdfDoc.embedPng(uint8); } catch (e) { embedded = await pdfDoc.embedJpg(uint8); }
            }
          }

          const pageIndex = i;
          const col = pageIndex % cols;
          const row = Math.floor(pageIndex / cols);

          const xCell = marginPt + col * cellW;
          const yCellTop = A4_H_PT - marginPt - row * cellH;

          const availableW = cellW - paddingPt * 2;
          const availableH = cellH - paddingPt * 2;

          // Force square output: use the smaller of availableW/availableH
          const targetSize = Math.min(availableW, availableH);

          // Draw the square image centered inside the cell
          const drawW = targetSize;
          const drawH = targetSize;

          const dx = xCell + (cellW - drawW) / 2;
          const imageTopY = yCellTop - paddingPt - (availableH - drawH) / 2;
          const dy = imageTopY - drawH;

          page.drawImage(embedded, { x: dx, y: dy, width: drawW, height: drawH });
        } catch (err) {
          // skip image on error
          continue;
        }
      }
    }

    const pdfBytes = await pdfDoc.save();

    // Attempt to upload to cache bucket (best-effort)
    try {
      await supabaseAdmin.storage.from(CACHE_BUCKET).upload(cacheKey, Buffer.from(pdfBytes), { contentType: 'application/pdf', upsert: true });
    } catch (uploadErr) {
      console.warn('failed to upload pdf cache', uploadErr);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=order_${id}.pdf`);
    return res.send(Buffer.from(pdfBytes));
  } catch (err: any) {
    console.error('order-pdf error', err);
    return res.status(500).send(err?.message || 'failed');
  }
}
