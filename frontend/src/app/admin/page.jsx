'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import client from '../../api/client';
import toast from 'react-hot-toast';

export default function AdminPage() {
  const router = useRouter();
  const [tab, setTab] = useState('dashboard');
  const [data, setData] = useState({ dashboard: null, users: [], reports: [], signals: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ── Admin login form state ──────────────────────────────────────────────
  const [authed, setAuthed] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  // On mount, check if we already have an admin token
  useEffect(() => {
    const token = localStorage.getItem('wuag_token');
    if (!token) { setLoading(false); return; }
    client.get('/auth/me')
      .then((res) => {
        if (res.data.is_admin) { setAuthed(true); }
        else { setLoading(false); }
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { if (authed) loadData(); }, [authed, tab]);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const res = await client.post('/auth/login', loginForm);
      if (!res.data.isAdmin) {
        toast.error('This account does not have admin access');
        return;
      }
      localStorage.setItem('wuag_token', res.data.token);
      setAuthed(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (tab === 'dashboard') { const r = await client.get('/admin/dashboard'); setData((d) => ({ ...d, dashboard: r.data })); }
      else if (tab === 'users') { const r = await client.get('/admin/users'); setData((d) => ({ ...d, users: r.data.users })); }
      else if (tab === 'reports') { const r = await client.get('/admin/reports'); setData((d) => ({ ...d, reports: r.data.reports })); }
      else if (tab === 'fake') { const r = await client.get('/admin/fake-signals'); setData((d) => ({ ...d, signals: r.data.signals })); }
    } catch (err) { if (err.response?.status === 403) { toast.error('Admin access required'); setAuthed(false); } }
    finally { setLoading(false); }
  };

  const suspendUser = async (id) => { if (!confirm('Suspend this user?')) return; await client.put(`/admin/users/${id}/suspend`, { reason: 'Admin action' }); toast.success('User suspended'); loadData(); };
  const reinstateUser = async (id) => { await client.put(`/admin/users/${id}/reinstate`); toast.success('User reinstated'); loadData(); };
  const reviewReport = async (id, action) => { await client.put(`/admin/reports/${id}/review`, { action }); toast.success(`Report ${action}`); loadData(); };

  // ── Login gate ─────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🛡️</div>
            <h1 className="text-2xl font-bold text-gray-800">Admin Login</h1>
            <p className="text-sm text-gray-500 mt-1">Restricted access</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={loginForm.email}
                onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                placeholder="admin@walkupandgo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 text-sm"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition disabled:opacity-50"
            >
              {loginLoading ? 'Signing in...' : 'Sign In to Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <h1 className="text-xl font-bold text-gray-800">🛡️ Admin Panel</h1>
        <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium">Admin Only</span>
        <button
          onClick={() => { localStorage.removeItem('wuag_token'); setAuthed(false); }}
          className="ml-auto text-sm text-gray-500 hover:text-red-600 transition"
        >
          Sign Out
        </button>
      </div>

      <div className="bg-white border-b flex px-6">
        {['dashboard','users','reports','fake'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition ${tab === t ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'fake' ? 'Fake Profiles' : t}
          </button>
        ))}
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {loading ? <div className="text-center py-20 text-gray-400 animate-pulse">Loading...</div> : (
          <>
            {tab === 'dashboard' && data.dashboard && (
              <div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  {[['Active Users', data.dashboard.stats.totalActiveUsers,'blue'],['Active Matches',data.dashboard.stats.totalActiveMatches,'green'],['Pending Reports',data.dashboard.stats.pendingReports,'red'],['Flagged Accounts',data.dashboard.stats.flaggedAccounts,'orange']].map(([label,val,color]) => (
                    <div key={label} className="bg-white rounded-2xl p-5 shadow-sm border"><p className="text-sm text-gray-500">{label}</p><p className={`text-3xl font-black mt-1 text-${color}-600`}>{val}</p></div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl shadow-sm border p-5">
                  <h3 className="font-semibold text-gray-700 mb-4">Recent Signups</h3>
                  <table className="w-full text-sm"><thead><tr className="text-left text-gray-500 border-b"><th className="pb-2">Email</th><th className="pb-2">Joined</th><th className="pb-2">Status</th></tr></thead>
                    <tbody>{data.dashboard.recentSignups.map((u) => (<tr key={u.id} className="border-b last:border-0"><td className="py-2">{u.email}</td><td className="py-2 text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td><td className="py-2">{u.is_flagged ? <span className="text-red-500 font-medium">⚠️ Flagged</span> : <span className="text-green-500">✅ OK</span>}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-4 border-b"><input className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm" placeholder="Search by email or name..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-gray-500"><th className="px-4 py-3">User</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Reports</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th></tr></thead>
                  <tbody>{data.users.filter((u) => !search || u.email?.includes(search) || u.display_name?.includes(search)).map((u) => (
                    <tr key={u.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="font-medium">{u.display_name || '(no profile)'}</div><div className="text-gray-400 text-xs">{u.email}</div></td>
                      <td className="px-4 py-3 text-gray-500">{u.location_state || '—'}</td>
                      <td className="px-4 py-3">{u.report_count > 0 ? <span className="text-red-500 font-medium">{u.report_count}</span> : '0'}</td>
                      <td className="px-4 py-3">{!u.is_active ? <span className="text-red-500">Suspended</span> : u.is_flagged ? <span className="text-orange-500">⚠️ Flagged</span> : <span className="text-green-500">Active</span>}</td>
                      <td className="px-4 py-3">{u.is_active ? <button onClick={() => suspendUser(u.id)} className="text-red-500 hover:underline text-xs">Suspend</button> : <button onClick={() => reinstateUser(u.id)} className="text-green-500 hover:underline text-xs">Reinstate</button>}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}

            {tab === 'reports' && (
              <div className="space-y-4">
                {data.reports.length === 0 && <p className="text-gray-400 text-center py-12">No pending reports 🎉</p>}
                {data.reports.map((r) => (
                  <div key={r.id} className="bg-white rounded-2xl shadow-sm border p-5">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-medium capitalize">{r.reason?.replace('_',' ')}</span>
                        <p className="mt-2 text-sm"><span className="font-medium">{r.reporter_email}</span> reported <span className="font-medium">{r.reported_name || r.reported_email}</span></p>
                        {r.description && <p className="text-gray-500 text-sm mt-1">"{r.description}"</p>}
                      </div>
                      <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => reviewReport(r.id,'actioned')} className="flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-medium hover:bg-red-600 transition">⚠️ Suspend User</button>
                      <button onClick={() => reviewReport(r.id,'dismissed')} className="flex-1 border border-gray-300 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition">Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'fake' && (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-left text-gray-500"><th className="px-4 py-3">User</th><th className="px-4 py-3">Signal</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Details</th><th className="px-4 py-3">Date</th></tr></thead>
                  <tbody>{data.signals.map((s) => (
                    <tr key={s.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3"><div className="text-xs font-medium">{s.display_name || '(no profile)'}</div><div className="text-xs text-gray-400">{s.email}</div></td>
                      <td className="px-4 py-3 font-mono text-xs text-orange-600">{s.signal_type}</td>
                      <td className="px-4 py-3"><span className={`font-bold ${s.score >= 60 ? 'text-red-500' : 'text-orange-500'}`}>{s.score}</span></td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">{JSON.stringify(s.details)}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
