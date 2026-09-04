import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import TypelessFormLoader from '@/components/TypelessForm';
import TypelessityLoader from '@/components/TypelessityLoader';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoPro Service — Professional Car Service in Gdynia',
  description: 'Expert car diagnostics, repair and maintenance for all makes and models. 15+ years experience in Gdynia. Book your appointment online.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <div style={{ paddingTop: 'var(--header-height)' }}>
          {children}
        </div>
        <Footer />
        <TypelessFormLoader />
        <TypelessityLoader />
      </body>
    </html>
  );
}
