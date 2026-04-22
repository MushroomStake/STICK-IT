import { createClient } from '@supabase/supabase-js';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req: any) {
  return new Promise<{ fields: formidable.Fields; files: formidable.Files }>((resolve, reject) => {
    try {
      // handle different import shapes (CJS default, ESM default, or named exports)
      const mod: any = formidable as any;
      const factory = mod.default ?? mod;

      // If the module exposes a top-level `parse` function (older shape), use it directly
      if (typeof factory.parse === 'function' && factory.parse.length >= 2) {
        return factory.parse(req, (err: any, fields: formidable.Fields, files: formidable.Files) => {
          if (err) return reject(err);
          resolve({ fields, files });
        });
      }

      let parser: any = null;

      // If factory is a function, try calling it (formidable()) which returns a parser instance
      if (typeof factory === 'function') {
        try {
          parser = factory();
        } catch (e) {
          // if calling fails, maybe factory is a constructor or has IncomingForm
          if (typeof factory.IncomingForm === 'function') {
            parser = new factory.IncomingForm();
          } else {
            parser = new (factory as any)();
          }
        }
      } else if (factory && typeof factory.IncomingForm === 'function') {
        parser = new factory.IncomingForm();
      }

      if (!parser) return reject(new Error('Unsupported formidable import shape'));

      // parser should expose a `parse` method
      if (typeof parser.parse === 'function') {
        parser.parse(req, (err: any, fields: formidable.Fields, files: formidable.Files) => {
          if (err) return reject(err);
          resolve({ fields, files });
        });
        return;
      }

      // fallback: event-emitter style parser
      if (typeof parser.on === 'function') {
        const fields: any = {};
        const files: any = {};
        parser.on('field', (name: string, value: any) => {
          fields[name] = value;
        });
        parser.on('file', (name: string, fileObj: any) => {
          files[name] = fileObj;
        });
        parser.on('error', (err: any) => reject(err));
        parser.on('end', () => resolve({ fields, files }));
        // start parsing if parser exposes parse
        parser.parse?.(req);
        return;
      }

      return reject(new Error('Formidable parser has no parse/on methods'));
    } catch (err) {
      return reject(err);
    }
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return res.status(500).json({ error: 'Supabase service key not configured on server' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRole);

    const { fields, files } = await parseForm(req);

    // try common file keys
    let file: any = (files as any)?.file || (files as any)?.image || null;
    if (!file) {
      // pick the first file object if present
      const fileKeys = Object.keys(files || {});
      if (fileKeys.length > 0) file = (files as any)[fileKeys[0]];
    }

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // formidable may return arrays for multiple files
    if (Array.isArray(file)) file = file[0];

    const filepath = file.filepath || file.filePath || file.path;
    if (!filepath) return res.status(400).json({ error: 'Uploaded file missing path' });

    const buffer = await fs.promises.readFile(filepath);
    const id = (fields as any)?.id ?? `${Date.now()}`;
    const original = file.originalFilename || file.newFilename || file.filename || 'upload';
    const safeName = `${id}_${String(original).replace(/[^a-zA-Z0-9_.-]/g, '_')}`;
    const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'stickit-uploads';

    // allow the client to request overwriting an existing object (useful for
    // in-place customization saves). Default is no-overwrite to avoid
    // accidental replacements. Be tolerant of different shapes returned by
    // formidable (string, boolean, or array).
    const rawOverwrite = (fields as any)?.overwrite;
    let overwrite = false;
    try {
      if (rawOverwrite === true) overwrite = true;
      else if (typeof rawOverwrite === 'string') overwrite = rawOverwrite === '1' || rawOverwrite.toLowerCase() === 'true';
      else if (Array.isArray(rawOverwrite)) overwrite = rawOverwrite.some((v) => String(v) === '1' || String(v).toLowerCase() === 'true');
      else overwrite = false;
    } catch (e) {
      overwrite = false;
    }

    // log helpful debug info to help diagnose 409 conflicts in production
    console.debug('[upload] safeName=', safeName, 'id=', id, 'original=', original, 'overwrite=', overwrite, 'bucket=', bucket);

    const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(safeName, buffer, {
      contentType: file.mimetype || file.type || undefined,
      cacheControl: '3600',
      upsert: !!overwrite,
    });

    if (uploadError) {
      console.error('Supabase upload error', uploadError);
      return res.status(500).json({ error: uploadError.message || 'Storage upload failed' });
    }

    // try to get a public URL; if bucket is private, create a signed URL fallback
    const { data: publicData } = supabaseAdmin.storage.from(bucket).getPublicUrl(safeName) as any;
    let publicUrl = (publicData as any)?.publicUrl ?? null;

    if (!publicUrl) {
      try {
        const { data: signedData, error: signedError } = await supabaseAdmin.storage.from(bucket).createSignedUrl(safeName, 60 * 60);
        if (!signedError && (signedData as any)?.signedUrl) {
          publicUrl = (signedData as any).signedUrl;
        }
      } catch (e) {
        console.warn('createSignedUrl failed', e);
      }
    }

    return res.status(200).json({ publicUrl, path: safeName });
  } catch (err) {
    console.error('Upload handler error', err);
    // ensure we return JSON so client doesn't try to parse HTML
    const message = (err && (err as any).message) ? (err as any).message : 'Upload failed';
    return res.status(500).json({ error: message });
  }
}
