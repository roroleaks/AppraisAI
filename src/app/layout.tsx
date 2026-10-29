import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://apprais-ai.vercel.app'),
  title: 'AppraisAI | Automated Medical Paper Critical Appraisal',
  description:
    'Automated Scientific Medical Paper Critical Appraisal & Publication-Ready DOCX Generator adhering to EQUATOR, Cochrane RoB 2.0, Oxford CEBM, and GRADE.',
  icons: {
    icon: [
      { url: '/appraisai-icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [{ url: '/appraisai-icon.png', sizes: '512x512', type: 'image/png' }],
  },
  openGraph: {
    title: 'AppraisAI | Automated Medical Paper Critical Appraisal',
    description:
      'Evidence-based methodological synthesis and publication-ready DOCX generator by Dr. Raouf Roshdy',
    images: [{ url: '/appraisai-icon.png', width: 512, height: 512, alt: 'AppraisAI Logo' }],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
