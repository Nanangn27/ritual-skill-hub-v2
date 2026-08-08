import { createConfig } from 'wagmi';
import { injected } from 'wagmi';
import { ritualTestnet } from './chain';

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? '';

export const wagmiConfig = createConfig({
  autoConnect: true,
  connectors: [injected()],
  publicClient: {
    chain: ritualTestnet,
    transport: rpcUrl ? (rpcUrl.startsWith('http') ? rpcUrl : `https://${rpcUrl}`) : undefined,
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}