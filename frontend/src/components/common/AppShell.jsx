'use client';
import { usePathname, useRouter } from 'next/navigation';
import NavBar from './NavBar';

// Pages that show the bottom nav bar
const NAV_PAGES = ['/swipe', '/matches', '/profile'];
// These sub-paths use the full screen and must NOT have the nav bar
const NAV_EXCLUDE = ['/matches/'];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const isExcluded = NAV_EXCLUDE.some((p) => {
    // Exclude /matches/[id] but keep /matches exactly
    return pathname.startsWith(p) && pathname !== '/matches';
  });
  const showNav = !isExcluded && NAV_PAGES.some((p) => pathname.startsWith(p));

  const handleLogout = () => {
    localStorage.removeItem('wuag_token');
    localStorage.removeItem('wuag_user');
    router.push('/login');
  };

  return (
    <>
      {children}
      {showNav && <NavBar onLogout={handleLogout} />}
    </>
  );
}
