import { getFormulaOneEvents } from './f1Service.js';
import { getTennisEvents } from './tennisService.js';
import { byStartTime, dateKeyInIstanbul, isWithinDays } from './providerUtils.js';

export async function getTodayEvents() {
  const today = dateKeyInIstanbul();
  const events = await getAllFollowedEvents();

  return events
    .filter((event) => event.startTime.startsWith(today))
    .sort(byStartTime);
}

export async function getUpcomingEvents(days = 5) {
  const events = await getAllFollowedEvents();

  return events
    .filter((event) => isWithinDays(event, days))
    .sort(byStartTime);
}

export async function getAllFollowedEvents() {
  const [tennisEvents, f1Events] = await Promise.all([
    getTennisEvents(),
    getFormulaOneEvents()
  ]);

  return [...tennisEvents, ...f1Events].sort(byStartTime);
}
