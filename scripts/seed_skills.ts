// scripts/seed_skills.ts
// Phase 4: seed the SkillRegistry with an initial catalog of skills.
// Calls createSkill(name, metadataCID, systemPromptHash, pricePerRun) for each
// entry. Owner-only in v1, so DEPLOYER_PRIVATE_KEY must be the registry owner.
//
// Usage: npm run seed

import { ethers } from 'ethers';
import {
  loadArtifact,
  getProvider,
  getWallet,
  assertChain,
  requireEnv,
  explorerTx,
} from './_shared';

interface SeedSkill {
  name: string;
  metadataCID: string;
  systemPrompt: string;
  pricePerRunEther: string;
}

// Initial v1 catalog. metadataCID values are placeholders until IPFS pinning
// is wired up; systemPromptHash is derived from systemPrompt via keccak256.
const SEED_SKILLS: SeedSkill[] = [
  {
    name: 'Summarizer',
    metadataCID: 'bafkreiabcdefsummarizerplaceholdercid00000000000000000000',
    systemPrompt:
      'You are a concise summarizer. Given any text, return a clear summary in 3 bullet points.',
    pricePerRunEther: '0.001',
  },
  {
    name: 'Translator (EN<->ID)',
    metadataCID: 'bafkreiabcdeftranslatorplaceholdercid0000000000000000000',
    systemPrompt:
      'You are a precise translator between English and Indonesian. Detect the source language and translate to the other, preserving tone.',
    pricePerRunEther: '0.001',
  },
  {
    name: 'Code Explainer',
    metadataCID: 'bafkreiabcdefcodeexplainerplaceholdercid000000000000000',
    systemPrompt:
      'You are a senior engineer. Explain the given code snippet step by step, then note any bugs or improvements.',
    pricePerRunEther: '0.002',
  },
];

async function main(): Promise<void> {
  const provider = getProvider();
  await assertChain(provider);
  const wallet = getWallet(provider);

  const registryAddr = requireEnv('SKILL_REGISTRY_ADDRESS');
  if (!ethers.isAddress(registryAddr)) {
    throw new Error(`Invalid SKILL_REGISTRY_ADDRESS: ${registryAddr}`);
  }

  const art = loadArtifact('SkillRegistry');
  const registry = new ethers.Contract(registryAddr, art.abi, wallet);

  const caller = await wallet.getAddress();
  const owner: string = await registry.owner();
  process.stdout.write(`Registry: ${registryAddr}\n`);
  process.stdout.write(`Caller:   ${caller}\n`);
  process.stdout.write(`Owner:    ${owner}\n`);
  if (owner.toLowerCase() !== caller.toLowerCase()) {
    throw new Error('Caller is not registry owner; createSkill is owner-only in v1.');
  }

  const before: bigint = await registry.totalSkills();
  process.stdout.write(`Existing skills: ${before}\n\n`);

  for (const s of SEED_SKILLS) {
    const promptHash = ethers.keccak256(ethers.toUtf8Bytes(s.systemPrompt));
    const price = ethers.parseEther(s.pricePerRunEther);
    process.stdout.write(`Creating "${s.name}" (price ${s.pricePerRunEther} RITUAL)...\n`);
    const tx = await registry.createSkill(s.name, s.metadataCID, promptHash, price);
    process.stdout.write(`  tx: ${tx.hash}\n     ${explorerTx(tx.hash)}\n`);
    const receipt = await tx.wait();
    process.stdout.write(`  confirmed in block ${receipt?.blockNumber}\n`);
  }

  const after: bigint = await registry.totalSkills();
  process.stdout.write(`\n=== Seed complete ===\n`);
  process.stdout.write(`Total skills now: ${after} (added ${after - before})\n`);
}

main().catch((err) => {
  process.stderr.write('\nSeed failed: ' + (err?.stack || err) + '\n');
  process.exit(1);
});
