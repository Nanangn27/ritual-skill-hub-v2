// SPDX-License-Identifier: MIT
// tests/SkillRegistry.test.js
//
// Phase 1 test suite for SkillRegistry.sol.
// Uses solc-js to compile and @ethereumjs/vm (cancun) as a pure-JS EVM to
// execute real bytecode -- no native Hardhat binary required (see
// docs/architecture.md anti-pitfalls: solc 0.8.26, evmVersion cancun).
//
// Run directly: node tests/SkillRegistry.test.js

'use strict';

const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { VM } = require('@ethereumjs/vm');
const { Common } = require('@ethereumjs/common');
const { Address } = require('@ethereumjs/util');
const { Interface } = require('ethers');

const ROOT = path.join(__dirname, '..');
const OWNER = '0x00000000000000000000000000000000000000a1';
const STRANGER = '0x00000000000000000000000000000000000000b2';
const PROVIDER2 = '0x00000000000000000000000000000000000000c3';

function compile() {
  const sources = {
    'SkillRegistry.sol': fs.readFileSync(path.join(ROOT, 'contracts/SkillRegistry.sol'), 'utf8'),
  };
  const input = {
    language: 'Solidity',
    sources: Object.fromEntries(Object.entries(sources).map(([k, v]) => [k, { content: v }])),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'cancun',
      outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  if (out.errors) {
    const fatal = out.errors.filter((e) => e.severity === 'error');
    for (const e of out.errors) {
      console.log(e.severity === 'error' ? '\u2718 ERROR:' : '\u26a0 WARNING:', e.formattedMessage || e.message);
    }
    if (fatal.length) throw new Error('compilation failed');
  }
  const bc = {};
  for (const grp of Object.values(out.contracts)) {
    for (const [cn, c] of Object.entries(grp)) {
      bc[cn] = { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object };
    }
  }
  return bc;
}

const COMMON = Common.custom({ chainId: 31337 }, { hardfork: 'cancun' });

// runCall() bypasses vm.runTx()/vm.buildBlock(), so when no block is supplied
// the EVM falls back to its internal defaultBlock() (see
// @ethereumjs/evm/dist/cjs/evm.js), which hardcodes header.timestamp to 0n.
// That made block.timestamp resolve to 0 inside the Solidity constructor,
// so SkillRegistry.createdAt (uint64(block.timestamp)) was always stored as
// 0 -- failing the "createdAt set (nonzero)" assertion below. Supplying our
// own minimal block object (same shape defaultBlock() returns) with a
// realistic nonzero timestamp fixes this without touching the contract.
const BLOCK = {
  header: {
    number: 0n,
    cliqueSigner: () => Address.zero(),
    coinbase: Address.zero(),
    timestamp: 1700000000n, // arbitrary nonzero unix timestamp (2023-11-14T22:13:20Z)
    difficulty: 0n,
    prevRandao: new Uint8Array(32),
    gasLimit: 30000000n,
    baseFeePerGas: undefined,
    getBlobGasPrice: () => undefined,
  },
};

async function deploy(vm, bc, name, args, from) {
  const iface = new Interface(bc[name].abi);
  const data = bc[name].bytecode + iface.encodeDeploy(args).slice(2);
  const res = await vm.evm.runCall({
    caller: Address.fromString(from),
    data: Buffer.from(data.slice(2), 'hex'),
    gasLimit: 3000000n,
    block: BLOCK,
  });
  if (res.execResult.exceptionError) {
    throw new Error('deploy revert: ' + res.execResult.exceptionError.error);
  }
  return { addr: res.createdAddress.toString(), iface };
}

async function call(vm, addr, iface, fn, args, from, value) {
  const data = iface.encodeFunctionData(fn, args);
  return vm.evm.runCall({
    caller: Address.fromString(from),
    to: Address.fromString(addr),
    data: Buffer.from(data.slice(2), 'hex'),
    gasLimit: 3000000n,
    value: value || 0n,
    block: BLOCK,
  });
}

function decode(iface, fn, res) {
  const rv = res.execResult.returnValue;
  return iface.decodeFunctionResult(fn, '0x' + Buffer.from(rv).toString('hex'));
}

let pass = 0;
let fail = 0;
function ok(cond, label) {
  if (cond) {
    pass++;
    console.log('  \u2714', label);
  } else {
    fail++;
    console.log('  \u2718 FAIL:', label);
  }
}
function assertRevert(res, label) {
  ok(!!res.execResult.exceptionError, label);
}
function assertOk(res, label) {
  if (res.execResult.exceptionError) {
    fail++;
    console.log('  \u2718 FAIL:', label, '->', res.execResult.exceptionError.error);
  } else {
    pass++;
    console.log('  \u2714', label);
  }
}

(async () => {
  const bc = compile();
  const vm = await VM.create({ common: COMMON });

  console.log('\n=== SkillRegistry: deploy & ownership ===');
  const { addr, iface } = await deploy(vm, bc, 'SkillRegistry', [OWNER], OWNER);
  ok(addr.startsWith('0x') && addr.length === 42, 'deployed with valid address');

  {
    const res = await call(vm, addr, iface, 'owner', [], OWNER);
    const [returnedOwner] = decode(iface, 'owner', res);
    ok(returnedOwner.toLowerCase() === OWNER.toLowerCase(), 'owner() returns constructor-supplied owner');
  }

  console.log('\n=== SkillRegistry: createSkill access control ===');
  assertRevert(
    await call(vm, addr, iface, 'createSkill', ['Sentiment Analyzer', 'bafy...cid1', '0x' + '11'.repeat(32), 1000000000000000n], STRANGER),
    'createSkill() reverts from stranger (onlyOwner / NotOwner)'
  );

  console.log('\n=== SkillRegistry: createSkill validation ===');
  assertRevert(
    await call(vm, addr, iface, 'createSkill', ['', 'bafy...cid1', '0x' + '11'.repeat(32), 1000000000000000n], OWNER),
    'createSkill() reverts on empty name (EmptyName)'
  );
  assertRevert(
    await call(vm, addr, iface, 'createSkill', ['Sentiment Analyzer', '', '0x' + '11'.repeat(32), 1000000000000000n], OWNER),
    'createSkill() reverts on empty metadataCID (EmptyMetadataCID)'
  );

  console.log('\n=== SkillRegistry: createSkill happy path ===');
  const PRICE = 1000000000000000n; // 0.001 RIT
  const HASH1 = '0x' + '11'.repeat(32);
  {
    const res = await call(
      vm,
      addr,
      iface,
      'createSkill',
      ['Sentiment Analyzer', 'bafy...cid1', HASH1, PRICE],
      OWNER
    );
    assertOk(res, 'createSkill() succeeds for owner');
    const [id] = decode(iface, 'createSkill', res);
    ok(id === 1n, 'first skill id == 1');
  }

  {
    const res = await call(vm, addr, iface, 'totalSkills', [], OWNER);
    const [total] = decode(iface, 'totalSkills', res);
    ok(total === 1n, 'totalSkills() == 1 after one create');
  }

  {
    const res = await call(vm, addr, iface, 'getSkill', [1n], OWNER);
    const [skill] = decode(iface, 'getSkill', res);
    ok(skill.id === 1n, 'getSkill(1).id == 1');
    ok(skill.provider.toLowerCase() === OWNER.toLowerCase(), 'getSkill(1).provider == owner (creator)');
    ok(skill.name === 'Sentiment Analyzer', 'getSkill(1).name matches');
    ok(skill.metadataCID === 'bafy...cid1', 'getSkill(1).metadataCID matches');
    ok(skill.systemPromptHash === HASH1, 'getSkill(1).systemPromptHash matches');
    ok(skill.pricePerRun === PRICE, 'getSkill(1).pricePerRun matches');
    ok(skill.active === true, 'getSkill(1).active == true by default');
    ok(skill.createdAt > 0n, 'getSkill(1).createdAt set (nonzero)');
  }

  console.log('\n=== SkillRegistry: getSkill on nonexistent id ===');
  assertRevert(await call(vm, addr, iface, 'getSkill', [999n], OWNER), 'getSkill(999) reverts (SkillNotFound)');

  console.log('\n=== SkillRegistry: skillsByProvider ===');
  {
    const res = await call(vm, addr, iface, 'skillsByProvider', [OWNER], OWNER);
    const [ids] = decode(iface, 'skillsByProvider', res);
    ok(ids.length === 1 && ids[0] === 1n, 'skillsByProvider(owner) == [1]');
  }
  {
    const res = await call(vm, addr, iface, 'skillsByProvider', [PROVIDER2], OWNER);
    const [ids] = decode(iface, 'skillsByProvider', res);
    ok(ids.length === 0, 'skillsByProvider(unrelated) == []');
  }

  console.log('\n=== SkillRegistry: updateSkill ===');
  assertRevert(
    await call(vm, addr, iface, 'updateSkill', [1n, 'bafy...cid2', '0x' + '22'.repeat(32), PRICE], STRANGER),
    'updateSkill() reverts from stranger (onlyOwner)'
  );
  assertRevert(
    await call(vm, addr, iface, 'updateSkill', [999n, 'bafy...cid2', '0x' + '22'.repeat(32), PRICE], OWNER),
    'updateSkill() reverts on nonexistent id (SkillNotFound)'
  );
  assertRevert(
    await call(vm, addr, iface, 'updateSkill', [1n, '', '0x' + '22'.repeat(32), PRICE], OWNER),
    'updateSkill() reverts on empty metadataCID (EmptyMetadataCID)'
  );
  {
    const NEW_PRICE = 2000000000000000n;
    const HASH2 = '0x' + '22'.repeat(32);
    const res = await call(vm, addr, iface, 'updateSkill', [1n, 'bafy...cid2', HASH2, NEW_PRICE], OWNER);
    assertOk(res, 'updateSkill() succeeds for owner');

    const getRes = await call(vm, addr, iface, 'getSkill', [1n], OWNER);
    const [skill] = decode(iface, 'getSkill', getRes);
    ok(skill.metadataCID === 'bafy...cid2', 'metadataCID updated');
    ok(skill.systemPromptHash === HASH2, 'systemPromptHash updated');
    ok(skill.pricePerRun === NEW_PRICE, 'pricePerRun updated');
    ok(skill.name === 'Sentiment Analyzer', 'name unchanged by updateSkill (immutable field)');
  }

  console.log('\n=== SkillRegistry: toggleActive ===');
  assertRevert(
    await call(vm, addr, iface, 'toggleActive', [1n], STRANGER),
    'toggleActive() reverts from stranger (onlyOwner)'
  );
  assertRevert(
    await call(vm, addr, iface, 'toggleActive', [999n], OWNER),
    'toggleActive() reverts on nonexistent id (SkillNotFound)'
  );
  {
    const res = await call(vm, addr, iface, 'toggleActive', [1n], OWNER);
    assertOk(res, 'toggleActive() succeeds for owner');
    const getRes = await call(vm, addr, iface, 'getSkill', [1n], OWNER);
    const [skill] = decode(iface, 'getSkill', getRes);
    ok(skill.active === false, 'active flipped to false');
  }
  {
    const res = await call(vm, addr, iface, 'toggleActive', [1n], OWNER);
    assertOk(res, 'toggleActive() succeeds again (flip back)');
    const getRes = await call(vm, addr, iface, 'getSkill', [1n], OWNER);
    const [skill] = decode(iface, 'getSkill', getRes);
    ok(skill.active === true, 'active flipped back to true');
  }

  console.log('\n=== SkillRegistry: multi-skill id increment ===');
  {
    const res = await call(
      vm,
      addr,
      iface,
      'createSkill',
      ['Code Reviewer', 'bafy...cid3', '0x' + '33'.repeat(32), PRICE],
      OWNER
    );
    assertOk(res, 'second createSkill() succeeds');
    const [id] = decode(iface, 'createSkill', res);
    ok(id === 2n, 'second skill id == 2 (monotonic increment)');

    const totalRes = await call(vm, addr, iface, 'totalSkills', [], OWNER);
    const [total] = decode(iface, 'totalSkills', totalRes);
    ok(total === 2n, 'totalSkills() == 2 after two creates');
  }

  console.log('\n=== SkillRegistry: transferOwnership ===');
  assertRevert(
    await call(vm, addr, iface, 'transferOwnership', [PROVIDER2], STRANGER),
    'transferOwnership() reverts from stranger (onlyOwner)'
  );
  assertRevert(
    await call(vm, addr, iface, 'transferOwnership', ['0x0000000000000000000000000000000000000000'], OWNER),
    'transferOwnership() reverts to zero address (ZeroAddress)'
  );
  {
    const res = await call(vm, addr, iface, 'transferOwnership', [PROVIDER2], OWNER);
    assertOk(res, 'transferOwnership() succeeds for owner');
    const ownerRes = await call(vm, addr, iface, 'owner', [], OWNER);
    const [newOwner] = decode(iface, 'owner', ownerRes);
    ok(newOwner.toLowerCase() === PROVIDER2.toLowerCase(), 'owner() reflects new owner after transfer');
  }
  assertRevert(
    await call(vm, addr, iface, 'createSkill', ['Anything', 'bafy...cid4', '0x' + '44'.repeat(32), PRICE], OWNER),
    'old owner can no longer createSkill() after transferOwnership'
  );

  console.log(`\n==== RESULT: ${pass} passed, ${fail} failed ====`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e.stack || e.message || e);
  process.exit(1);
});
