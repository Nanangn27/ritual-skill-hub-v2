import { defineChain } from 'viem';

const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? '1979');
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? '';

export const ritualTestnet = defineChain({
  id: chainId,
  name: 'Ritual Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: rpcUrl ? [rpcUrl] : [] },
    public: { http: rpcUrl ? [rpcUrl] : [] },
  },
  testnet: true,
});
