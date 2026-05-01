import { api } from '../services/api.js';
import { useApi } from '../hooks.js';
import { ErrorState, LoadingState } from '../components/DataState.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Table from '../components/Table.jsx';

const resultColumns = [
  { key: 'position', label: 'Pos' },
  { key: 'driver', label: 'Driver' },
  { key: 'team', label: 'Team' },
  { key: 'time', label: 'Time' }
];

const driverColumns = [
  { key: 'position', label: 'Pos' },
  { key: 'driver', label: 'Driver' },
  { key: 'team', label: 'Team' },
  { key: 'points', label: 'Pts' }
];

const constructorColumns = [
  { key: 'position', label: 'Pos' },
  { key: 'team', label: 'Team' },
  { key: 'points', label: 'Pts' }
];

export default function F1Page() {
  const { data, loading, error } = useApi(api.f1);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  return (
    <div className="page-stack">
      <SectionHeader eyebrow="Formula 1" title={data.weekend.name}>
        {data.weekend.circuit} · {data.weekend.location}
      </SectionHeader>

      <section className="session-grid">
        {data.weekend.sessions.map((session) => {
          const start = new Date(session.startTime);
          return (
            <article className="session-card" key={session.id}>
              <div>
                <h2>{session.name}</h2>
                <p>{start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</p>
              </div>
              <div className="session-time">
                <strong>{start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong>
                <StatusBadge status={session.status} />
              </div>
            </article>
          );
        })}
      </section>

      <section className="two-column">
        <div className="section-block">
          <h2>Race Results</h2>
          <Table columns={resultColumns} rows={data.raceResults} />
        </div>
        <div className="section-block">
          <h2>Driver Standings</h2>
          <Table columns={driverColumns} rows={data.driverStandings} />
        </div>
      </section>

      <section className="section-block">
        <h2>Constructor Standings</h2>
        <Table columns={constructorColumns} rows={data.constructorStandings} />
      </section>
    </div>
  );
}
