// scripts/fund_wallet.ts
// Phase 4: fund TEE execution fees for the SkillExecution contract via the
// Ritual system wallet (RITUAL_WALLET, 0x532F...3948). The precompile-backed
// LLM runs draw from this balance, so the executing contract must be topped up.
//
// Usage:
//   npm run fund                 # funds SKILL_EXECUTION_ADDRESS with default amount
//   npm run fund -- 0.5          # funds with 0.5 RITUAL
//   npm run fund -- 0.5 0xabc... # funds an explicit payer address

import { ethers } from 'ethers';
import {
  getProvider,
  getWallet,
  assertChain,
  requireEnv,
  optionalEnv,
  explorerTx,
} from './_shared';

// RitualWallet.depositFor(address payer) payable  +  balanceOf(address) view
const RITUAL_WALLET_ABI = [
  'function depositFor(address payer) external payable',
  'function balanceOf(address payer) external view returns (uint256)',
];

const RITUAL_WALLET_ADDRESS = '0x532F5C3D15c94ca5abF83FeBab0c4D9BCa243948';
const DEFAULT_AMOUNT_ETHER = '0.1';

async function main(): Promise<void> {
  const provider = getProvider();
  await assertChain(provider);
  const wallet = getWallet(provider);

  const amountArg = process.argv[2] || DEFAULT_AMOUNT_ETHER;
  const payer =
    process.argv[3] ||
    optionalEnv('SKILL_EXECUTION_ADDRESS', '') ||
    requireEnv('SKILL_EXECUTION_ADDRESS');

  if (!ethers.isAddress(payer)) {
    throw new Error(`Invalid payer address: ${payer}`);
  }

  const amount = ethers.parseEther(amountArg);
  const deployer = await wallet.getAddress();
  const balance = await provider.getBalance(deployer);

  process.stdout.write(`Funder:  ${deployer}\n`);
  process.stdout.write(`Balance: ${ethers.formatEther(balance)} RITUAL\n`);
  process.stdout.write(`Payer:   ${payer}\n`);
  process.stdout.write(`Amount:  ${ethers.formatEther(amount)} RITUAL\n`);

  if (balance < amount) {
    throw new Error(
      `Insufficient funder balance (${ethers.formatEther(balance)}) for ${ethers.formatEther(amount)} RITUAL.`,
    );
  }

  const rw = new ethers.Contract(RITUAL_WALLET_ADDRESS, RITUAL_WALLET_ABI, wallet);

  let before: bigint = 0n;
  try {
    before = await rw.balanceOf(payer);
    process.stdout.write(`Payer TEE balance before: ${ethers.formatEther(before)} RITUAL\n`);
  } catch {
    process.stdout.write('Payer TEE balance before: (balanceOf unavailable)\n');
  }

  process.stdout.write('\nSending depositFor()...\n');
  const tx = await rw.depositFor(payer, { value: amount });
  process.stdout.write(`  tx: ${tx.hash}\n     ${explorerTx(tx.hash)}\n`);
  const receipt = await tx.wait();
  process.stdout.write(`  confirmed in block ${receipt?.blockNumber}\n`);

  try {
    const after: bigint = await rw.balanceOf(payer);
    process.stdout.write(`Payer TEE balance after:  ${ethers.formatEther(after)} RITUAL\n`);
  } catch {
    /* balanceOf optional */
  }

  process.stdout.write('\n=== Fund complete ===\n');
}

main().catch((err) => {
  process.stderr.write('\nFund failed: ' + (err?.stack || err) + '\n');
  process.exit(1);
});
