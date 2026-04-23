import React from 'react';

type OrderRow = {
  id: string;
  qr_code?: string | null;
  full_name?: string | null;
  deal_id?: string | null;
  deal_title?: string | null;
  total_price?: number | string | null;
  status?: string | null;
  created_at?: string | null;
};

type OrderFile = {
  id: number;
  order_id?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  quantity?: number | null;
  remove_background?: boolean | null;
  border?: boolean | null;
  created_at?: string | null;
};

export default function OrderDetailsModal({
  open,
  onClose,
  order,
  files,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  order: OrderRow | null;
  files: OrderFile[];
  loading?: boolean;
}) {
  if (!open) return null;

  function formatDate(dt?: string | null) {
    if (!dt) return '';
    try {
      const d = new Date(dt);
      const date = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
      return `${date} - ${time}`;
    } catch (e) {
      return dt;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-[90%] max-w-3xl bg-white rounded-2xl shadow-lg p-6 z-10">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Order Details</h2>
            <div className="text-sm text-gray-500">{order ? order.qr_code : ''}</div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-sm text-gray-600">
                <div className="font-medium">Customer</div>
                <div>{order?.full_name}</div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="font-medium">Deal</div>
                <div>{order?.deal_title}</div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="font-medium">Total</div>
                <div>{order?.total_price ? `₱${order.total_price}` : '-'}</div>
              </div>
              <div className="text-sm text-gray-600">
                <div className="font-medium">Status</div>
                <div className="flex items-center gap-3">
                  <div className="text-sm">{order?.status}</div>
                  <select
                    aria-label="Change status"
                    defaultValue={order?.status || 'pending'}
                    onChange={async (e) => {
                      const newStatus = e.target.value;
                      try {
                        const res = await fetch('/api/admin/update-order-status', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ orderId: order?.id, status: newStatus }),
                        });
                        if (res.ok) {
                          // reflect locally
                          (order as any).status = newStatus;
                        } else {
                          const json = await res.json();
                          alert(json?.error || 'Failed to update status');
                        }
                      } catch (err) {
                        console.warn('status update failed', err);
                        alert('Failed to update status');
                      }
                    }}
                    className="border rounded px-2 py-1"
                  >
                    <option value="pending">Pending</option>
                    <option value="ready">Ready to receive</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
              <div className="text-sm text-gray-600 col-span-2">
                <div className="font-medium">Created</div>
                <div>{formatDate(order?.created_at)}</div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Files</h3>
              {files.length === 0 ? (
                <div className="text-sm text-gray-500">No files attached</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {files.map((f) => (
                    <div key={f.id} className="flex gap-3 items-center border rounded-lg p-3">
                      <div className="w-20 h-20 bg-gray-100 flex items-center justify-center rounded">
                        {f.file_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.file_url} alt={f.file_name || 'file'} className="max-w-full max-h-full object-contain" />
                        ) : (
                          <div className="text-xs text-gray-400">No preview</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{f.file_name}</div>
                        <div className="text-sm text-gray-500">Qty: {f.quantity ?? 1}</div>
                        <div className="text-sm text-gray-400">Uploaded: {formatDate(f.created_at)}</div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <a href={f.file_url} target="_blank" rel="noreferrer" className="text-sm text-yellow-600">Open</a>
                        <button
                          className="text-sm text-red-600"
                          onClick={async () => {
                            if (!confirm('Delete this file? This will remove the file from storage and database.')) return;
                            try {
                              const res = await fetch('/api/admin/delete-order-file', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: f.id }),
                              });
                              if (res.ok) {
                                // remove from UI
                                const idx = files.findIndex((x) => x.id === f.id);
                                if (idx >= 0) files.splice(idx, 1);
                                // force re-render
                                (onClose as any)();
                              } else {
                                const json = await res.json();
                                alert(json?.error || 'Failed to delete file');
                              }
                            } catch (err) {
                              console.warn('delete-order-file failed', err);
                              alert('Failed to delete file');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
