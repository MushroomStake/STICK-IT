import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Clear the admin cookie
  res.setHeader('Set-Cookie', [`admin_auth=deleted; HttpOnly; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`]);
  return res.status(200).json({ ok: true });
}
