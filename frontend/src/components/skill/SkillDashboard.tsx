'use client';

import { useMemo, useState } from 'react';
import { keccak256 } from 'viem';
import {
  useAccount,
  useContractRead,
  useContractReads,
  useDisconnect,
  useWriteContract,
} from 'wagmi';
import WalletConnect from '@/components/wallet/WalletConnect';
import TransactionStatus from '@/components/skill/TransactionStatus';
import { skillExecutionConfig, skillRegistryConfig } from '@/lib/skillContracts';

type Skill = {
  id: bigint;
  provider: `0x${string}`;
  name: string;
  metadataCID: string;
  systemPromptHash: `0x${string}`;
  pricePerRun: bigint;
  active: boolean;
  createdAt: bigint;
};

function formatEther(value: bigint) {
  return Number(value) / 1e18;
}

export default function SkillDashboard() {
  const { address, isConnected } = useAccount();
  const [selectedSkillIndex, setSelectedSkillIndex] = useState<number | null>(null);
  const [promptText, setPromptText] = useState('');
  const [registerState, setRegisterState] = useState<{ name: string; metadataCID: string; systemPromptHash: string; pricePerRun: string }>({
    name: '',
    metadataCID: '',
    systemPromptHash: '',
    pricePerRun: '0.01',
  });

  const { data: ownedIds, refetch: refetchOwnedIds } = useContractRead({
    ...skillRegistryConfig,
    functionName: 'skillsByProvider',
    args: [address ?? '0x0000000000000000000000000000000000000000'],
    query: { enabled: isConnected },
  });

  const skillIds = useMemo(() => {
    if (!ownedIds) {
      return [] as bigint[];
    }
    return (Array.isArray(ownedIds) ? [...ownedIds] : [ownedIds]) as bigint[];
  }, [ownedIds]);

  const { data: rawSkills } = useContractReads({
    contracts:
      skillIds.length > 0
        ? skillIds.map((skillId) => ({
            ...skillRegistryConfig,
            functionName: 'getSkill',
            args: [skillId],
          }))
        : [],
    query: { enabled: isConnected && skillIds.length > 0 },
  });

  const skills = useMemo<Skill[]>(() => {
    if (!rawSkills) {
      return [];
    }

    return rawSkills.map((entry) => {
      const values = Array.isArray(entry) ? entry : Object.values(entry as unknown as Record<string, unknown>);
      return {
        id: values[0] as bigint,
        provider: values[1] as `0x${string}`,
        name: values[2] as string,
        metadataCID: values[3] as string,
        systemPromptHash: values[4] as `0x${string}`,
        pricePerRun: values[5] as bigint,
        active: values[6] as boolean,
        createdAt: values[7] as bigint,
      };
    });
  }, [rawSkills]);

  const selectedSkill = selectedSkillIndex !== null ? skills[selectedSkillIndex] : null;

  const createSkillWrite = useWriteContract({
    mutation: {
      onSuccess: () => refetchOwnedIds(),
    },
  });

  const runSkillWrite = useWriteContract();

  const isRegistering = createSkillWrite.isPending;
  const isRegisterError = createSkillWrite.isError;
  const isRegisterSuccess = createSkillWrite.isSuccess;
  const registerError = createSkillWrite.error;

  const isRunning = runSkillWrite.isPending;
  const isRunError = runSkillWrite.isError;
  const isRunSuccess = runSkillWrite.isSuccess;
  const runError = runSkillWrite.error;

  const handleRegister = async () => {
    const price = BigInt(Math.floor(Number(registerState.pricePerRun) * 1e18));
    const hash = (
      registerState.systemPromptHash ||
      keccak256(new TextEncoder().encode(registerState.name.trim() || registerState.metadataCID.trim() || 'Ritual Skill'))
    ) as `0x${string}`;

    await createSkillWrite.writeContract({
      ...skillRegistryConfig,
      functionName: 'createSkill',
      args: [registerState.name, registerState.metadataCID, hash, price],
    });
  };

  const handleRun = async () => {
    if (!selectedSkill) return;
    await runSkillWrite.writeContract({
      ...skillExecutionConfig,
      functionName: 'runSkill',
      args: [selectedSkill.id, promptText],
      value: selectedSkill.pricePerRun,
    });
  };

  return (
    <div className="dashboard-shell">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h1 className="panel-title">Ritual Skill Hub</h1>
            <p className="panel-copy">A professional dashboard to register and execute on-chain skills with wallet connect and transaction status tracking.</p>
          </div>
          <WalletConnect />
        </div>

        <div className="grid-2">
          <div className="section-card">
            <h2>Register a New Skill</h2>
            <div className="field-group">
              <label>
                Skill Name
                <input
                  value={registerState.name}
                  onChange={(event) => setRegisterState((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Example: Ritual Summarizer"
                />
              </label>
              <label>
                Metadata CID
                <input
                  value={registerState.metadataCID}
                  onChange={(event) => setRegisterState((prev) => ({ ...prev, metadataCID: event.target.value }))}
                  placeholder="ipfs://..."
                />
              </label>
              <label>
                System Prompt Hash (optional)
                <input
                  value={registerState.systemPromptHash}
                  onChange={(event) => setRegisterState((prev) => ({ ...prev, systemPromptHash: event.target.value }))}
                  placeholder="0x... or leave blank"
                />
              </label>
              <label>
                Price per run (ETH)
                <input
                  value={registerState.pricePerRun}
                  onChange={(event) => setRegisterState((prev) => ({ ...prev, pricePerRun: event.target.value }))}
                  placeholder="0.01"
                />
              </label>
            </div>
            <button type="button" className="primary" onClick={handleRegister} disabled={!isConnected || isRegistering || !registerState.name || !registerState.metadataCID}>
              {isRegistering ? 'Registering skill…' : 'Register Skill'}
            </button>
          </div>

          <div className="section-card">
            <h2>Your Skill Library</h2>
            <p className="note-text">View skills registered with your connected wallet and choose one to run.</p>
            {isConnected ? (
              <div className="skill-list">
                {skills.length === 0 ? (
                  <div className="skill-card">
                    <p className="note-text">No registered skills found for this wallet.</p>
                  </div>
                ) : (
                  skills.map((skill, index) => (
                    <article key={skill.id.toString()} className={`skill-card ${skill.active ? 'active' : ''}`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '0.75rem' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.5rem' }}>{skill.name}</h3>
                          <p className="note-text">{skill.metadataCID}</p>
                        </div>
                        <span className="badge">{skill.active ? 'Active' : 'Inactive'}</span>
                      </div>
                      <p style={{ margin: '0.65rem 0 0', color: '#cbd5e1' }}>
                        Price: {formatEther(skill.pricePerRun)} ETH · ID #{skill.id.toString()}
                      </p>
                      <button type="button" className="secondary" style={{ marginTop: '0.85rem' }} onClick={() => setSelectedSkillIndex(index)}>
                        {selectedSkillIndex === index ? 'Selected' : 'Select to Run'}
                      </button>
                    </article>
                  ))
                )}
              </div>
            ) : (
              <p className="note-text">Connect your wallet to see registered skills.</p>
            )}
          </div>
        </div>

        <div className="section-card">
          <h2>Run Skill Execution</h2>
          <p className="note-text">Choose a skill and submit a prompt to execute it on-chain.</p>
          {selectedSkill ? (
            <>
              <div className="field-group">
                <label>
                  Selected Skill
                  <input value={`${selectedSkill.name} (${selectedSkill.id.toString()})`} readOnly />
                </label>
                <label>
                  Execution Prompt
                  <textarea
                    value={promptText}
                    onChange={(event) => setPromptText(event.target.value)}
                    placeholder="Enter a prompt for the skill run"
                  />
                </label>
              </div>
              <button type="button" className="primary" onClick={handleRun} disabled={!isConnected || isRunning || !promptText.trim()}>
                {isRunning ? 'Submitting execution…' : `Run Skill (${formatEther(selectedSkill.pricePerRun)} ETH)`}
              </button>
            </>
          ) : (
            <p className="note-text">Select a skill from your library to run it.</p>
          )}
        </div>

        <div className="grid-2">
          <TransactionStatus
            title="Registration Status"
            isPending={isRegistering}
            isSuccess={isRegisterSuccess}
            isError={isRegisterError}
            error={registerError as Error | undefined}
            hash={createSkillWrite.data}
          />
          <TransactionStatus
            title="Execution Status"
            isPending={isRunning}
            isSuccess={isRunSuccess}
            isError={isRunError}
            error={runError as Error | undefined}
            hash={runSkillWrite.data}
          />
        </div>
      </section>
    </div>
  );
}
