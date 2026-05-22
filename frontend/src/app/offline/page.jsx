'use client';

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
      <div className="text-6xl mb-4">💔</div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">You're offline</h1>
      <p className="text-gray-500 mb-6 max-w-xs">
        No connection right now. Check your internet and try again — your matches will be waiting!
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-pink-500 text-white px-6 py-3 rounded-full font-semibold hover:bg-pink-600 transition"
      >
        Try Again
      </button>
    </div>
  );
}
