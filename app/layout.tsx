import type { Metadata } from 'next';
import { Inter, Plus_Jakarta_Sans } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { ptBR } from '@clerk/localizations';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', weight: ['600', '700', '800'], display: 'swap' });

export const metadata: Metadata = { title: 'Criador de Posts' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={ptBR}
      appearance={{
        variables: { colorPrimary: '#16140F', borderRadius: '12px', fontFamily: 'var(--font-inter), system-ui, sans-serif' },
        elements: { card: { boxShadow: '0 18px 40px -12px rgba(22,20,15,.22)', border: '1px solid #E8E3D8' } },
      }}
    >
      <html lang="pt-BR" className={`${inter.variable} ${jakarta.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
