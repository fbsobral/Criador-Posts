import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { ClerkProvider } from '@clerk/nextjs';
import { ptBR } from '@clerk/localizations';
import './globals.css';

// Fontes hospedadas no projeto (variáveis, subconjunto latin): o build não depende de buscar o Google Fonts.
const inter = localFont({ src: './fonts/inter-latin.woff2', weight: '100 900', variable: '--font-inter', display: 'swap' });
const jakarta = localFont({ src: './fonts/jakarta-latin.woff2', weight: '200 800', variable: '--font-jakarta', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Criador de Posts', template: '%s · Criador de Posts' },
  appleWebApp: { capable: true, title: 'Criador de Posts', statusBarStyle: 'default' },
};
export const viewport: Viewport = { themeColor: '#F97335' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      localization={ptBR}
      appearance={{
        variables: { colorPrimary: '#F97335', borderRadius: '12px', fontFamily: 'var(--font-inter), system-ui, sans-serif' },
        elements: { card: { boxShadow: '0 18px 40px -12px rgba(22,20,15,.22)', border: '1px solid #E8E3D8' } },
      }}
    >
      <html lang="pt-BR" className={`${inter.variable} ${jakarta.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
