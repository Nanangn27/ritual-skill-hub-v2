'use client';

interface TransactionStatusProps {
  title: string;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  error?: Error;
  hash?: string;
}

export default function TransactionStatus({ title, isPending, isSuccess, isError, error, hash }: TransactionStatusProps) {
  if (!isPending && !isSuccess && !isError) {
    return null;
  }

  return (
    <div className={`section-card ${isError ? 'status-error' : ''}`}>
      <h2>{title}</h2>
      {isPending && <p className="note-text">Transaction pending. Please wait for the network confirmation.</p>}
      {isSuccess && <p className="note-text">Transaction confirmed{hash ? `: ${hash}` : '.'}</p>}
      {isError && (
        <p className="note-text">{error?.message || 'A transaction error occurred. Please try again.'}</p>
      )}
      {hash && (
        <p style={{ marginTop: '0.75rem' }}>
          <span className="badge">Hash</span> {hash}
        </p>
      )}
    </div>
  );
}
