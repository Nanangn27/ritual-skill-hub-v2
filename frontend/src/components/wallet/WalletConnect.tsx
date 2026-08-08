'use client';

import { injected } from 'wagmi';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

export default function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isLoading: connectPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
          <div>
            <p style={{ margin: 0, color: '#94a3b8' }}>Connected wallet</p>
            <p style={{ margin: '0.35rem 0 0', fontWeight: 600, color: '#fff' }}>{address}</p>
          </div>
          <button type="button" className="secondary" onClick={() => disconnect()}>
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="section-card">
      <h2>Wallet Connect</h2>
      <p className="note-text">Use your injected wallet to sign transactions and manage skills on Ritual.</p>
      <button
        type="button"
        className="primary"
        onClick={() => connect({ connector: injected() })}
        disabled={connectPending}
      >
        {connectPending ? 'Connecting…' : 'Connect Wallet'}
      </button>
    </div>
  );
}
