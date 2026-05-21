'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getMatch, getMessages, sendMessage, markCallCompleted, blockMatch } from '../../../api/matches';
import { useWebRTC } from '../../../hooks/useWebRTC';
import CallOverlay from '../../../components/call/CallOverlay';
import { formatDistanceToNow } from 'date-fns';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

import { photoUrl as resolvePhoto } from '../../../lib/photoUrl';
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

const STARTERS = [
  "What's something that always makes you laugh?",
  "If you could go anywhere right now, where would it be?",
  "What's your go-to weekend activity?",
  "What's the last show you binged?",
  "Morning person or night owl?",
  "What's a skill you're secretly proud of?",
];

export default function ChatPage() {
  const { matchId } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const menuRef = useRef(null);
  const [starter] = useState(() => STARTERS[Math.floor(Math.random() * STARTERS.length)]);

  useEffect(() => {
    const token = localStorage.getItem('wuag_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (!matchId) return;
    Promise.all([getMatch(matchId), getMessages(matchId)]).then(([mRes, msgRes]) => {
      setMatch(mRes.data);
      setMessages(msgRes.data.messages);
    });
  }, [matchId]);

  // Socket: incoming messages + read receipts
  useEffect(() => {
    if (!userId || !matchId) return;
    const token = localStorage.getItem('wuag_token');
    socketRef.current = io(BACKEND_URL, { auth: { token } });
    socketRef.current.emit('join_match_room', matchId);

    socketRef.current.on('new_message', (msg) => {
      setMessages((prev) => [...prev, msg]);
      // Notify sender their message was read (we're looking at this chat)
      socketRef.current?.emit('message_read', { matchId, messageId: msg.id });
    });

    socketRef.current.on('message_read', ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, is_read: true } : m))
      );
    });

    socketRef.current.on('match_expired', () =>
      toast.error('This match expired — no call was made within 7 days.')
    );

    // Mark all existing unread messages as read when chat opens
    socketRef.current.emit('mark_all_read', { matchId });

    return () => {
      socketRef.current?.emit('leave_match_room', matchId);
      socketRef.current?.disconnect();
    };
  }, [userId, matchId]);

  // Mark messages as read when they appear on screen
  useEffect(() => {
    if (!socketRef.current || messages.length === 0 || !userId) return;
    const unreadFromPartner = messages.filter(
      (m) => m.sender_id !== userId && !m.is_read
    );
    unreadFromPartner.forEach((m) => {
      socketRef.current?.emit('message_read', { matchId, messageId: m.id });
    });
    setMessages((prev) =>
      prev.map((m) =>
        m.sender_id !== userId && !m.is_read ? { ...m, is_read: true } : m
      )
    );
  }, [messages.length, userId, matchId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(matchId, input.trim());
      setInput('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleBlock = async () => {
    if (!confirm(`Block ${match?.partner_name}? They won't be shown to you again. This match will end.`)) return;
    setBlocking(true);
    try {
      await blockMatch(matchId);
      toast.success(`${match?.partner_name} has been blocked.`);
      router.push('/matches');
    } catch {
      toast.error('Could not block user');
      setBlocking(false);
    }
  };

  const handleCallCompleted = useCallback(async (durationSeconds = 0) => {
    if (durationSeconds < 120) {
      toast.error(`Call too short — ${120 - durationSeconds}s more needed.`);
      return;
    }
    if (match?.call_completed) return;
    try {
      const res = await markCallCompleted(matchId, durationSeconds);
      if (res.data.secured) {
        setMatch((m) => (m ? { ...m, call_completed: true } : m));
        toast.success('🎉 Call completed! Your match is secured.');
      }
    } catch {}
  }, [matchId, match?.call_completed]);

  const webrtc = useWebRTC({
    matchId, userId, partnerId: match?.partner_id, onCallCompleted: handleCallCompleted,
  });

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center animate-pulse text-pink-500">
        Loading...
      </div>
    );
  }

  const partnerPhoto = resolvePhoto(match.partner_photo);
  const hoursLeft = match.seconds_until_deadline > 0
    ? Math.floor(match.seconds_until_deadline / 3600)
    : 0;
  const daysLeft = Math.floor(hoursLeft / 24);
  const isUrgent = hoursLeft < 48 && !match.call_completed;
  const isExpiring = hoursLeft < 24 && !match.call_completed;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b shadow-sm">
        <button
          onClick={() => router.push('/matches')}
          className="p-1 rounded-full hover:bg-gray-100 transition text-gray-600 text-xl mr-1">
          ‹
        </button>
        <img
          src={partnerPhoto}
          alt={match.partner_name}
          className="w-10 h-10 rounded-full object-cover"
        />
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-800">{match.partner_name}</h2>
          {!match.call_completed && (
            <p className={`text-xs font-medium ${isExpiring ? 'text-red-500' : isUrgent ? 'text-orange-500' : 'text-gray-400'}`}>
              ⏱️ {daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h` : `${hoursLeft}h`} left to call
            </p>
          )}
          {match.call_completed && (
            <p className="text-xs text-green-500 font-medium">✅ Match secured</p>
          )}
        </div>

        {/* ⋮ menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 transition text-gray-600 text-xl font-bold">
            ⋮
          </button>
          {showMenu && (
            <div className="absolute right-0 top-11 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[160px] overflow-hidden">
              <button
                onClick={() => { setShowMenu(false); handleBlock(); }}
                disabled={blocking}
                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition font-medium flex items-center gap-2">
                🚫 Block {match.partner_name}
              </button>
              <button
                onClick={() => { setShowMenu(false); router.push(`/report?matchId=${matchId}`); }}
                className="w-full text-left px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition flex items-center gap-2">
                ⚑ Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Urgent deadline banner */}
      {isUrgent && (
        <div className={`px-4 py-2.5 text-sm text-center font-semibold ${isExpiring ? 'bg-red-500 text-white' : 'bg-orange-50 border-b border-orange-200 text-orange-700'}`}>
          ⚠️ Call within {hoursLeft}h or this match disappears!
        </div>
      )}

      {/* Call Now bar */}
      {!match.call_completed && (
        <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800">Ready to take it to the next level?</p>
            <p className="text-xs text-gray-500">A quick call beats 100 messages</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => webrtc.startCall('voice')}
              className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition flex items-center gap-1.5">
              📞 Call
            </button>
            <button
              onClick={() => webrtc.startCall('video')}
              className="bg-purple-500 hover:bg-purple-600 text-white font-bold px-4 py-2 rounded-xl text-sm transition flex items-center gap-1.5">
              📹 Video
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center mt-6 space-y-4">
            <img
              src={partnerPhoto}
              alt={match.partner_name}
              className="w-20 h-20 rounded-full object-cover mx-auto border-4 border-white shadow-lg"
            />
            <p className="font-bold text-gray-700 text-lg">You matched with {match.partner_name}! 🎉</p>
            <p className="text-gray-400 text-sm">Break the ice — try this opener:</p>
            <button
              onClick={() => setInput(starter)}
              className="mx-auto block bg-pink-50 border border-pink-200 rounded-2xl px-5 py-3 text-sm text-pink-700 italic hover:bg-pink-100 transition max-w-xs">
              "{starter}"
              <span className="block text-xs text-pink-400 not-italic mt-1">tap to use →</span>
            </button>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${isMe ? 'bg-pink-500 text-white rounded-br-sm' : 'bg-white text-gray-800 shadow rounded-bl-sm'}`}>
                <p>{msg.content}</p>
                <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <span className={`text-xs ${isMe ? 'text-pink-100' : 'text-gray-400'}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                  {/* Read receipts — only for my messages */}
                  {isMe && (
                    <span className={`text-xs ${msg.is_read ? 'text-blue-200' : 'text-pink-200'}`}
                      title={msg.is_read ? 'Seen' : 'Delivered'}>
                      {msg.is_read ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="flex items-center gap-3 px-4 py-3 bg-white border-t">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Message ${match.partner_name}…`}
          className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          maxLength={1000}
        />
        <span className="text-xs text-gray-300 select-none">{input.length > 800 ? `${input.length}/1000` : ''}</span>
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="bg-pink-500 text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-pink-600 disabled:opacity-50 transition">
          ➤
        </button>
      </form>

      <CallOverlay
        callState={webrtc.callState}
        callType={webrtc.callType}
        incomingCall={webrtc.incomingCall}
        partnerName={match.partner_name}
        partnerPhoto={match.partner_photo}
        isMuted={webrtc.isMuted}
        isCameraOff={webrtc.isCameraOff}
        localVideoRef={webrtc.localVideoRef}
        remoteVideoRef={webrtc.remoteVideoRef}
        onAccept={webrtc.acceptCall}
        onReject={webrtc.rejectCall}
        onEnd={webrtc.endCall}
        onToggleMute={webrtc.toggleMute}
        onToggleCamera={webrtc.toggleCamera}
      />
    </div>
  );
}
