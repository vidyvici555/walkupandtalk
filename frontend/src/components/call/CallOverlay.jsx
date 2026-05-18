'use client';

export default function CallOverlay({
  callState,
  callType,
  incomingCall,
  partnerName,
  partnerPhoto,
  isMuted,
  isCameraOff,
  localVideoRef,
  remoteVideoRef,
  onStartVoiceCall,
  onStartVideoCall,
  onAccept,
  onReject,
  onEnd,
  onToggleMute,
  onToggleCamera,
}) {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

  if (callState === 'idle') return null;

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col items-center justify-center">
      {/* Remote video (full screen) */}
      {callType === 'video' && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Local video (picture-in-picture) */}
      {callType === 'video' && (
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className="absolute top-4 right-4 w-32 h-48 rounded-xl object-cover border-2 border-white z-10"
        />
      )}

      {/* Call Info */}
      <div className="z-20 flex flex-col items-center gap-4">
        {partnerPhoto && (
          <img
            src={`${API_BASE}${partnerPhoto}`}
            alt={partnerName}
            className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-xl"
          />
        )}
        <h2 className="text-white text-2xl font-bold">{partnerName}</h2>

        {callState === 'ringing' && (
          <p className="text-gray-300 animate-pulse">Calling...</p>
        )}
        {callState === 'incoming' && (
          <p className="text-gray-300 animate-pulse">Incoming {callType} call...</p>
        )}
        {callState === 'connected' && (
          <p className="text-green-400">Connected</p>
        )}
        {callState === 'ended' && (
          <p className="text-gray-400">Call ended</p>
        )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-12 left-0 right-0 flex justify-center gap-6 z-20">
        {callState === 'incoming' ? (
          <>
            <button
              onClick={onReject}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg hover:bg-red-600 transition"
            >
              📵
            </button>
            <button
              onClick={onAccept}
              className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg hover:bg-green-600 transition"
            >
              📞
            </button>
          </>
        ) : callState === 'connected' || callState === 'ringing' ? (
          <>
            <button
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-lg transition ${
                isMuted ? 'bg-red-500' : 'bg-gray-600 hover:bg-gray-700'
              }`}
            >
              {isMuted ? '🔇' : '🎙️'}
            </button>

            {callType === 'video' && (
              <button
                onClick={onToggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-white text-xl shadow-lg transition ${
                  isCameraOff ? 'bg-red-500' : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                {isCameraOff ? '📵' : '📹'}
              </button>
            )}

            <button
              onClick={onEnd}
              className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl shadow-lg hover:bg-red-600 transition"
            >
              📵
            </button>
          </>
        ) : null}
      </div>

      {/* 7-day call reminder banner */}
      {callState === 'idle' && (
        <div className="absolute bottom-24 left-4 right-4 bg-yellow-500/90 rounded-xl p-3 text-center text-sm font-medium z-20">
          ⏳ Call your match within 7 days or you'll be automatically unmatched!
        </div>
      )}
    </div>
  );
}
