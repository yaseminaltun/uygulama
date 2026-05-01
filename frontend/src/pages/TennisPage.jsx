import { api } from '../services/api.js';
import { useApi } from '../hooks.js';
import { ErrorState, LoadingState } from '../components/DataState.jsx';
import EventCard from '../components/EventCard.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import Table from '../components/Table.jsx';

const rankingColumns = [
  { key: 'ranking', label: 'Rank' },
  { key: 'name', label: 'Player' },
  { key: 'points', label: 'Points' }
];

export default function TennisPage() {
  const { data, loading, error } = useApi(api.tennis);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  return (
    <div className="page-stack tennis-page">
      <SectionHeader eyebrow="Tennis" title="Sinner & Alcaraz">
        Upcoming matches, live scores, recent results, and ranking availability for the selected players.
      </SectionHeader>
      {data.rankingMessage && <div className="state-box">{data.rankingMessage}</div>}

      <section className="player-grid">
        {data.players.map((player) => (
          <article className="player-card" key={player.id}>
            <span className="eyebrow">{player.country}</span>
            <h2>{player.name}</h2>
            <div className="stat-row">
              <span>ATP Rank</span>
              <strong>{player.ranking === 'Unavailable' ? player.ranking : `#${player.ranking}`}</strong>
            </div>
            <div className="stat-row">
              <span>Points</span>
              <strong>{typeof player.points === 'number' ? player.points.toLocaleString() : player.points}</strong>
            </div>
          </article>
        ))}
      </section>

      <section className="section-block">
        <h2>Matches</h2>
        <div className="event-grid">
          {data.matches.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      </section>

      <section className="section-block">
        <h2>ATP Ranking Points</h2>
        <Table columns={rankingColumns} rows={data.rankings || data.players} getRowClassName={getRankingRowClassName} />
      </section>
    </div>
  );
}

function getRankingRowClassName(row) {
  const name = String(row.name || '').toLowerCase();

  if (name.includes('sinner')) return 'highlight-row highlight-sinner';
  if (name.includes('alcaraz')) return 'highlight-row highlight-alcaraz';
  return row.isTracked ? 'highlight-row' : '';
}
