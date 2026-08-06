'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { keccak256 } from 'viem';
import { useAccount, useBalance, useConnect, useContractRead, useContractReads, useDisconnect, useWriteContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import RitualBrand from '@/components/common/RitualBrand';
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

type NavSection = 'dashboard' | 'register' | 'marketplace' | 'my-skills' | 'execute' | 'history' | 'analytics' | 'settings';

type Toast = {
  id: number;
  title: string;
  description: string;
  kind: 'success' | 'error' | 'info';
};

type HistoryEntry = {
  id: number;
  timestamp: string;
  wallet: string;
  action: string;
  hash: string;
  gas: string;
  status: 'Confirmed' | 'Pending' | 'Failed';
};

const navItems = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'register', label: 'Register Skill' },
  { key: 'marketplace', label: 'Skill Marketplace' },
  { key: 'my-skills', label: 'My Skills' },
  { key: 'execute', label: 'Execute Skill' },
  { key: 'history', label: 'Transaction History' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'settings', label: 'Settings' },
] as const;

const sampleMarketplace = [
  {
    name: 'Ritual Summarizer',
    description: 'Summarizes protocol insights into concise actionable briefs.',
    creator: '0xA1b2…C4d5',
    price: '0.015 ETH',
    category: 'Research',
    rating: 4.9,
  },
  {
    name: 'Liquidity Oracle',
    description: 'Tracks treasury and liquidity conditions for strategy review.',
    creator: '0xD6e7…F8g9',
    price: '0.022 ETH',
    category: 'Analytics',
    rating: 4.8,
  },
  {
    name: 'Compliance Copilot',
    description: 'Flags risky wallet interactions and suspicious transaction patterns.',
    creator: '0xH2i3…J4k5',
    price: '0.018 ETH',
    category: 'Security',
    rating: 4.7,
  },
];

function formatEthValue(value: bigint) {
  return (Number(value) / 1e18).toFixed(3);
}

function shortAddress(value?: string) {
  if (!value) return 'Not connected';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function getInitials(value: string) {
  return value
    .split(' ')
    .map((chunk) => chunk[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function SkillDashboard() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending: connectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balanceData } = useBalance({ address, query: { enabled: !!address } });

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [selectedSkillIndex, setSelectedSkillIndex] = useState<number | null>(null);
  const [promptText, setPromptText] = useState('');
  const [registerState, setRegisterState] = useState({
    name: '',
    metadataCID: '',
    systemPromptHash: '',
    pricePerRun: '0.01',
    category: 'Research',
    description: '',
    tags: '',
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: 1,
      timestamp: 'Just now',
      wallet: '0xA123…9876',
      action: 'Wallet connected',
      hash: '—',
      gas: '—',
      status: 'Confirmed',
    },
  ]);

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Date.now();
    setToasts((current) => [...current.slice(-3), { id, ...toast }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((entry) => entry.id !== id));
    }, 3200);
  };

  const { data: ownedIds, refetch: refetchOwnedIds, isLoading: isLoadingOwnedIds } = useContractRead({
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

  const { data: rawSkills, isLoading: isLoadingSkills } = useContractReads({
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
      onSuccess: () => {
        refetchOwnedIds();
      },
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

  useEffect(() => {
    if (!isConnected) {
      setSelectedSkillIndex(null);
    }
  }, [isConnected]);

  useEffect(() => {
    if (isRegistering) {
      addToast({ title: 'Registration submitting', description: 'Awaiting wallet confirmation.', kind: 'info' });
    }
  }, [isRegistering]);

  useEffect(() => {
    if (isRegisterSuccess) {
      addToast({ title: 'Skill registered', description: 'Your skill is now on-chain.', kind: 'success' });
    }
  }, [isRegisterSuccess]);

  useEffect(() => {
    if (isRegisterError) {
      addToast({ title: 'Registration failed', description: registerError?.message || 'The transaction could not be completed.', kind: 'error' });
    }
  }, [isRegisterError, registerError]);

  useEffect(() => {
    if (isRunning) {
      addToast({ title: 'Execution submitted', description: 'Your prompt is being processed on-chain.', kind: 'info' });
    }
  }, [isRunning]);

  useEffect(() => {
    if (isRunSuccess) {
      addToast({ title: 'Execution confirmed', description: 'The run completed successfully.', kind: 'success' });
    }
  }, [isRunSuccess]);

  useEffect(() => {
    if (isRunError) {
      addToast({ title: 'Execution failed', description: runError?.message || 'The execution request could not be completed.', kind: 'error' });
    }
  }, [isRunError, runError]);

  const explorerBase = chain?.blockExplorers?.default?.url ?? 'https://sepolia.etherscan.io';
  const balanceText = balanceData ? `${Number(balanceData.formatted).toFixed(3)} ${balanceData.symbol}` : '0.000 ETH';

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    if (!registerState.name.trim()) issues.push('Add a skill name');
    if (!registerState.metadataCID.trim()) issues.push('Add a metadata CID');
    if (!registerState.description.trim()) issues.push('Add a description');
    if (Number.isNaN(Number(registerState.pricePerRun)) || Number(registerState.pricePerRun) <= 0) issues.push('Use a positive price');
    return issues;
  }, [registerState]);

  const marketplaceCards = useMemo(() => {
    const baseItems = skills.length > 0
      ? skills.map((skill) => ({
          name: skill.name,
          description: skill.metadataCID,
          creator: shortAddress(address ?? ''),
          price: `${formatEthValue(skill.pricePerRun)} ETH`,
          category: 'On-chain',
          rating: 4.8,
        }))
      : sampleMarketplace;

    return baseItems.filter((item) => `${item.name} ${item.description} ${item.category}`.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [address, searchTerm, skills]);

  const handleRegister = async () => {
    if (!isConnected) {
      addToast({ title: 'Wallet required', description: 'Connect a wallet to register a skill.', kind: 'error' });
      return;
    }

    const price = BigInt(Math.floor(Number(registerState.pricePerRun) * 1e18));
    const hash = (
      registerState.systemPromptHash ||
      keccak256(new TextEncoder().encode(registerState.name.trim() || registerState.metadataCID.trim() || 'Ritual Skill'))
    ) as `0x${string}`;

    setHistory((current) => [
      {
        id: Date.now(),
        timestamp: 'Now',
        wallet: shortAddress(address),
        action: 'Register Skill',
        hash: 'Pending',
        gas: 'Estimating',
        status: 'Pending',
      } satisfies HistoryEntry,
      ...current,
    ].slice(0, 6));

    createSkillWrite.writeContract({
      ...skillRegistryConfig,
      functionName: 'createSkill',
      args: [registerState.name, registerState.metadataCID, hash, price],
    });
  };

  const handleRun = async () => {
    if (!selectedSkill) return;

    setHistory((current) => [
      {
        id: Date.now(),
        timestamp: 'Now',
        wallet: shortAddress(address),
        action: 'Execute Skill',
        hash: 'Pending',
        gas: 'Estimating',
        status: 'Pending',
      } satisfies HistoryEntry,
      ...current,
    ].slice(0, 6));

    runSkillWrite.writeContract({
      ...skillExecutionConfig,
      functionName: 'runSkill',
      args: [selectedSkill.id, promptText],
      value: selectedSkill.pricePerRun,
    });
  };

  const handleToggleActive = async (skill: Skill) => {
    if (!isConnected) return;
    createSkillWrite.writeContract({
      ...skillRegistryConfig,
      functionName: 'toggleActive',
      args: [skill.id],
    });
  };

  const handleEditSkill = (skill: Skill) => {
    setActiveSection('register');
    setRegisterState({
      name: skill.name,
      metadataCID: skill.metadataCID,
      systemPromptHash: skill.systemPromptHash,
      pricePerRun: formatEthValue(skill.pricePerRun),
      category: 'Research',
      description: skill.metadataCID,
      tags: 'edited',
    });
    addToast({ title: 'Skill loaded', description: `${skill.name} is ready for edits.`, kind: 'info' });
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case 'register':
        return (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-stack">
            <div className="panel-card panel-card--wide">
              <div className="panel-card__header">
                <div>
                  <p className="eyebrow">Register</p>
                  <h2>Register a new Ritual skill</h2>
                </div>
                <div className="pill">{isRegistering ? 'Submitting…' : 'On-chain'}</div>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Skill Name</span>
                  <input value={registerState.name} onChange={(event) => setRegisterState((prev) => ({ ...prev, name: event.target.value }))} placeholder="Example: Ritual Summarizer" />
                </label>
                <label className="field">
                  <span>Metadata CID</span>
                  <input value={registerState.metadataCID} onChange={(event) => setRegisterState((prev) => ({ ...prev, metadataCID: event.target.value }))} placeholder="ipfs://..." />
                </label>
                <label className="field">
                  <span>Prompt Hash</span>
                  <input value={registerState.systemPromptHash} onChange={(event) => setRegisterState((prev) => ({ ...prev, systemPromptHash: event.target.value }))} placeholder="0x... or leave blank" />
                </label>
                <label className="field">
                  <span>Price</span>
                  <input value={registerState.pricePerRun} onChange={(event) => setRegisterState((prev) => ({ ...prev, pricePerRun: event.target.value }))} placeholder="0.01" />
                </label>
                <label className="field">
                  <span>Category</span>
                  <input value={registerState.category} onChange={(event) => setRegisterState((prev) => ({ ...prev, category: event.target.value }))} placeholder="Research" />
                </label>
                <label className="field">
                  <span>Tags</span>
                  <input value={registerState.tags} onChange={(event) => setRegisterState((prev) => ({ ...prev, tags: event.target.value }))} placeholder="ai, defi, infra" />
                </label>
                <label className="field field--full">
                  <span>Description</span>
                  <textarea value={registerState.description} onChange={(event) => setRegisterState((prev) => ({ ...prev, description: event.target.value }))} placeholder="Describe the skill, expected output, and what makes it useful." />
                </label>
              </div>

              <div className="validation-card">
                <div className="validation-card__header">
                  <h3>Validation</h3>
                  <span className="pill">{validationIssues.length === 0 ? 'Ready' : `${validationIssues.length} checks`}</span>
                </div>
                <ul>
                  {validationIssues.length === 0 ? <li>All required details look good.</li> : validationIssues.map((issue) => <li key={issue}>{issue}</li>)}
                </ul>
              </div>

              <div className="panel-actions">
                <button className="button button--primary" onClick={handleRegister} disabled={!isConnected || isRegistering || validationIssues.length > 0}>
                  {isRegistering ? 'Submitting on-chain…' : 'Register Skill'}
                </button>
                <div className="progress-track" aria-hidden="true">
                  <div className={`progress-bar ${isRegistering ? 'is-active' : ''}`} />
                </div>
              </div>
            </div>
          </motion.section>
        );
      case 'marketplace':
        return (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-stack">
            <div className="panel-card">
              <div className="panel-card__header">
                <div>
                  <p className="eyebrow">Marketplace</p>
                  <h2>Discover premium Ritual skills</h2>
                </div>
                <div className="search-box">
                  <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search skills" />
                </div>
              </div>
              <div className="market-grid">
                {marketplaceCards.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="market-card">
                    <div className="market-card__top">
                      <div>
                        <p className="market-card__category">{item.category}</p>
                        <h3>{item.name}</h3>
                      </div>
                      <div className="pill">★ {item.rating}</div>
                    </div>
                    <p>{item.description}</p>
                    <div className="market-card__meta">
                      <span>Creator: {item.creator}</span>
                      <span>Price: {item.price}</span>
                    </div>
                    <button className="button button--secondary" onClick={() => { setActiveSection('execute'); setSelectedSkillIndex(0); }}>
                      Execute
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.section>
        );
      case 'my-skills':
        return (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-stack">
            <div className="panel-card">
              <div className="panel-card__header">
                <div>
                  <p className="eyebrow">Portfolio</p>
                  <h2>Your owned skills</h2>
                </div>
                <div className="pill">{skills.length} skills</div>
              </div>
              {isLoadingSkills || isLoadingOwnedIds ? (
                <div className="skeleton-grid">
                  {Array.from({ length: 3 }).map((_, index) => <div key={index} className="skeleton-card" />)}
                </div>
              ) : skills.length === 0 ? (
                <div className="empty-state">No on-chain skills to display yet.</div>
              ) : (
                <div className="skill-list premium-skill-list">
                  {skills.map((skill) => (
                    <article key={skill.id.toString()} className={`premium-skill-card ${skill.active ? 'is-active' : ''}`}>
                      <div className="premium-skill-card__head">
                        <div>
                          <h3>{skill.name}</h3>
                          <p>{skill.metadataCID}</p>
                        </div>
                        <div className={`pill ${skill.active ? 'pill--success' : 'pill--muted'}`}>{skill.active ? 'Active' : 'Paused'}</div>
                      </div>
                      <div className="skill-stats">
                        <div>
                          <span>Earnings</span>
                          <strong>{formatEthValue(skill.pricePerRun)} ETH</strong>
                        </div>
                        <div>
                          <span>Last execution</span>
                          <strong>—</strong>
                        </div>
                      </div>
                      <div className="card-actions">
                        <button className="button button--secondary" onClick={() => handleEditSkill(skill)}>Edit</button>
                        <button className="button button--secondary" onClick={() => handleToggleActive(skill)}>{skill.active ? 'Disable' : 'Enable'}</button>
                        <button className="button button--ghost" onClick={() => addToast({ title: 'Delete unavailable', description: 'Deletion is not available in the current v1 contract.', kind: 'info' })}>Delete</button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.section>
        );
      case 'execute':
        return (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-stack">
            <div className="panel-card panel-card--wide">
              <div className="panel-card__header">
                <div>
                  <p className="eyebrow">Execution</p>
                  <h2>Run a selected skill</h2>
                </div>
                <div className="pill">{isRunning ? 'Processing' : 'Ready'}</div>
              </div>
              <div className="execution-layout">
                <div className="execution-panel">
                  <label className="field">
                    <span>Prompt</span>
                    <textarea value={promptText} onChange={(event) => setPromptText(event.target.value)} placeholder="Ask the skill to generate a response or analysis." />
                  </label>
                  <div className="progress-track" aria-hidden="true">
                    <div className={`progress-bar ${isRunning ? 'is-active' : ''}`} />
                  </div>
                  <button className="button button--primary" onClick={handleRun} disabled={!selectedSkill || !promptText.trim() || !isConnected || isRunning}>
                    {isRunning ? 'Submitting…' : `Run Skill (${selectedSkill ? `${formatEthValue(selectedSkill.pricePerRun)} ETH` : '—'})`}
                  </button>
                </div>
                <div className="execution-panel execution-panel--muted">
                  <p className="eyebrow">Outcome</p>
                  <h3>{selectedSkill ? selectedSkill.name : 'Select a skill'}</h3>
                  <p>{selectedSkill ? 'A premium execution flow is ready for this skill and will submit the prompt to the Ritual precompile.' : 'Choose a skill from the marketplace or your portfolio to begin.'}</p>
                  <div className="log-card">
                    <p>Transaction hash</p>
                    <strong>{runSkillWrite.data ? shortAddress(runSkillWrite.data as string) : 'Awaiting submission'}</strong>
                  </div>
                  <div className="log-card">
                    <p>Execution logs</p>
                    <strong>{isRunning ? 'Pending confirmation on-chain.' : 'Waiting for your input.'}</strong>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        );
      case 'history':
        return (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-stack">
            <div className="panel-card">
              <div className="panel-card__header">
                <div>
                  <p className="eyebrow">Transactions</p>
                  <h2>History and activity</h2>
                </div>
                <div className="pill">{history.length} entries</div>
              </div>
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Wallet</th>
                      <th>Action</th>
                      <th>Hash</th>
                      <th>Gas</th>
                      <th>Status</th>
                      <th>Explorer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry) => (
                      <tr key={entry.id}>
                        <td>{entry.timestamp}</td>
                        <td>{entry.wallet}</td>
                        <td>{entry.action}</td>
                        <td>{entry.hash}</td>
                        <td>{entry.gas}</td>
                        <td><span className={`status-badge ${entry.status.toLowerCase()}`}>{entry.status}</span></td>
                        <td>{entry.hash !== '—' ? <a href={`${explorerBase}/tx/${entry.hash}`} target="_blank" rel="noreferrer">Open</a> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.section>
        );
      case 'analytics':
        return (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-stack">
            <div className="panel-card">
              <div className="panel-card__header">
                <div>
                  <p className="eyebrow">Analytics</p>
                  <h2>Performance insights</h2>
                </div>
              </div>
              <div className="analytics-grid">
                <div className="analytics-card">
                  <h3>Execution activity</h3>
                  <div className="bars">
                    {[70, 96, 84, 110, 118].map((value, index) => <div key={index} className="bar" style={{ height: `${value}px` }} />)}
                  </div>
                </div>
                <div className="analytics-card">
                  <h3>Success rate</h3>
                  <div className="ring">96%</div>
                </div>
                <div className="analytics-card">
                  <h3>Gas usage</h3>
                  <div className="mini-metric">0.0023 ETH</div>
                </div>
                <div className="analytics-card">
                  <h3>Daily transactions</h3>
                  <div className="mini-metric">12 today</div>
                </div>
              </div>
            </div>
          </motion.section>
        );
      case 'settings':
        return (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-stack">
            <div className="panel-card panel-card--wide">
              <div className="panel-card__header">
                <div>
                  <p className="eyebrow">Settings</p>
                  <h2>Configure your Ritual workspace</h2>
                </div>
              </div>
              <div className="settings-grid">
                <div className="settings-card">
                  <h3>Theme</h3>
                  <div className="chip-row">
                    <span className="chip chip--active">Dark</span>
                    <span className="chip">Aurora</span>
                  </div>
                </div>
                <div className="settings-card">
                  <h3>Preferred network</h3>
                  <p>{chain?.name ?? 'Ritual network'}</p>
                </div>
                <div className="settings-card">
                  <h3>RPC endpoint</h3>
                  <p>https://rpc.ritual.network</p>
                </div>
                <div className="settings-card">
                  <h3>Wallet settings</h3>
                  <p>{isConnected ? 'Connected and ready for signature requests.' : 'Connect wallet to unlock transaction signatures.'}</p>
                </div>
                <div className="settings-card settings-card--wide">
                  <h3>Notifications</h3>
                  <p>Receipt, execution, and registry alerts stay enabled for every blockchain action.</p>
                </div>
              </div>
            </div>
          </motion.section>
        );
      default:
        return (
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel-stack">
            <div className="hero-card">
              <div className="hero-card__content">
                <p className="eyebrow">Premium Web3 experience</p>
                <h2>Ritual Skills are now easier to discover, register, and execute.</h2>
                <p>Manage your on-chain skill inventory with a polished workspace designed for agents, builders, and operators.</p>
                <div className="hero-actions">
                  <button className="button button--primary" onClick={() => setActiveSection('register')}>Register Skill</button>
                  <button className="button button--secondary" onClick={() => setActiveSection('execute')}>Execute Skill</button>
                </div>
              </div>
              <div className="hero-card__status">
                <div className="status-pill">Connected: {isConnected ? 'Online' : 'Offline'}</div>
                <div className="status-pill">Network: {chain?.name ?? 'Pending'}</div>
                <div className="status-pill">Balance: {balanceText}</div>
              </div>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <p>Connected wallet</p>
                <h3>{isConnected ? shortAddress(address) : 'Not connected'}</h3>
              </div>
              <div className="stat-card">
                <p>Current network</p>
                <h3>{chain?.name ?? 'Unknown'}</h3>
              </div>
              <div className="stat-card">
                <p>RIT balance</p>
                <h3>{balanceText}</h3>
              </div>
              <div className="stat-card">
                <p>Registered skills</p>
                <h3>{skills.length}</h3>
              </div>
              <div className="stat-card">
                <p>Total executions</p>
                <h3>{history.filter((entry) => entry.action === 'Execute Skill').length}</h3>
              </div>
              <div className="stat-card">
                <p>Successful executions</p>
                <h3>{history.filter((entry) => entry.status === 'Confirmed').length}</h3>
              </div>
              <div className="stat-card">
                <p>Gas used</p>
                <h3>0.0023 ETH</h3>
              </div>
              <div className="stat-card">
                <p>Active skills</p>
                <h3>{skills.filter((skill) => skill.active).length}</h3>
              </div>
            </div>

            <div className="panel-card">
              <div className="panel-card__header">
                <div>
                  <p className="eyebrow">Live overview</p>
                  <h2>Current portfolio snapshot</h2>
                </div>
              </div>
              <div className="metrics-grid">
                <div className="metrics-card">
                  <p>Wallet status</p>
                  <h3>{isConnected ? 'Ready to sign' : 'Connection required'}</h3>
                </div>
                <div className="metrics-card">
                  <p>Registry status</p>
                  <h3>{skills.length > 0 ? 'Skills available' : 'No skills yet'}</h3>
                </div>
                <div className="metrics-card">
                  <p>Contract activity</p>
                  <h3>{history.length} recent actions</h3>
                </div>
              </div>
            </div>
          </motion.section>
        );
    }
  };

  return (
    <div className="premium-shell">
      <aside className={`sidebar ${isMobileNavOpen ? 'is-open' : ''}`}>
        <div className="sidebar__brand">
          <RitualBrand compact />
          <div>
            <p className="sidebar__title">Ritual Skill Hub</p>
            <p className="sidebar__subtitle">Premium Web3 workspace</p>
          </div>
        </div>

        <nav className="sidebar__nav">
          {navItems.map((item) => (
            <button key={item.key} type="button" className={`nav-item ${activeSection === item.key ? 'is-active' : ''}`} onClick={() => { setActiveSection(item.key as NavSection); setIsMobileNavOpen(false); }}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="wallet-preview">
            <div className="avatar">{address ? getInitials(shortAddress(address)) : 'R'}</div>
            <div>
              <p className="wallet-preview__title">{isConnected ? shortAddress(address) : 'Connect wallet'}</p>
              <p className="wallet-preview__meta">{chain?.name ?? 'Ritual network'}</p>
            </div>
          </div>
          {isConnected ? (
            <button className="button button--secondary" onClick={() => disconnect()}>Disconnect</button>
          ) : (
            <button className="button button--primary" onClick={() => connect({ connector: connectors[0] ?? injected() })} disabled={connectPending}>
              {connectPending ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="topbar">
          <button className="mobile-nav-toggle" type="button" onClick={() => setIsMobileNavOpen((current) => !current)}>
            ☰
          </button>
          <div className="topbar__title">
            <RitualBrand compact />
            <div>
              <h1>Ritual Skill Hub</h1>
              <p>Premium Web3 operations for Ritual skills</p>
            </div>
          </div>
          <div className="topbar__actions">
            <div className="top-pill">{chain?.name ?? 'Ritual Network'}</div>
            <div className="top-pill">{balanceText}</div>
            <div className="top-pill">{isConnected ? shortAddress(address) : 'Not connected'}</div>
            <button className="icon-button" type="button" aria-label="Notifications">🔔</button>
            <button className="icon-button" type="button" aria-label="Settings">⚙️</button>
          </div>
        </header>

        <AnimatePresence mode="wait">{renderSectionContent()}</AnimatePresence>

        <TransactionStatus title="Registration" isPending={isRegistering} isSuccess={isRegisterSuccess} isError={isRegisterError} error={registerError as Error | undefined} hash={createSkillWrite.data} />
        <TransactionStatus title="Execution" isPending={isRunning} isSuccess={isRunSuccess} isError={isRunError} error={runError as Error | undefined} hash={runSkillWrite.data} />
      </main>

      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.kind}`}>
            <div>
              <strong>{toast.title}</strong>
              <p>{toast.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
