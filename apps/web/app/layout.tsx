import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ginkgo Leaf — Plataforma de Agentes IA',
  description:
    'Dashboard multi-tenant para gerenciamento de agentes de IA para PMEs brasileiras.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable} dark`}>
      <body className="min-h-screen bg-background text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
