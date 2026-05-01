import { api } from '../services/api.js';
import { useApi } from '../hooks.js';
import EventCard from '../components/EventCard.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/DataState.jsx';
import SectionHeader from '../components/SectionHeader.jsx';

export default function HomePage() {
  const today = useApi(api.today);
  const upcoming = useApi(api.upcoming);

  return (
    <div className="page-stack">
      <SectionHeader eyebrow="Focused dashboard" title="Today's Followed Events">
        Only Sinner, Alcaraz, and Formula 1 events are tracked here.
      </SectionHeader>

      {today.loading && <LoadingState />}
      {today.error && <ErrorState />}
      {!today.loading && !today.error && today.data?.length === 0 && <EmptyState />}
      <section className="event-grid">
        {today.data?.map((event) => (
          <EventCard event={event} key={event.id} />
        ))}
      </section>

      <section className="section-block">
        <h2>Upcoming Events</h2>
        {upcoming.loading && <LoadingState label="Loading upcoming events..." />}
        {upcoming.error && <ErrorState />}
        <div className="event-list">
          {upcoming.data?.map((event) => (
            <EventCard compact event={event} key={event.id} />
          ))}
        </div>
      </section>
    </div>
  );
}
