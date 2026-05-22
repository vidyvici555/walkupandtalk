'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login as apiLogin, register as apiRegister, getMe } from '../../api/auth';
import toast from 'react-hot-toast';

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState('signin');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [backendDown, setBackendDown] = useState(false);

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpPhone, setSignUpPhone] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('wuag_token');
    if (!token) { setChecking(false); return; }

    getMe()
      .then(() => router.replace('/swipe'))
      .catch((err) => {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          // Server rejected the token — clear it
          localStorage.removeItem('wuag_token');
          localStorage.removeItem('wuag_user');
        } else if (!status) {
          // Network error — backend is down but token might still be valid
          // Keep the token, just show the form
          setBackendDown(true);
        }
        setChecking(false);
      });
  }, [router]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setBackendDown(false);
    try {
      const res = await apiLogin({ email: signInEmail, password: signInPassword });
      localStorage.setItem('wuag_token', res.data.token);
      if (res.data.userId) {
        localStorage.setItem('wuag_user', JSON.stringify({ id: res.data.userId }));
      }
      toast.success('Welcome back!');
      router.push('/swipe');
    } catch (err) {
      if (!err.response) {
        // No response at all = network / CORS error
        setBackendDown(true);
        toast.error('Cannot reach the server. Please try again in a moment.');
      } else {
        toast.error(err.response?.data?.error || 'Incorrect email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (signUpPassword.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    setLoading(true);
    setBackendDown(false);
    try {
      const res = await apiRegister({ email: signUpEmail, password: signUpPassword, phone: signUpPhone });
      localStorage.setItem('wuag_token', res.data.token);
      if (res.data.userId) {
        localStorage.setItem('wuag_user', JSON.stringify({ id: res.data.userId }));
      }
      toast.success("Account created! Let's set up your profile.");
      router.push('/profile/setup');
    } catch (err) {
      if (!err.response) {
        setBackendDown(true);
        toast.error('Cannot reach the server. Please try again in a moment.');
      } else {
        toast.error(err.response?.data?.error || 'Sign up failed — that email may already be registered.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 flex items-center justify-center">
        <div className="text-4xl animate-pulse">💘</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 flex flex-col items-center justify-center px-4 py-10">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">💘</div>
        <h1 className="text-3xl font-black text-pink-600 tracking-tight">Walk Up &amp; Talk</h1>
        <p className="text-gray-500 mt-1 text-sm">Real connections. 100% free. No subscriptions.</p>
      </div>

      {/* Backend-down warning banner */}
      {backendDown && (
        <div className="w-full max-w-sm mb-4 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
          <strong>⚠️ Service temporarily unavailable</strong>
          <p className="mt-1 text-red-600 text-xs">
            We're having trouble connecting to our servers. Please wait a moment and try again.
          </p>
        </div>
      )}

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="flex border-b border-gray-100">
          {['signin', 'signup'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-4 text-sm font-bold tracking-wide transition-colors ${
                tab === t ? 'text-pink-600 border-b-2 border-pink-500 bg-pink-50' : 'text-gray-400 hover:text-gray-600'
              }`}>
              {t === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                <input type="email" autoComplete="email" required value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)} placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Password</label>
                <input type="password" autoComplete="current-password" required value={signInPassword}
                  onChange={(e) => setSignInPassword(e.target.value)} placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <p className="text-center text-sm text-gray-400">
                No account?{' '}
                <button type="button" onClick={() => setTab('signup')} className="text-pink-500 font-semibold hover:underline">Sign up free →</button>
              </p>
            </form>
          )}

          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
                <input type="email" autoComplete="email" required value={signUpEmail}
                  onChange={(e) => setSignUpEmail(e.target.value)} placeholder="you@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Password</label>
                <input type="password" autoComplete="new-password" required value={signUpPassword}
                  onChange={(e) => setSignUpPassword(e.target.value)} placeholder="Min. 8 characters"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Phone <span className="normal-case font-normal text-gray-400">(optional)</span>
                </label>
                <input type="tel" autoComplete="tel" value={signUpPhone}
                  onChange={(e) => setSignUpPhone(e.target.value)} placeholder="+1 555 000 0000"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition active:scale-95">
                {loading ? 'Creating account…' : 'Create Free Account'}
              </button>
              <p className="text-center text-sm text-gray-400">
                Already have an account?{' '}
                <button type="button" onClick={() => setTab('signin')} className="text-pink-500 font-semibold hover:underline">Sign in →</button>
              </p>
            </form>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6 flex-wrap justify-center">
        {['✅ Always free', '🇺🇸 US-wide', '📞 Real calls', '🔒 Safe & verified'].map((b) => (
          <span key={b} className="text-xs text-gray-500 bg-white px-3 py-1.5 rounded-full shadow-sm">{b}</span>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-5 text-center max-w-xs">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
