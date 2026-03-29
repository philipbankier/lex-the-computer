import { redirect } from 'next/navigation';
import { LandingPage } from './landing';

export default function HomePage() {
  // In single-user mode or when already logged in, redirect to app
  // When landing page is enabled, show it to unauthenticated visitors
  const showLanding = process.env.SHOW_LANDING === 'true';
  if (!showLanding) {
    redirect('/home');
  }
  return <LandingPage />;
}
