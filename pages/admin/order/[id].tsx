import React, { useEffect, useState, useRef } from 'react';
import { GetServerSideProps } from 'next';
import Link from 'next/link';
import AdminLayout from '../../../components/AdminLayout';
import { createClient } from '@supabase/supabase-js';

// small internal helper to close modal on Escape key
function EscapeCloser({ onClose }: { onClose: () => void }) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return null;
}

type OrderRow = {
  id: string;
  qr_code?: string | null;
  full_name?: string | null;
  phone_number?: string | null;
  deal_id?: string | null;
  deal_title?: string | null;
  total_price?: string | number | null;
  status?: string | null;
  created_at?: string | null;
};

function StatusBadge({ status }: { status: string | null }) {
  const s = status || 'pending';
  let label = 'Pending';
  let cls = 'bg-gray-100 text-gray-800';
  if (s === 'ready') {
    label = 'Ready to receive';
    cls = 'bg-yellow-100 text-yellow-900';
  } else if (s === 'completed') {
    label = 'Already received';
    cls = 'bg-green-100 text-green-900';
  } else if (s === 'cancelled') {
    label = 'Cancelled';
    cls = 'bg-red-100 text-red-900';
  }
  return (
    <div className={`${cls} px-3 sm:px-4 py-1 sm:py-2 rounded-full text-sm sm:text-base font-bold shadow-sm inline-flex items-center whitespace-nowrap`}>
      {label}
    </div>
  );
}

function StatusActions({ status, updating, onChange }: { status: string | null; updating: boolean; onChange: (s: string) => void }) {
  const s = status || 'pending';
  if (updating) return <button className="inline-flex items-center justify-center h-9 px-3 rounded-md text-sm border">Updating…</button>;

  const base = 'inline-flex items-center justify-center h-9 px-3 rounded-md text-sm font-medium';
  const primary = `${base} text-white`;
  const green = `${primary} bg-green-600 hover:bg-green-700`;
  const yellow = `${primary} bg-[#FFD600] text-black hover:bg-yellow-400`;
  const outline = `${base} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`;
  const danger = `${base} border border-red-600 text-red-600 hover:bg-red-50`;

  // Ready: show Undo, primary 'Already Received', Cancel
  if (s === 'ready') {
    return (
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <button onClick={() => onChange('pending')} className={outline} aria-label="Undo status">Undo</button>
        <button onClick={() => onChange('completed')} className={green} aria-label="Mark as received">Already Received</button>
      </div>
    );
  }

  // Completed: show label, Undo (reopen), Cancel
  if (s === 'completed') {
    return (
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div className="text-sm text-green-700 font-semibold px-3 py-1 rounded bg-green-50">Completed</div>
        <button onClick={() => onChange('ready')} className={outline} aria-label="Undo completed">Undo</button>
      </div>
    );
  }

  // Cancelled: show label + Undo
  if (s === 'cancelled') {
    return (
      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
        <div className="text-sm text-red-700 font-semibold px-3 py-1 rounded bg-red-50">Cancelled</div>
        <button onClick={() => onChange('pending')} className={outline} aria-label="Undo cancelled">Undo</button>
      </div>
    );
  }

  // Pending/default: Mark Ready + Cancel
  return (
    <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
      <button onClick={() => onChange('ready')} className={yellow} aria-label="Mark ready">Mark Ready</button>
      <button onClick={() => onChange('cancelled')} className={danger} aria-label="Cancel order">Cancel</button>
    </div>
  );
}

export default function OrderPage({ order, files }: { order: OrderRow | null; files: any[] }) {
  
  const [previewReady, setPreviewReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [numPrints, setNumPrints] = useState<number | null>(null);
  const [previewPages, setPreviewPages] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPreviewPage, setCurrentPreviewPage] = useState(0);
  const [modalImageLoading, setModalImageLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const downloadTimerRef = useRef<number | null>(null);
  const [orderStatus, setOrderStatus] = useState<string | null>(order?.status ?? null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // change order status helper used by StatusActions in two places
  async function changeOrderStatus(newStatus: string) {
    if (!order?.id) return;
    if (newStatus === 'cancelled' && !confirm('Cancel this order? This cannot be undone.')) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch('/api/admin/update-order-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id, status: newStatus }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j?.error || 'Failed to update status');
      } else {
        setOrderStatus(newStatus);
      }
    } catch (err) {
      console.error('status update failed', err);
      alert('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  }

  // files UI/management removed from redesigned page

  // Prevent background page scrolling while modal is open
  useEffect(() => {
    if (!isModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isModalOpen]);

  // no local sidebar state — main AdminLayout controls the global sidebar

  // Clear any pending download timer on unmount
  useEffect(() => {
    return () => {
      if (downloadTimerRef.current) {
        clearTimeout(downloadTimerRef.current);
        downloadTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!order) return;
    // try to parse number of prints from deal title (e.g. "10 Stickers")
    const digits = order.deal_title ? (order.deal_title.match(/\d+/) || [])[0] : undefined;
    if (digits) {
      setNumPrints(parseInt(digits, 10));
    } else {
      const sumQty = files?.reduce((s: number, f: any) => s + (f.quantity ?? 1), 0) || 0;
      setNumPrints(sumQty > 0 ? sumQty : 10);
    }
    // sync status from server-provided order
    setOrderStatus(order?.status ?? null);
  }, [order, files]);

  async function generatePreview() {
    if (!order || !numPrints) return;
    setGenerating(true);
    try {
      // build list of image URLs according to quantity
      const imgs: string[] = [];
      for (const f of files) {
        const qty = f.quantity ?? 1;
        for (let i = 0; i < qty; i++) imgs.push(f.file_url);
      }
      // ensure length matches numPrints
      if (imgs.length === 0) imgs.push(files?.[0]?.file_url || '');
      while (imgs.length < numPrints) imgs.push(imgs[0]);
      if (imgs.length > numPrints) imgs.length = numPrints;

      // Pagination: 10 stickers per page, 2 columns x 5 rows
      const perPage = 10;
      const pagesNeeded = Math.max(1, Math.ceil(imgs.length / perPage));
      const pages: string[] = [];
      for (let p = 0; p < pagesNeeded; p++) {
        pages.push(`/api/admin/order-page?id=${encodeURIComponent(order.id)}&page=${p + 1}&dpi=150`);
      }

      setPreviewPages(pages);
      setCurrentPreviewPage(0);
      setPreviewReady(true);
      setIsModalOpen(true);
      // set image loading until the server-rendered page image finishes loading
      setModalImageLoading(true);
    } catch (err) {
      console.error('preview generation failed', err);
      alert('Failed to generate preview.');
    } finally {
      setGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!order?.id) {
      alert('Missing order id');
      return;
    }
    // Use direct navigation / anchor click so the browser handles download (more reliable than fetch+blob)
    try {
      setDownloadingPdf(true);
      const url = `/api/admin/order-pdf?id=${encodeURIComponent(order.id)}`;
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = `order_${order.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (downloadTimerRef.current) clearTimeout(downloadTimerRef.current);
      // best-effort: clear downloading indicator after a short timeout
      downloadTimerRef.current = window.setTimeout(() => setDownloadingPdf(false), 5000);
    } catch (err) {
      console.error('pdf download failed', err);
      setDownloadingPdf(false);
      alert('Failed to trigger PDF download.');
    }
  }
  function formatDate(dt?: string | null) {
    if (!dt) return '';
    try {
      const d = new Date(dt);
      const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `${date} - ${time}`;
    } catch (e) {
      return dt || '';
    }
  }

  if (!order) return (
    <AdminLayout>
      <div className="p-6">Order not found</div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <div className="mb-2">
              <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Back to Dashboard</Link>
            </div>
            <h1 className="text-xl font-bold mb-1 break-words">Order {order.qr_code}</h1>
            <div className="text-sm text-gray-600">{formatDate(order.created_at)}</div>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
              <div className="flex items-center gap-3">
                <div className="text-sm text-gray-500 hidden sm:block">Status</div>
                <StatusBadge status={orderStatus} />
              </div>

              <div>
                <StatusActions status={orderStatus} updating={updatingStatus} onChange={changeOrderStatus} />
              </div>
          </div>
        </div>
        {/* mobile details slide-over removed; using global sidebar from AdminLayout */}

        {/* top customer/deal summary removed — sidebar contains this info */}

        {/* files list removed — preview modal will show the layout */}
        
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow order-last lg:order-first">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Preview & Files</h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <button onClick={generatePreview} disabled={generating} className="bg-[#FFD600] text-black px-3 py-2 rounded w-full sm:w-auto">
                  {generating ? 'Generating…' : 'Generate Preview'}
                </button>
                <button onClick={downloadPdf} disabled={!previewReady || downloadingPdf} className="border px-3 py-2 rounded w-full sm:w-auto">
                  {downloadingPdf ? 'Downloading…' : 'Download PDF'}
                </button>
              </div>
            </div>

            <div className="mb-6">
              <div className="w-full border rounded p-4 bg-gray-50 flex items-center justify-center min-h-[220px]">
                {previewReady && previewPages.length > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewPages[currentPreviewPage]} alt={`preview-${currentPreviewPage + 1}`} className="max-h-[60vh] w-auto mx-auto" />
                ) : (
                  <div className="text-sm text-gray-500">No preview generated yet. Click "Generate Preview".</div>
                )}
              </div>
            </div>

            {/* files display removed per request */}
          </div>

          <aside className="order-first lg:order-last bg-white rounded-2xl p-6 shadow">
            <div className="mb-4">
              <div className="text-sm text-gray-500">Customer</div>
              <div className="font-medium">{order.full_name}</div>
              <div className="text-sm text-gray-500 mt-3">Deal</div>
              <div className="font-medium">{order.deal_title}</div>
              <div className="text-sm text-gray-500 mt-3">Phone</div>
              <div className="font-medium">{order.phone_number || '-'}</div>
              <div className="text-sm text-gray-500 mt-3">Total</div>
              <div className="font-medium">{order.total_price ? `₱${order.total_price}` : '-'}</div>
              <div className="text-sm text-gray-500 mt-3">Created</div>
              <div className="text-sm text-gray-600">{formatDate(order.created_at)}</div>
            </div>
          </aside>
        </div>
        {isModalOpen && (
          <div onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }} className="fixed inset-0 z-50 grid place-items-center bg-black/40 overflow-hidden">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-auto">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b">
                  <div className="font-semibold">Preview — Page {currentPreviewPage + 1} / {previewPages.length}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setIsModalOpen(false)} className="px-3 py-1 border rounded">Close</button>
                    <button onClick={() => downloadPdf()} className="px-3 py-1 bg-[#FFD600] rounded">Download PDF</button>
                  </div>
                </div>
                <div className="p-4 flex-1 overflow-auto flex flex-col items-center gap-3">
                  <div className={'w-full max-w-[820px] bg-gray-100 shadow-sm rounded overflow-hidden flex items-center justify-center relative min-h-[320px]'}>
                    {/* single page raster rendered by server so it matches PDF */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewPages[currentPreviewPage]}
                      alt={`page-${currentPreviewPage + 1}`}
                      onLoad={() => setModalImageLoading(false)}
                      onError={() => setModalImageLoading(false)}
                      className="max-h-[75vh] w-auto mx-auto block z-0"
                    />
                    {modalImageLoading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/60 z-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-400 border-t-transparent" />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button onClick={() => { setModalImageLoading(true); setCurrentPreviewPage(p => Math.max(0, p - 1)); }} disabled={currentPreviewPage === 0} className="px-3 py-1 border rounded">Prev</button>
                    <button onClick={() => { setModalImageLoading(true); setCurrentPreviewPage(p => Math.min(previewPages.length - 1, p + 1)); }} disabled={currentPreviewPage === previewPages.length - 1} className="px-3 py-1 border rounded">Next</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* close on Escape */}
        {isModalOpen && (
          <EscapeCloser onClose={() => setIsModalOpen(false)} />
        )}
      </div>
    </AdminLayout>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const { id } = ctx.params as any;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return { props: { order: null, files: [] } };

  const supabaseAdmin = createClient(supabaseUrl, serviceRole);
  try {
    const { data: orderData } = await supabaseAdmin.from('orders').select('*').eq('id', id).single();
    const { data: filesData } = await supabaseAdmin.from('order_files').select('*').eq('order_id', id).order('id', { ascending: true });
    return { props: { order: orderData ?? null, files: filesData ?? [] } };
  } catch (e) {
    console.warn('order page ssr error', e);
    return { props: { order: null, files: [] } };
  }
};
