import SportBadge from './SportBadge.jsx';
import StatusBadge from './StatusBadge.jsx';

export default function EventCard({ event, compact = false, onClick }) {
  const start = new Date(event.startTime);

  return (
    <article className={compact ? 'event-card compact' : 'event-card'} onClick={onClick}>
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
