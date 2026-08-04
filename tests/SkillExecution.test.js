// SPDX-License-Identifier: MIT
// tests/SkillExecution.test.js
//
// Phase 2 test suite for SkillExecution.sol.
// Uses solc-js to compile and @ethereumjs/vm (cancun) as a pure-JS EVM to
// execute real bytecode -- no native Hardhat binary required.
//
// Run directly: node tests/SkillExecution.test.js

'use strict';

const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { VM } = require('@ethereumjs/vm');
const { Common } = require('@ethereumjs/common');
const { Address, Account } = require('@ethereumjs/util');
const { Interface } = require('ethers');

const ROOT = path.join(__dirname, '..');
const OWNER = '0x00000000000000000000000000000000000000a1';
const STRANGER = '0x00000000000000000000000000000000000000b2';
const PROVIDER2 = '0x00000000000000000000000000000000000000c3';

function compile() {
  const sources = {
    'SkillRegistry.sol': fs.readFileSync(path.join(ROOT, 'contracts/SkillRegistry.sol'), 'utf8'),
    'SkillExecution.sol': fs.readFileSync(path.join(ROOT, 'contracts/SkillExecution.sol'), 'utf8'),
    'libraries/RitualAddresses.sol': fs.readFileSync(path.join(ROOT, 'contracts/libraries/RitualAddresses.sol'), 'utf8'),
    'interfaces/ILLMPrecompile.sol': fs.readFileSync(path.join(ROOT, 'contracts/interfaces/ILLMPrecompile.sol'), 'utf8'),
    'interfaces/IAsyncDelivery.sol': fs.readFileSync(path.join(ROOT, 'contracts/interfaces/IAsyncDelivery.sol'), 'utf8'),
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
      console.log(e.severity === 'error' ? '✖ ERROR:' : '⚠ WARNING:', e.formattedMessage || e.message);
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

const BLOCK = {
  header: {
    number: 0n,
    cliqueSigner: () => Address.zero(),
    coinbase: Address.zero(),
    timestamp: 1700000000n,
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

function ok(cond, label) {
  if (cond) {
    console.log('  ✔', label);
  } else {
    console.log('  ✖ FAIL:', label);
  }
}

function assertRevert(res, label) {
  ok(!!res.execResult.exceptionError, label);
}

function assertOk(res, label) {
  if (res.execResult.exceptionError) {
    console.log('  ✖ FAIL:', label, '->', res.execResult.exceptionError.error);
  } else {
    console.log('  ✔', label);
  }
}

const RitualAddresses = {
  LLM_INFERENCE: '0x0000000000000000000000000000000000000802',
  ASYNC_DELIVERY: '0x5A16214fF555848411544b005f7Ac063742f39F6',
};

(async () => {
  const bc = compile();
  const vm = await VM.create({ common: COMMON });

  // 0x0802 (LLM inference precompile) doesn't exist in the pure-JS EVM, and
  // customPrecompiles only intercepts top-level runCall -- not nested CALL
  // opcodes. So inject real runtime bytecode that returns a deterministic
  // 32-byte jobId for any call:
  //   PUSH32 <jobId>; PUSH1 0x00; MSTORE; PUSH1 0x20; PUSH1 0x00; RETURN
  const STUB_JOB_ID = 'ab'.repeat(32);
  const stubCode = Buffer.from('7f' + STUB_JOB_ID + '60005260206000f3', 'hex');
  await vm.stateManager.putContractCode(
    Address.fromString(RitualAddresses.LLM_INFERENCE),
    stubCode
  );

  // Fund caller accounts so they can pay pricePerRun via msg.value.
  for (const acct of [OWNER, STRANGER, PROVIDER2]) {
    await vm.stateManager.putAccount(
      Address.fromString(acct),
      new Account(0n, 10n ** 20n)
    );
  }

  console.log('\n=== SkillExecution: deploy ===');
  const { addr: registryAddr, iface: registryIface } = await deploy(
    vm,
    bc,
    'SkillRegistry',
    [OWNER],
    OWNER
  );
  ok(registryAddr.startsWith('0x') && registryAddr.length === 42, 'SkillRegistry deployed');

  const { addr: executionAddr, iface: executionIface } = await deploy(
    vm,
    bc,
    'SkillExecution',
    [OWNER, registryAddr],
    OWNER
  );
  ok(executionAddr.startsWith('0x') && executionAddr.length === 42, 'SkillExecution deployed');

  console.log('\n=== SkillExecution: ownership ===');
  {
    const res = await call(vm, executionAddr, executionIface, 'owner', [], OWNER);
    const [returnedOwner] = decode(executionIface, 'owner', res);
    ok(returnedOwner.toLowerCase() === OWNER.toLowerCase(), 'owner() returns constructor-supplied owner');
  }

  console.log('\n=== SkillExecution: withdraw access control ===');
  assertRevert(
    await call(vm, executionAddr, executionIface, 'withdraw', [STRANGER], STRANGER),
    'withdraw() reverts from stranger (onlyOwner / NotOwner)'
  );

  console.log('\n=== SkillExecution: runSkill validation ===');
  const PRICE = 1000000000000000n;
  const HASH1 = '0x' + '11'.repeat(32);
  {
    const res = await call(
      vm,
      registryAddr,
      registryIface,
      'createSkill',
      ['Test Skill', 'bafy...cid1', HASH1, PRICE],
      OWNER
    );
    assertOk(res, 'createSkill() succeeds for owner');
    const [skillId] = decode(registryIface, 'createSkill', res);
    ok(skillId === 1n, 'skill id == 1');
  }

  {
    await call(vm, registryAddr, registryIface, 'toggleActive', [1n], OWNER);
    assertRevert(
      await call(vm, executionAddr, executionIface, 'runSkill', [1n, 'hello'], STRANGER, PRICE),
      'runSkill() reverts on inactive skill (SkillInactive)'
    );
  }

  {
    assertRevert(
      await call(vm, executionAddr, executionIface, 'runSkill', [1n, ''], STRANGER, PRICE),
      'runSkill() reverts on empty prompt (EmptyString)'
    );
  }

  {
    await call(vm, registryAddr, registryIface, 'toggleActive', [1n], OWNER);
    assertRevert(
      await call(vm, executionAddr, executionIface, 'runSkill', [1n, 'hello'], STRANGER, PRICE - 1n),
      'runSkill() reverts when value < pricePerRun (InsufficientPayment)'
    );
  }

  console.log('\n=== SkillExecution: runSkill happy path ===');
  const recordId = '0x' + 'ab'.repeat(32);
  {
    const res = await call(vm, executionAddr, executionIface, 'runSkill', [1n, 'hello'], STRANGER, PRICE);
    assertOk(res, 'runSkill() succeeds with exact payment on active skill');
    if (!res.execResult.exceptionError) {
      const [rid] = decode(executionIface, 'runSkill', res);
      ok(rid.toLowerCase() === recordId, 'runSkill() returns stub jobId');
    }
  }

  {
    const res = await call(vm, executionAddr, executionIface, 'withdraw', [OWNER], OWNER);
    assertOk(res, 'withdraw() succeeds for owner');
    const bal = (await vm.stateManager.getAccount(Address.fromString(executionAddr))).balance;
    ok(bal === 0n, 'contract balance == 0 after withdraw');
  }

  console.log('\n=== SkillExecution: onLLMResult authorization ===');
  {
    const RESULT_CID = '0x' + Buffer.from('bafy...result', 'utf8').toString('hex');
    assertRevert(
      await call(vm, executionAddr, executionIface, 'onLLMResult', [recordId, RESULT_CID], STRANGER),
      'onLLMResult() reverts from non-AsyncDelivery caller (Unauthorized)'
    );

    const res = await call(vm, executionAddr, executionIface, 'onLLMResult', [recordId, RESULT_CID], RitualAddresses.ASYNC_DELIVERY);
    assertOk(res, 'onLLMResult() succeeds from AsyncDelivery (0x5A16...39F6)');

    const rec = await call(vm, executionAddr, executionIface, 'getRecord', [recordId], OWNER);
    const decoded = decode(executionIface, 'getRecord', rec);
    const delivered = decoded[0].delivered !== undefined ? decoded[0].delivered : decoded[0][decoded[0].length - 1];
    ok(delivered === true, 'getRecord() delivered == true after callback');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
