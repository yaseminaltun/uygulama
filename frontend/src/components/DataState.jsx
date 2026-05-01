export function LoadingState({ label = 'Loading sports data...' }) {
  return <div className="state-box">{label}</div>;
}

export function ErrorState({ message = 'Could not load data.' }) {
  return <div className="state-box error">{message}</div>;
}

export function EmptyState({ message = 'No followed events found.' }) {
  return <div className="state-box">{message}</div>;
}
