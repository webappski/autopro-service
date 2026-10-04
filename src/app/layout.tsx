import type { Metadata } from 'next';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
// import TypelessityLoader from '@/components/TypelessityLoader'; // disabled before the from-scratch live check
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
        {/* <TypelessityLoader /> disabled before the from-scratch live check */}
      </body>
    </html>
  );
}
