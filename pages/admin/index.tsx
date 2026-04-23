import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import StatsCard from '../../components/StatsCard';
import Link from 'next/link';

type OrderRow = {
  id: string;
  qr_code?: string | null;
  full_name?: string | null;
  created_at?: string | null;
  status?: string | null;
  total_price?: number | null;
  deal_title?: string | null;
};

function getStatusLabel(s?: string | null) {
  if (!s) return 'Pending';
  if (s === 'ready') return 'Ready to receive';
  if (s === 'completed') return 'Already received';
  if (s === 'cancelled') return 'Cancelled';
  return s;
}

function getStatusClasses(s?: string | null) {
  if (!s) return 'bg-gray-100 text-gray-800';
  if (s === 'ready') return 'bg-yellow-100 text-yellow-900';
  if (s === 'completed') return 'bg-green-100 text-green-900';
  if (s === 'cancelled') return 'bg-red-100 text-red-900';
  return 'bg-gray-100 text-gray-800';
}

function StatusPill({ status }: { status?: string | null }) {
  const lbl = getStatusLabel(status);
  const cls = getStatusClasses(status);
  return <span className={`${cls} px-3 py-1 rounded-full text-sm font-semibold`}>{lbl}</span>;
}

export default function AdminIndex() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  
  const [totalOrders, setTotalOrders] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // search debounce
  const [searchTerm, setSearchTerm] = useState('');

  // filters & pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [promoFilter, setPromoFilter] = useState('all');
  const [page, setPage] = useState(1);
  const limit = 5;

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, statusFilter, promoFilter]);

  // debounce searchTerm -> search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  async function fetchOrders() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('limit', String(limit));
      if (search) qs.set('search', search);
      if (statusFilter) qs.set('status', statusFilter);
      if (promoFilter) qs.set('promo', promoFilter);

      const resp = await fetch(`/api/admin/orders?${qs.toString()}`);
      const json = await resp.json();
      if (!resp.ok) {
        console.warn('orders api error', json);
        setOrders([]);
      } else {
        setOrders(json.orders ?? []);
        setTotalOrders(json.totalCount ?? 0);
        setPendingCount(json.pendingCount ?? 0);
        setCompletedCount(json.completedCount ?? 0);
      }
    } catch (e) {
      console.warn('orders fetch failed', e);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  // View navigates to the dedicated order page

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

  function handleExport() {
    const headers = ['Date & Time', 'Customer Name', 'Status', 'Deal', 'Price'];
    const rows = orders.map(o => [formatDate(o.created_at), o.full_name || '', o.status || '', o.deal_title || '', o.total_price ?? '']);
    const csv = [headers.join(','), ...rows.map(r => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stickit_orders_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold">Admin Dashboard</h1>
          <button onClick={handleExport} className="bg-[#FFD600] text-black px-4 py-2 rounded-lg">Export Report</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <StatsCard title="Total Orders" value={totalOrders} />
          <StatsCard title="Total Pending" value={pendingCount} />
          <StatsCard title="Total Completed" value={completedCount} />
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-4">
            <div className="flex-1 w-full flex items-center gap-2">
              <input placeholder="Search invoice or name" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchTerm); }} className="w-full border rounded-lg px-4 py-2" />
              {searchTerm && (
                <button onClick={() => { setSearchTerm(''); setSearch(''); }} className="text-sm text-gray-500 px-2">Clear</button>
              )}
            </div>
            <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="ready">Ready to receive</option>
              <option value="completed">Completed</option>
            </select>
            <select aria-label="Filter by promo" value={promoFilter} onChange={(e) => setPromoFilter(e.target.value)} className="border rounded-lg px-3 py-2">
              <option value="all">All Promo</option>
              <option value="standard">Standard</option>
              <option value="pack">Pack</option>
              <option value="bulk">Bulk</option>
            </select>
          </div>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-3">
            {loading ? (
              <div className="py-6 text-center text-gray-400">Loading…</div>
            ) : orders.length === 0 ? (
              <div className="py-6 text-center text-gray-400">No orders found</div>
            ) : (
              orders.map(o => (
                <Link key={o.id} href={`/admin/order/${o.id}`} className="block bg-gray-50 rounded-lg p-3 shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-500">{formatDate(o.created_at)}</div>
                      <div className="font-medium truncate">{o.full_name}</div>
                      <div className="text-sm text-gray-500 truncate">{o.deal_title}</div>
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      <StatusPill status={o.status} />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-sm text-gray-500">
                  <th className="py-3">Date & Time</th>
                  <th className="py-3">Customer Name</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Promo</th>
                  <th className="py-3">Price</th>
                  <th className="py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">Loading…</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} className="py-8 text-center text-gray-400">No orders found</td></tr>
                ) : (
                  orders.map(order => (
                    <tr key={order.id} className="border-t">
                      <td className="py-4 max-w-[200px] truncate">{formatDate(order.created_at)}</td>
                      <td className="py-4 font-medium max-w-[200px] truncate">{order.full_name}</td>
                      <td className="py-4"><StatusPill status={order.status} /></td>
                      <td className="py-4 max-w-[200px] truncate">{order.deal_title}</td>
                      <td className="py-4">{order.total_price ? `₱${order.total_price}` : '-'}</td>
                      <td className="py-4">
                        <Link href={`/admin/order/${order.id}`} className="text-yellow-600 font-medium">View</Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">Showing {orders.length} results</div>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-3 py-1 border rounded">Previous</button>
              <div className="px-3 py-1">{page}</div>
              <button onClick={() => setPage((p) => p + 1)} className="px-3 py-1 border rounded">Next</button>
            </div>
          </div>
        </div>
      </div>
      
    </AdminLayout>
  );
}
