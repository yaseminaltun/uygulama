import { getTodayEvents, getUpcomingEvents } from '../services/homeService.js';

export async function today(req, res, next) {
  try {
    res.json({ data: await getTodayEvents() });
  } catch (error) {
    next(error);
  }
}

export async function upcoming(req, res, next) {
  try {
    res.json({ data: await getUpcomingEvents() });
  } catch (error) {
    next(error);
  }
}
