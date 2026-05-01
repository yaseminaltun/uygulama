import SportBadge from './SportBadge.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function EventCard({ event, compact = false, onClick }) {
  const start = new Date(event.startTime);
  const className = ['event-card', compact ? 'compact' : '', getEventSessionClassName(event)].filter(Boolean).join(' ');

  return (
    <article className={className} onClick={onClick}>
      <div className="event-card-top">
        <SportBadge sport={event.sport} />
        <StatusBadge status={event.status} />
      </div>
      <h3>{event.title}</h3>
      <p className="muted">{event.competition}</p>
      <p>{event.participants?.join(' vs ')}</p>
      <div className="event-meta">
        <span>{start.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
        <span>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {event.score && <p className="score live-score">{event.score}</p>}
      {event.result && <p className="score">{event.result}</p>}
    </article>
  );
}

function getEventSessionClassName(event) {
  if (String(event.sport || '').toLowerCase() !== 'f1') {
    return '';
  }

  const name = String(event.sessionName || event.title || '').toLowerCase();

  if (name.includes('practice')) return 'session-practice';
  if (name.includes('sprint')) return 'session-sprint';
  if (name.includes('qualifying')) return 'session-qualifying';
  if (name.includes('race')) return 'session-race';
  return '';
}
