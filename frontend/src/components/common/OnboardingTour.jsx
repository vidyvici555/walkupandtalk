'use client';
import { useState, useEffect } from 'react';

const STEPS = [
  {
    icon: '💑',
    title: 'Welcome to Walk Up & Talk!',
    body: "This is your swipe deck — real people looking to connect. Swipe right to like someone, left to pass. Every day you get 50 swipes.",
    cta: 'Got it →',
  },
  {
    icon: '❤️',
    title: "It's a Match!",
    body: "When you both like each other, you match! You'll see your matches in the Matches tab and can start chatting right away.",
    cta: 'Nice →',
  },
  {
    icon: '📞',
    title: 'The 7-Day Call Rule',
    body: "Here's the twist: every match comes with a 7-day deadline. Make a voice or video call within 7 days — or the match disappears. No ghosting. Just real conversations.",
    cta: "Let's go! 🚀",
  },
];

const STORAGE_KEY = 'wuag_onboarded';

export default function OnboardingTour() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show if the user hasn't seen onboarding before
    if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
      setVisible(true);
    }
  }, []);

  const next = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-6 sm:pb-0">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in">

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-2 pt-5 pb-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step ? 'w-6 h-2 bg-pink-500' : 'w-2 h-2 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="px-8 py-6 text-center">
          <div className="text-6xl mb-4">{current.icon}</div>
          <h2 className="text-xl font-bold text-gray-900 mb-3">{current.title}</h2>
          <p className="text-gray-500 text-sm leading-relaxed">{current.body}</p>
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 space-y-2">
          <button
            onClick={next}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-2xl transition text-base">
            {current.cta}
          </button>
          {step < STEPS.length - 1 && (
            <button
              onClick={dismiss}
              className="w-full text-gray-400 text-sm py-2 hover:text-gray-600 transition">
              Skip tour
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
