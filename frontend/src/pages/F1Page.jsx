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

const F1_TEAM_COLORS = {
  Mercedes: '#27F4D2',
  'Red Bull Racing': '#3671C6',
  Ferrari: '#E8002D',
  McLaren: '#FF8000',
  Alpine: '#00A1E8',
  'Racing Bulls': '#6692FF',
  'Aston Martin': '#229971',
  Williams: '#1868DB',
  Audi: '#FF2D00',
  Haas: '#DEE1E2',
  Cadillac: '#AAAAAD'
};

const constructorColumns = [
  { key: 'position', label: 'Pos' },
  { key: 'team', label: 'Team', render: (row) => <TeamBadge team={row.team} /> },
  { key: 'points', label: 'Pts' }
];

export default function F1Page() {
  const { data, loading, error } = useApi(api.f1);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  return (
    <div className="page-stack f1-page">
      <SectionHeader eyebrow="Formula 1" title={data.weekend.name}>
        {data.weekend.circuit} · {data.weekend.location}
      </SectionHeader>

      <section className="session-grid">
        {data.weekend.sessions.map((session) => {
          const start = new Date(session.startTime);
          return (
            <article className={`session-card ${getSessionClassName(session.name)}`} key={session.id}>
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
        <Table
          columns={constructorColumns}
          rows={data.constructorStandings}
          getRowClassName={() => 'constructor-row'}
          getRowStyle={(row) => ({ '--team-color': getTeamColor(row.team) })}
        />
      </section>
    </div>
  );
}

function getSessionClassName(sessionName) {
  const name = String(sessionName || '').toLowerCase();

  if (name.includes('practice')) return 'session-practice';
  if (name.includes('sprint')) return 'session-sprint';
  if (name.includes('qualifying')) return 'session-qualifying';
  if (name.includes('race')) return 'session-race';
  return '';
}

function TeamBadge({ team }) {
  return (
    <span className="team-badge" style={{ '--team-color': getTeamColor(team) }}>
      <span className="team-color-dot" aria-hidden="true" />
      {team}
    </span>
  );
}

function getTeamColor(team) {

  const name = String(team || '').toLowerCase();

  if (name.includes('mercedes')) return '#27F4D2';

  if (name.includes('red bull') && !name.includes('racing bulls') && !name.includes('rb f1')) return '#3671C6';

  if (name.includes('ferrari')) return '#E8002D';

  if (name.includes('mclaren')) return '#FF8000';

  if (name.includes('alpine')) return '#00A1E8';

  if (name.includes('racing bulls') || name.includes('rb f1')) return '#6692FF';

  if (name.includes('aston martin')) return '#229971';

  if (name.includes('williams')) return '#1868DB';

  if (name.includes('audi')) return '#FF2D00';

  if (name.includes('haas')) return '#DEE1E2';

  if (name.includes('cadillac')) return '#AAAAAD';

  return '#CBD5E1';

}

function normalizeTeamName(team) {
  return String(team || '').trim().toLowerCase();
}
