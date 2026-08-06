import { http, createConfig } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { ritualTestnet } from './chain';

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? '';

export const wagmiConfig = createConfig({
  chains: [ritualTestnet],
  connectors: [injected()],
  transports: {
    [ritualTestnet.id]: http(rpcUrl || undefined),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
