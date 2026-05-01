import { getCalendarEvents } from '../services/calendarService.js';
import { getFormulaOneDashboard } from '../services/f1Service.js';
import { getFootballDashboard } from '../services/footballService.js';
import { getTennisDashboard } from '../services/tennisService.js';

export async function tennis(req, res, next) {
  try {
    res.json({ data: await getTennisDashboard() });
  } catch (error) {
    next(error);
  }
}

export async function formulaOne(req, res, next) {
  try {
    res.json({ data: await getFormulaOneDashboard() });
  } catch (error) {
    next(error);
  }
}

export async function football(req, res, next) {
  try {
    res.json({ data: await getFootballDashboard() });
  } catch (error) {
    next(error);
  }
}

export async function calendar(req, res, next) {
  try {
    res.json({ data: await getCalendarEvents() });
  } catch (error) {
    next(error);
  }
}
