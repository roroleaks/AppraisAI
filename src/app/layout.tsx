import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AppraisAI | Automated Medical Paper Critical Appraisal',
  description: 'Automated Scientific Medical Paper Critical Appraisal & Publication-Ready DOCX Generator',
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
