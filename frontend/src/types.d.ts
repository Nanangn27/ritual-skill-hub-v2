// Mock types for dependencies
declare module 'framer-motion' {
  export const AnimatePresence: any;
  export const motion: any;
}

declare module 'viem' {
  export function keccak256(data: string): string;
  export type Address = `0x${string}`;
}

declare module 'wagmi' {
  export function useAccount(): any;
  export function useBalance(): any;
  export function useConnect(): any;
  export function useContractRead(): any;
  export function useContractReads(): any;
  export function useDisconnect(): any;
  export function useWriteContract(): any;
  export const injected: any;
}

declare module 'next' {
  export {};
}