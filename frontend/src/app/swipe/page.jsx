'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getDeck, swipe as apiSwipe, undoSwipe, getSwipesRemaining } from '../../api/swipe';
import { getMe } from '../../api/auth';
import SwipeCard from '../../components/swipe/SwipeCard';
import AdSlot from '../../components/common/AdSlot';
import OnboardingTour from '../../components/common/OnboardingTour';
import toast from 'react-hot-toast';
import Link from 'next/link';

// ── Lightweight inline confetti (no npm install required) ─────────────────────
function fireConfetti() {
  if (typeof window === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#ec4899', '#a855f7', '#f97316', '#facc15', '#34d399', '#60a5fa', '#f472b6'];
  const particles = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 80,
    r: 4 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    vx: (Math.random() - 0.5) * 4,
    vy: 3 + Math.random() * 4,
    spin: (Math.random() - 0.5) * 0.3,
    angle: Math.random() * Math.PI * 2,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));

  let frame;
  let t = 0;
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      p.vy += 0.12;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
      }
      ctx.restore();
    });
    t++;
    if (t < 180) {
      frame = requestAnimationFrame(animate);
    } else {
      cancelAnimationFrame(frame);
      canvas.remove();
    }
  };
  frame = requestAnimationFrame(animate);
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
];

const CONVERSATION_STARTERS = [
  "What's the last trip you took that genuinely surprised you?",
  "If you could have dinner with anyone — alive or not — who would it be?",
  "What's something you're weirdly passionate about?",
  "What does your perfect Sunday look like?",
  "What's a skill you've always wanted to learn but haven't yet?",
  "What's the best advice you've ever received?",
  "If you had a month off with no obligations, what would you do?",
  "What's something that always makes you laugh no matter what?",
];

export default function SwipePage() {
  const router = useRouter();
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [swipesRemaining, setSwipesRemaining] = useState(50);
  const [matched, setMatched] = useState(null);
  const [starter, setStarter] = useState('');
  const [swipeCount, setSwipeCount] = useState(0);
  const [showAd, setShowAd] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const undoTimerRef = useRef(null);

  const [filters, setFilters] = useState({ state: '', minAge: 18, maxAge: 50 });
  const [pendingFilters, setPendingFilters] = useState({ state: '', minAge: 18, maxAge: 50 });

  const loadDeck = useCallback(async (activeFilters) => {
    setLoading(true);
    try {
      const [deckRes, remainRes] = await Promise.all([
        getDeck(activeFilters || filters),
        getSwipesRemaining(),
      ]);
      setDeck(deckRes.data.profiles);
      setSwipesRemaining(remainRes.data.remaining);
    } catch {
      toast.error('Could not load profiles');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    getMe()
      .then((res) => {
        if (!res.data?.display_name) setProfileIncomplete(true);
        loadDeck();
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSwipe = async (targetUserId, direction) => {
    if (!targetUserId) return;
    setDeck((prev) => prev.filter((p) => p.id !== targetUserId));
    setSwipeCount((c) => c + 1);

    setCanUndo(true);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setCanUndo(false), 30000);

    try {
      const res = await apiSwipe(targetUserId, direction);
      setSwipesRemaining(res.data.swipesRemaining);
      if (res.data.matched) {
        setMatched(res.data.matchId);
        setStarter(CONVERSATION_STARTERS[Math.floor(Math.random() * CONVERSATION_STARTERS.length)]);
        fireConfetti();
      }
      if ((swipeCount + 1) % 5 === 0) {
        setShowAd(true);
        setTimeout(() => setShowAd(false), 3000);
      }
      if (deck.length <= 2) {
        const newDeck = await getDeck(filters);
        setDeck((prev) => [
          ...prev.filter((p) => p.id !== targetUserId),
          ...newDeck.data.profiles,
        ]);
      }
    } catch (err) {
      if (err.response?.status === 429) {
        toast.error('Daily swipe limit reached! Come back tomorrow.');
      }
    }
  };

  const handleUndo = async () => {
    try {
      const res = await undoSwipe();
      if (res.data.profile) {
        setDeck((prev) => [...prev, res.data.profile]);
        toast.success('Swipe undone!');
      }
      setCanUndo(false);
      clearTimeout(undoTimerRef.current);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Nothing to undo');
      setCanUndo(false);
    }
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
    setShowFilters(false);
    loadDeck(pendingFilters);
  };

  const clearFilters = () => {
    const f = { state: '', minAge: 18, maxAge: 50 };
    setFilters(f);
    setPendingFilters(f);
    setShowFilters(false);
    loadDeck(f);
  };

  const hasActiveFilters = filters.state || filters.minAge !== 18 || filters.maxAge !== 50;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-pink-500 text-lg animate-pulse">Finding matches near you...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Onboarding tour — shows only on first visit */}
      <OnboardingTour />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 bg-white border-b">
        <h1 className="text-xl font-black text-pink-600">Walk Up &amp; Talk</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{swipesRemaining} left</span>
          <button
            onClick={() => { setPendingFilters(filters); setShowFilters(true); }}
            className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-full font-medium transition flex items-center gap-1">
            🎛️ Filter
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-pink-500 rounded-full ml-1" />
            )}
          </button>
        </div>
      </div>

      {/* Profile incomplete banner */}
      {profileIncomplete && (
        <div className="mx-4 mt-3 bg-pink-50 border border-pink-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-pink-700">Complete your profile to appear in searches</p>
            <p className="text-xs text-pink-500 mt-0.5">Add your name, age, and a photo to start matching.</p>
          </div>
          <Link href="/profile/setup"
            className="shrink-0 bg-pink-500 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-pink-600 transition">
            Set Up →
          </Link>
        </div>
      )}

      <div className="px-4 py-2"><AdSlot slot="banner" /></div>

      {/* Swipe card area */}
      <div className="relative mx-auto max-w-sm px-4" style={{ height: '60vh' }}>
        {deck.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4">
            <div className="text-6xl">🌊</div>
            <h3 className="text-xl font-bold text-gray-700">You've seen everyone!</h3>
            <p className="text-gray-500 text-sm">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more people.'
                : 'Check back later for new profiles.'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-pink-500 font-semibold text-sm hover:underline">
                Clear filters
              </button>
            )}
            <button
              onClick={() => loadDeck()}
              className="bg-pink-500 text-white px-6 py-2 rounded-full font-medium hover:bg-pink-600 transition">
              Refresh
            </button>
          </div>
        ) : (
          deck.slice(-3).map((profile, idx) => (
            <div key={profile.id} style={{ zIndex: idx }}>
              <SwipeCard
                profile={profile}
                onLike={(id) => handleSwipe(id, 'like')}
                onPass={(id) => handleSwipe(id, 'pass')}
              />
            </div>
          ))
        )}
      </div>

      {/* Action buttons */}
      {deck.length > 0 && (
        <div className="flex justify-center items-center gap-5 mt-4">
          <button
            onClick={() => handleSwipe(deck[deck.length - 1]?.id, 'pass')}
            className="w-16 h-16 bg-white rounded-full shadow-lg flex items-center justify-center text-3xl hover:scale-110 transition border border-gray-100">
            ✖️
          </button>

          {canUndo && (
            <button
              onClick={handleUndo}
              title="Undo last swipe (30s window)"
              className="w-12 h-12 bg-yellow-50 border-2 border-yellow-400 rounded-full flex items-center justify-center text-xl hover:scale-110 transition font-bold text-yellow-600">
              ↩
            </button>
          )}

          <button
            onClick={() => handleSwipe(deck[deck.length - 1]?.id, 'like')}
            className="w-16 h-16 bg-pink-500 rounded-full shadow-lg flex items-center justify-center text-3xl hover:scale-110 transition">
            ❤️
          </button>
        </div>
      )}

      {showAd && <div className="px-4 mt-4"><AdSlot slot="between" /></div>}

      {/* ── Match modal ──────────────────────────────────────────────────────── */}
      {matched && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-black text-pink-600 mb-2">It's a Match!</h2>
            <p className="text-gray-600 mb-4">You have 7 days to make a call or you'll be unmatched.</p>
            <div className="bg-pink-50 border border-pink-100 rounded-2xl p-4 text-left mb-4">
              <p className="text-xs font-bold text-pink-500 uppercase tracking-wide mb-1">💬 Conversation starter</p>
              <p className="text-sm text-gray-700 italic">"{starter}"</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setMatched(null)}
                className="flex-1 border border-gray-300 rounded-xl py-3 font-medium hover:bg-gray-50 transition">
                Keep Swiping
              </button>
              <Link
                href={`/matches/${matched}`}
                onClick={() => setMatched(null)}
                className="flex-1 bg-pink-500 text-white rounded-xl py-3 font-medium text-center hover:bg-pink-600 transition">
                Say Hi! 👋
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter drawer ─────────────────────────────────────────────────────── */}
      {showFilters && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-end"
          onClick={() => setShowFilters(false)}>
          <div
            className="bg-white w-full rounded-t-3xl p-6 pb-10"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-800">Filter Profiles</h2>
              <button
                onClick={() => setShowFilters(false)}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none">
                ×
              </button>
            </div>

            <div className="space-y-6">
              {/* State filter */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">State</label>
                <select
                  value={pendingFilters.state}
                  onChange={(e) => setPendingFilters((f) => ({ ...f, state: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400">
                  <option value="">All states</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Age range */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Age range: <span className="text-pink-600">{pendingFilters.minAge} – {pendingFilters.maxAge}</span>
                </label>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-6">Min</span>
                    <input
                      type="range" min={18} max={pendingFilters.maxAge - 1}
                      value={pendingFilters.minAge}
                      onChange={(e) => setPendingFilters((f) => ({ ...f, minAge: parseInt(e.target.value) }))}
                      className="flex-1 accent-pink-500"
                    />
                    <span className="text-sm font-medium w-6 text-right">{pendingFilters.minAge}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-6">Max</span>
                    <input
                      type="range" min={pendingFilters.minAge + 1} max={80}
                      value={pendingFilters.maxAge}
                      onChange={(e) => setPendingFilters((f) => ({ ...f, maxAge: parseInt(e.target.value) }))}
                      className="flex-1 accent-pink-500"
                    />
                    <span className="text-sm font-medium w-6 text-right">{pendingFilters.maxAge}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-8">
              <button
                onClick={clearFilters}
                className="flex-1 border border-gray-300 rounded-2xl py-3 font-medium text-gray-600 hover:bg-gray-50 transition">
                Clear
              </button>
              <button
                onClick={applyFilters}
                className="flex-1 bg-pink-500 text-white rounded-2xl py-3 font-bold hover:bg-pink-600 transition">
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
