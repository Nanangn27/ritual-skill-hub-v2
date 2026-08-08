import { createConfig } from 'wagmi';
import { ritualTestnet } from './chain';

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? '';

export const wagmiConfig = createConfig({
  autoConnect: true,
  publicClient: {
    chain: ritualTestnet,
    transport: rpcUrl ? (rpcUrl.startsWith('http') ? rpcUrl : `https://${rpcUrl}`) : undefined,
  },
});