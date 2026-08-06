import type { Metadata } from 'next';
import { WagmiProvider } from '@/components/providers/WagmiProvider';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Ritual Skill Hub',
  description: 'Connect your wallet, register skills, and run skill executions on the Ritual network.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WagmiProvider>{children}</WagmiProvider>
      </body>
    </html>
  );
}
