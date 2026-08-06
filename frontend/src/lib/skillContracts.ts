import { skillExecutionAddress, skillRegistryAddress } from '@/lib/addresses';
import { skillExecutionAbi } from '@/lib/abi/skillExecution';
import { skillRegistryAbi } from '@/lib/abi/skillRegistry';

export const skillRegistryConfig = {
  address: skillRegistryAddress,
  abi: skillRegistryAbi,
} as const;

export const skillExecutionConfig = {
  address: skillExecutionAddress,
  abi: skillExecutionAbi,
} as const;
