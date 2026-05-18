'use client';
import { useEffect, useState } from 'react';
import { getMatches } from '../../api/matches';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import AdSlot from '../../components/common/AdSlot';

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

  useEffect(() => {
    getMatches().then((res) => setMatches(res.data.matches)).finally(() => setLoading(false));
  }, []);

  const getDeadlineColor = (s) => s < 0 ? 'text-gray-400' : s < 86400 ? 'text-red-500' : s < 259200 ? 'text-orange-500' : 'text-green-500';
  const formatDeadline = (s) => {
    if (s <= 0) return 'Expired';
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    return d > 0 ? `${d}d ${h}h to call` : `${h}h to call`;
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-pulse text-pink-500">Loading matches...</div></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-xl font-bold text-gray-800">Your Matches</h1>
        <p className="text-sm text-gray-500">{matches.length} active match{matches.length !== 1 ? 'es' : ''}</p>
      </div>
      <div className="px-4 py-2"><AdSlot slot="banner" /></div>

      {matches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="text-6xl">💭</div>
          <h3 className="text-xl font-bold text-gray-700">No matches yet</h3>
          <p className="text-gray-500">Keep swiping to find your match!</p>
          <Link href="/swipe" className="bg-pink-500 text-white px-6 py-2 rounded-full font-medium hover:bg-pink-600 transition">Start Swiping</Link>
        </div>
      ) : (
        <div className="divide-y bg-white mt-2">
          {matches.map((match) => (
            <Link key={match.id} href={`/matches/${match.id}`}>
              <div className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition">
                <div className="relative flex-shrink-0">
                  <img src={match.partner_photo ? `${API_BASE}${match.partner_photo}` : '/default-avatar.png'} alt={match.partner_name} className="w-14 h-14 rounded-full object-cover" />
                  {match.unread_count > 0 && <span className="absolute -top-1 -right-1 bg-pink-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">{match.unread_count}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">{match.partner_name}</h3>
                    {match.last_message_at && <span className="text-xs text-gray-400">{formatDistanceToNow(new Date(match.last_message_at), { addSuffix: true })}</span>}
                  </div>
                  {match.last_message ? <p className="text-sm text-gray-500 truncate">{match.last_message}</p> : <p className="text-sm text-pink-500 italic">Say hello! 👋</p>}
                  {!match.call_completed && <p className={`text-xs mt-1 font-medium ${getDeadlineColor(match.seconds_until_deadline)}`}>⏱️ {formatDeadline(match.seconds_until_deadline)}</p>}
                  {match.call_completed && <p className="text-xs mt-1 text-green-500">✅ Call completed</p>}
                </div>
                <span className="text-gray-300">›</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
