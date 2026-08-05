// scripts/_shared.ts
// Shared helpers for Phase 4 deploy tooling: env loading, provider/wallet
// construction, artifact loading, and .env key upsert.

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { ethers } from 'ethers';

export const ROOT = path.join(__dirname, '..');
export const OUT_DIR = path.join(ROOT, 'out');
export const ENV_PATH = path.join(ROOT, '.env');

dotenv.config({ path: ENV_PATH });

export interface Artifact {
  contractName: string;
  source: string;
  abi: any[];
  bytecode: string;
  deployedBytecode: string;
}

export function loadArtifact(name: string): Artifact {
  const p = path.join(OUT_DIR, name + '.json');
  if (!fs.existsSync(p)) {
    throw new Error(
      `Artifact not found: ${p}. Run \`npm run compile\` first.`,
    );
  }
  const a = JSON.parse(fs.readFileSync(p, 'utf8')) as Artifact;
  if (!a.bytecode || a.bytecode === '0x') {
    throw new Error(`Artifact ${name} has empty bytecode (interface/library?).`);
  }
  return a;
}

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === '') {
    throw new Error(`Missing required env var: ${key} (populate .env from .env.example)`);
  }
  return v.trim();
}

export function optionalEnv(key: string, fallback: string): string {
  const v = process.env[key];
  return v && v.trim() !== '' ? v.trim() : fallback;
}

export function getProvider(): ethers.JsonRpcProvider {
  const url = optionalEnv('RITUAL_RPC_URL', 'https://rpc.ritualfoundation.org');
  const chainId = Number(optionalEnv('RITUAL_CHAIN_ID', '1979'));
  return new ethers.JsonRpcProvider(url, chainId);
}

export function getWallet(provider?: ethers.JsonRpcProvider): ethers.Wallet {
  const pk = requireEnv('DEPLOYER_PRIVATE_KEY');
  const normalized = pk.startsWith('0x') ? pk : '0x' + pk;
  return new ethers.Wallet(normalized, provider ?? getProvider());
}

export function explorerTx(hash: string): string {
  const base = optionalEnv('RITUAL_EXPLORER_URL', 'https://explorer.ritualfoundation.org');
  return `${base.replace(/\/$/, '')}/tx/${hash}`;
}

export function explorerAddr(addr: string): string {
  const base = optionalEnv('RITUAL_EXPLORER_URL', 'https://explorer.ritualfoundation.org');
  return `${base.replace(/\/$/, '')}/address/${addr}`;
}

/**
 * Insert or update a KEY=value pair in .env (creating .env from .env.example
 * if it does not yet exist). Preserves comments and ordering; appends if the
 * key is absent.
 */
export function upsertEnv(updates: Record<string, string>): void {
  let content = '';
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  } else {
    const example = path.join(ROOT, '.env.example');
    content = fs.existsSync(example) ? fs.readFileSync(example, 'utf8') : '';
  }

  const lines = content.split('\n');
  const remaining = new Set(Object.keys(updates));

  const out = lines.map((line) => {
    const m = line.match(/^(\s*)([A-Z0-9_]+)\s*=/);
    if (m && Object.prototype.hasOwnProperty.call(updates, m[2])) {
      remaining.delete(m[2]);
      return `${m[2]}=${updates[m[2]]}`;
    }
    return line;
  });

  if (remaining.size > 0) {
    if (out.length > 0 && out[out.length - 1].trim() !== '') out.push('');
    for (const key of remaining) {
      out.push(`${key}=${updates[key]}`);
    }
  }

  fs.writeFileSync(ENV_PATH, out.join('\n'));
}

export async function assertChain(provider: ethers.JsonRpcProvider): Promise<void> {
  const expected = Number(optionalEnv('RITUAL_CHAIN_ID', '1979'));
  const net = await provider.getNetwork();
  if (Number(net.chainId) !== expected) {
    throw new Error(
      `Connected chainId ${net.chainId} != expected ${expected}. Check RITUAL_RPC_URL.`,
    );
  }
}
