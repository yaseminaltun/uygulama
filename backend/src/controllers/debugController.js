import { searchFootballLeagues, searchFootballTeams } from '../services/footballService.js';
import { inspectRawTennisFixtures, inspectTennisFixtures, searchTennisPlayer } from '../services/tennisService.js';

export async function debugFootballTeams(req, res, next) {
  try {
    const search = String(req.query.search || '').trim();

    if (!search) {
      return res.status(400).json({ error: 'Missing required query parameter: search' });
    }

    return res.json({ data: await searchFootballTeams(search) });
  } catch (error) {
    if (error.message?.startsWith('Missing ')) {
      return res.status(400).json({ error: error.message });
    }

    return next(error);
  }
}

export async function debugFootballLeagues(req, res, next) {
  try {
    const search = String(req.query.search || '').trim();

    if (!search) {
      return res.status(400).json({ error: 'Missing required query parameter: search' });
    }

    return res.json({ data: await searchFootballLeagues(search) });
  } catch (error) {
    if (error.message?.startsWith('Missing ')) {
      return res.status(400).json({ error: error.message });
    }

    return next(error);
  }
}

export async function debugTennisFixtures(req, res, next) {
  try {
    return res.json({
      data: await inspectTennisFixtures({
        date: req.query.date,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        playerId: req.query.playerId,
        search: req.query.search
      })
    });
  } catch (error) {
    if (error.message?.startsWith('Missing ')) {
      return res.status(400).json({ error: error.message });
    }

    return next(error);
  }
}

export async function debugTennisRawFixtures(req, res, next) {
  try {
    return res.json(await inspectRawTennisFixtures());
  } catch (error) {
    if (error.message?.startsWith('Missing ')) {
      return res.status(400).json({ error: error.message });
    }

    return next(error);
  }
}

export async function debugTennisSearchPlayer(req, res, next) {
  try {
    const name = String(req.query.name || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'Missing required query parameter: name' });
    }

    return res.json({ data: await searchTennisPlayer(name) });
  } catch (error) {
    if (error.message?.startsWith('Missing ')) {
      return res.status(400).json({ error: error.message });
    }

    return next(error);
  }
}
