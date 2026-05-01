import { useMemo, useState } from 'react';
import { api } from '../services/api.js';
import { useApi } from '../hooks.js';
import { ErrorState, LoadingState } from '../components/DataState.jsx';
import EventCard from '../components/EventCard.jsx';
import SectionHeader from '../components/SectionHeader.jsx';
import SportBadge from '../components/SportBadge.jsx';

export default function CalendarPage() {
  const { data, loading, error } = useApi(api.calendar);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const month = useMemo(() => new Date(), []);
  const days = useMemo(() => buildMonth(month), [month]);
  const eventsByDate = useMemo(() => groupEvents(data || []), [data]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState />;

  return (
    <div className="page-stack">
      <SectionHeader eyebrow="Calendar" title={month.toLocaleDateString([], { month: 'long', year: 'numeric' })}>
        Combined monthly view for followed tennis and F1 events.
      </SectionHeader>

      <section className="calendar-grid" aria-label="Monthly event calendar">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <div className="calendar-weekday" key={day}>{day}</div>
        ))}
        {days.map((day) => {
          const key = toDateKey(day.date);
          const dayEvents = eventsByDate[key] || [];
          return (
            <div className={day.isCurrentMonth ? 'calendar-day' : 'calendar-day muted-day'} key={key}>
              <span className="calendar-date">{day.date.getDate()}</span>
              <div className="calendar-events">
                {dayEvents.map((event) => (
                  <button className="calendar-event" key={event.id} onClick={() => setSelectedEvent(event)} type="button">
                    <SportBadge sport={event.sport} />
                    <span>{new Date(event.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <strong>{event.title}</strong>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {selectedEvent && (
        <div className="modal-backdrop" onClick={() => setSelectedEvent(null)} role="presentation">
          <div className="modal-panel" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-close" onClick={() => setSelectedEvent(null)} type="button">Close</button>
            <EventCard event={selectedEvent} />
          </div>
        </div>
      )}
    </div>
  );
}

function buildMonth(anchorDate) {
  const year = anchorDate.getFullYear();
  const month = anchorDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  const mondayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return { date, isCurrentMonth: date.getMonth() === month };
  });
}

function groupEvents(events) {
  return events.reduce((groups, event) => {
    const key = event.startTime.slice(0, 10);
    groups[key] = groups[key] || [];
    groups[key].push(event);
    return groups;
  }, {});
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}
