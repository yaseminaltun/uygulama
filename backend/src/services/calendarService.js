import { getAllFollowedEvents } from './homeService.js';
import { byStartTime } from './providerUtils.js';

export async function getCalendarEvents() {
  const events = await getAllFollowedEvents();
  return events.sort(byStartTime);
}
