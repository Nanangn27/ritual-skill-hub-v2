import type { Address } from 'viem';

function readAddress(value: string | undefined, label: string): Address {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) {
    if (typeof window !== 'undefined') {
      console.warn(`Missing or invalid ${label}. Set it in your environment.`);
    }
    return '0x0000000000000000000000000000000000000000';
  }
  return value as Address;
}

export const skillRegistryAddress = readAddress(
  process.env.NEXT_PUBLIC_SKILL_REGISTRY_ADDRESS,
  'NEXT_PUBLIC_SKILL_REGISTRY_ADDRESS'
);

export const skillExecutionAddress = readAddress(
  process.env.NEXT_PUBLIC_SKILL_EXECUTION_ADDRESS,
  'NEXT_PUBLIC_SKILL_EXECUTION_ADDRESS'
);
