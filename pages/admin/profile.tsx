import React, { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';

type Profile = {
  id?: string;
  user_id?: string;
  email?: string;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
};

export default function AdminProfilePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/profile', { credentials: 'include' });
      if (!res.ok) {
        const txt = await res.text().catch(() => null);
        console.error('profile fetch non-ok', res.status, txt);
        throw new Error(txt || `Failed to load (${res.status})`);
      }
      const json = await res.json();
      const p = json.profile ?? null;
      setProfile(p);
      setFirstName(p?.first_name ?? '');
      setMiddleName(p?.middle_name ?? '');
      setLastName(p?.last_name ?? '');
      setEmail(json.user?.email ?? '');
    } catch (err: any) {
      console.error('fetch profile error', err);
      setError(err?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null); setError(null);
    try {
      const res = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName, middle_name: middleName, last_name: lastName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setMessage('Profile saved');
      setProfile(json.profile ?? profile);
    } catch (err: any) {
      console.error('save profile error', err);
      setError(err?.message || 'Save failed');
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMessage(null);
    if (!newPassword || newPassword.length < 6) return setPwMessage('Password must be at least 6 characters');
    if (newPassword !== confirmPassword) return setPwMessage('Passwords do not match');
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Change password failed');
      setPwMessage('Password updated');
      setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      console.error('change pw error', err);
      setPwMessage(err?.message || 'Failed to change password');
    }
  }

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-extrabold mb-4">Profile</h1>

        <div className="bg-white rounded-2xl p-6 shadow mb-6">
          <form onSubmit={saveProfile}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">First name</label>
                <input value={firstName} onChange={(e) => setFirstName(e.target.value)} title="First name" placeholder="First name" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Middle name</label>
                <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} title="Middle name" placeholder="Middle name" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Last name</label>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} title="Last name" placeholder="Last name" className="w-full border rounded px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input value={email} readOnly title="Email" placeholder="Email" className="w-full border rounded px-3 py-2 bg-gray-50" />
              </div>
            </div>

            <div className="mt-6 flex items-center gap-3">
              <button type="submit" className="bg-[#FFD600] px-4 py-2 rounded font-medium">Save</button>
              {message && <div className="text-sm text-green-600">{message}</div>}
              {error && <div className="text-sm text-red-600">{error}</div>}
            </div>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow">
          <h2 className="font-semibold mb-3">Change password</h2>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">New password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} title="New password" placeholder="New password" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Confirm password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} title="Confirm password" placeholder="Confirm password" className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="bg-yellow-500 px-4 py-2 rounded">Update password</button>
              {pwMessage && <div className="text-sm text-gray-700">{pwMessage}</div>}
            </div>
          </form>
        </div>
      </div>
    </AdminLayout>
  );
}
