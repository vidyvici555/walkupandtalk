'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/swipe',   label: 'Discover',  icon: '🔥' },
  { href: '/matches', label: 'Matches',   icon: '💬' },
  { href: '/profile', label: 'Profile',   icon: '👤' },
];

export default function NavBar({ onLogout }) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        {links.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 text-xs font-medium transition-colors ${
                active ? 'text-pink-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-2xl">{icon}</span>
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          onClick={onLogout}
          className="flex flex-col items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-500 transition-colors"
        >
          <span className="text-2xl">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
