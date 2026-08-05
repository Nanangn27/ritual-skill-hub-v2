// scripts/deploy.ts
// Phase 4: deploy SkillRegistry then SkillExecution to Ritual Testnet (1979).
// Writes resulting addresses back into .env (both server + NEXT_PUBLIC_ keys).
//
// Usage: npm run deploy

import { ethers } from 'ethers';
import {
  loadArtifact,
  getProvider,
  getWallet,
  assertChain,
  upsertEnv,
  explorerAddr,
  explorerTx,
} from './_shared';

async function deployContract(
  wallet: ethers.Wallet,
  name: string,
  args: any[],
): Promise<string> {
  const art = loadArtifact(name);
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  process.stdout.write(`\nDeploying ${name}...\n`);
  const contract = await factory.deploy(...args);
  const tx = contract.deploymentTransaction();
  if (tx) process.stdout.write(`  tx: ${tx.hash}\n     ${explorerTx(tx.hash)}\n`);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  process.stdout.write(`  ${name} deployed at ${address}\n     ${explorerAddr(address)}\n`);
  return address;
}

async function main(): Promise<void> {
  const provider = getProvider();
  await assertChain(provider);
  const wallet = getWallet(provider);

  const deployer = await wallet.getAddress();
  const balance = await provider.getBalance(deployer);
  process.stdout.write(`Deployer: ${deployer}\n`);
  process.stdout.write(`Balance:  ${ethers.formatEther(balance)} RITUAL\n`);
  if (balance === 0n) {
    throw new Error('Deployer balance is 0. Fund it first: npm run fund');
  }

  // 1. SkillRegistry(initialOwner)
  const registryAddr = await deployContract(wallet, 'SkillRegistry', [deployer]);

  // 2. SkillExecution(initialOwner, registry_)
  const executionAddr = await deployContract(wallet, 'SkillExecution', [
    deployer,
    registryAddr,
  ]);

  upsertEnv({
    SKILL_REGISTRY_ADDRESS: registryAddr,
    SKILL_EXECUTION_ADDRESS: executionAddr,
    NEXT_PUBLIC_SKILL_REGISTRY_ADDRESS: registryAddr,
    NEXT_PUBLIC_SKILL_EXECUTION_ADDRESS: executionAddr,
  });

  process.stdout.write('\n=== Deploy complete ===\n');
  process.stdout.write(`SkillRegistry:  ${registryAddr}\n`);
  process.stdout.write(`SkillExecution: ${executionAddr}\n`);
  process.stdout.write('Addresses written to .env (server + NEXT_PUBLIC_).\n');
  process.stdout.write('Next: npm run seed\n');
}

main().catch((err) => {
  process.stderr.write('\nDeploy failed: ' + (err?.stack || err) + '\n');
  process.exit(1);
});
