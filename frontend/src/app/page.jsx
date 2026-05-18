import { redirect } from 'next/navigation';

// Always redirect / → /login  (server-side, instant, no flash)
// The login page handles the "already logged in" redirect to /swipe
export default function RootPage() {
  redirect('/login');
}
