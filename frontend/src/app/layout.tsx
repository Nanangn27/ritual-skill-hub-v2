import type { Metadata } from 'next';
import { WagmiConfig } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmi';
import '@/app/globals.css';

export const metadata: Metadata = {
  title: 'Ritual Skill Hub',
  description: 'Connect your wallet, register skills, and run skill executions on the Ritual network.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WagmiConfig config={wagmiConfig}>{children}</WagmiConfig>
      </body>
    </html>
  );
}
