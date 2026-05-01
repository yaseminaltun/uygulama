import { football } from '../data/mockData.js';
import { env } from '../config/env.js';
import { byStartTime, createMemoryCache, getEventStatus, toIstanbulIso, warnFallback, withSource } from './providerUtils.js';

const cache = createMemoryCache();
const STANDINGS_UNAVAILABLE_MESSAGE = 'Süper Lig standings are unavailable from the configured free football API.';
const TEAM_SEARCH_PATHS = ['/teams?search={search}', '/team?search={search}', '/teams/search/{search}', '/search/teams?query={search}', '/search?type=team&query={search}'];
const LEAGUE_SEARCH_PATHS = ['/leagues?search={search}', '/league?search={search}', '/leagues/search/{search}', '/search/leagues?query={search}', '/search?type=league&query={search}'];
const LIVE_PATHS = ['/matches/live', '/fixtures/live', '/livescores', '/live', '/matches?live=true'];
const FIXTURE_PATHS = [
  '/matches?team={teamId}',
  '/fixtures?team={teamId}',
  '/teams/{teamId}/matches',
  '/teams/{teamId}/fixtures',
  '/matches/team/{teamId}',
  '/fixtures/team/{teamId}'
];
const STANDINGS_PATHS = ['/standings?league={leagueId}', '/leagues/{leagueId}/standings', '/standings/{leagueId}', '/tables?league={leagueId}'];

export async function getFootballDashboard() {
  return cache(loadFootballDashboard);
}

async function loadFootballDashboard() {
  try {
    assertFootballConfig();

    const [fenerbahce, turkiye, superLig] = await Promise.all([
      findFootballTeam('Fenerbahce'),
      findFootballTeam('Turkey'),
      findFootballLeague('Super Lig')
    ]);

    if (!fenerbahce?.id || !turkiye?.id) {
      throw new Error('Could not resolve Fenerbahçe and Türkiye team IDs from configured football API.');
    }

    const [fenerbahceFixtures, turkiyeFixtures, livePayload, standingsPayload] = await Promise.all([
      fetchFirstWorking(FIXTURE_PATHS, { teamId: fenerbahce.id }),
      fetchFirstWorking(FIXTURE_PATHS, { teamId: turkiye.id }),
      fetchFirstWorking(LIVE_PATHS).catch((error) => {
        console.warn(`[Football] live scores unavailable: ${error.message}`);
        return null;
      }),
      superLig?.id
        ? fetchFirstWorking(STANDINGS_PATHS, { leagueId: superLig.id }).catch((error) => {
            console.warn(`[Football] standings unavailable: ${error.message}`);
            return null;
          })
        : null
    ]);

    const matches = dedupeFixtures([
      ...normalizeFixtures(fenerbahceFixtures),
      ...normalizeFixtures(turkiyeFixtures),
      ...normalizeFixtures(livePayload).filter(isTrackedFixture)
    ]).sort(byStartTime);
    const superLigStandings = normalizeStandings(standingsPayload);

    console.info(`[Football] source=api fixtures=${matches.length} standings=${superLigStandings.length}`);

    return {
      source: 'api',
      teams: football.teams,
      matches,
      superLigStandings,
      standingsUnavailable: superLigStandings.length === 0,
      message: superLigStandings.length === 0 ? STANDINGS_UNAVAILABLE_MESSAGE : undefined
    };
  } catch (error) {
    warnFallback('Football', error);
    return {
      ...football,
      source: 'mock-fallback',
      matches: withSource(football.matches, 'mock-fallback'),
      superLigStandings: withSource(football.superLigStandings, 'mock-fallback')
    };
  }
}

export async function getFootballEvents() {
  const dashboard = await getFootballDashboard();
  return dashboard.matches;
}

export async function searchFootballTeams(search) {
  assertFootballConfig();
  const payloads = await fetchAllWorking(TEAM_SEARCH_PATHS, { search: encodeURIComponent(search) });
  const teams = dedupeById(payloads.flatMap((payload) => extractArrays(payload).flatMap(normalizeTeamCandidate))).filter((team) => namesMatch(team.name, search));

  return {
    source: 'api',
    query: search,
    teams,
    attemptedPaths: TEAM_SEARCH_PATHS.map((path) => interpolate(path, { search: encodeURIComponent(search) }))
  };
}

export async function searchFootballLeagues(search) {
  assertFootballConfig();
  const payloads = await fetchAllWorking(LEAGUE_SEARCH_PATHS, { search: encodeURIComponent(search) });
  const leagues = dedupeById(payloads.flatMap((payload) => extractArrays(payload).flatMap(normalizeLeagueCandidate))).filter((league) => namesMatch(league.name, search));

  return {
    source: 'api',
    query: search,
    leagues,
    attemptedPaths: LEAGUE_SEARCH_PATHS.map((path) => interpolate(path, { search: encodeURIComponent(search) }))
  };
}

function assertFootballConfig() {
  const missing = [
    ['RAPIDAPI_FOOTBALL_KEY', env.rapidApiFootballKey],
    ['RAPIDAPI_FOOTBALL_HOST', env.rapidApiFootballHost],
    ['RAPIDAPI_FOOTBALL_BASE_URL', env.rapidApiFootballBaseUrl]
  ].filter(([, value]) => !value);

  if (missing.length) {
    throw new Error(`Missing football env vars: ${missing.map(([key]) => key).join(', ')}`);
  }
}

async function findFootballTeam(search) {
  const result = await searchFootballTeams(search);
  return result.teams[0] || null;
}

async function findFootballLeague(search) {
  const result = await searchFootballLeagues(search).catch((error) => {
    console.warn(`[Football] league search failed: ${error.message}`);
    return { leagues: [] };
  });
  return result.leagues[0] || null;
}

async function fetchAllWorking(paths, params = {}) {
  const results = [];

  for (const pathTemplate of paths) {
    try {
      results.push(await getFootball(interpolate(pathTemplate, params)));
    } catch (error) {
      console.warn(`[Football] endpoint failed ${interpolate(pathTemplate, params)}: ${error.message}`);
    }
  }

  if (!results.length) {
    throw new Error(`No configured football endpoints worked for: ${paths.join(', ')}`);
  }

  return results;
}

async function fetchFirstWorking(paths, params = {}) {
  const errors = [];

  for (const pathTemplate of paths) {
    const path = interpolate(pathTemplate, params);
    try {
      return await getFootball(path);
    } catch (error) {
      errors.push(`${path}: ${error.message}`);
      console.warn(`[Football] endpoint failed ${path}: ${error.message}`);
    }
  }

  throw new Error(errors.join(' | '));
}

function getFootball(path) {
  const url = `${env.rapidApiFootballBaseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  console.info(`[Football] GET ${url}`);

  return fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-RapidAPI-Key': env.rapidApiFootballKey,
      'X-RapidAPI-Host': env.rapidApiFootballHost
    }
  }).then(async (response) => {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    console.info(`[Football] response status=${response.status} shape=${describeShape(payload)}`);

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }

    return payload;
  });
}

function normalizeFixtures(payload) {
  return extractArrays(payload).flatMap((item) => {
    const fixture = item.fixture || item.match || item.game || item;
    const teams = item.teams || item;
    const home = teams.home?.name || teams.homeTeam?.name || item.home_name || item.homeTeam || item.home || fixture.home || 'Home';
    const away = teams.away?.name || teams.awayTeam?.name || item.away_name || item.awayTeam || item.away || fixture.away || 'Away';
    const rawStart = fixture.date || fixture.startTime || fixture.start_time || item.date || item.time || item.match_time;

    if (!rawStart || home === 'Home' || away === 'Away') return [];

    const startTime = toIstanbulIso(rawStart);
    const status = getEventStatus(startTime, fixture.status?.short || fixture.status || item.status || item.match_status);
    const homeGoals = item.goals?.home ?? item.score?.home ?? item.home_score ?? item.homeScore ?? item.score?.fulltime?.home;
    const awayGoals = item.goals?.away ?? item.score?.away ?? item.away_score ?? item.awayScore ?? item.score?.fulltime?.away;
    const hasScore = homeGoals !== null && homeGoals !== undefined && awayGoals !== null && awayGoals !== undefined;

    return [{
      id: `football-${fixture.id || item.id || `${home}-${away}-${startTime}`}`.toLowerCase().replaceAll(' ', '-'),
      sport: 'Football',
      title: `${stringifyName(home)} vs ${stringifyName(away)}`,
      competition: item.league?.name || item.competition?.name || item.league_name || item.competition || 'Football',
      participants: [stringifyName(home), stringifyName(away)],
      startTime,
      status,
      score: status === 'live' && hasScore ? `${homeGoals}-${awayGoals}` : null,
      result: status === 'finished' && hasScore ? `${stringifyName(home)} ${homeGoals}-${awayGoals} ${stringifyName(away)}` : null,
      source: 'api'
    }];
  }).filter(isTrackedFixture);
}

function normalizeStandings(payload) {
  return extractArrays(payload).flatMap((row) => {
    const team = row.team || row.club || row;
    const name = team.name || row.team_name || row.name;
    const position = row.rank || row.position || row.pos;

    if (!name || !position) return [];

    return [{
      position,
      team: name,
      played: row.played || row.matches || row.all?.played || 0,
      wins: row.wins || row.win || row.all?.win || 0,
      draws: row.draws || row.draw || row.all?.draw || 0,
      losses: row.losses || row.lose || row.all?.lose || 0,
      points: row.points || row.pts || 0,
      source: 'api'
    }];
  });
}

function normalizeTeamCandidate(item) {
  const team = item.team || item;
  const id = team.id || team.team_id || item.teamId || item.id;
  const name = team.name || team.team_name || item.name;
  if (!id || !name) return [];
  return [{ id, name, country: team.country || item.country, raw: item }];
}

function normalizeLeagueCandidate(item) {
  const league = item.league || item.competition || item;
  const id = league.id || league.league_id || item.leagueId || item.id;
  const name = league.name || league.league_name || item.name;
  if (!id || !name) return [];
  return [{ id, name, country: league.country || item.country, raw: item }];
}

function extractArrays(value, depth = 0) {
  if (!value || depth > 5) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object') return [];
  return Object.values(value).flatMap((child) => extractArrays(child, depth + 1));
}

function dedupeFixtures(fixtures) {
  return Array.from(new Map(fixtures.map((fixture) => [fixture.id, fixture])).values());
}

function dedupeById(items) {
  return Array.from(new Map(items.map((item) => [`${item.id}-${normalizeName(item.name)}`, item])).values());
}

function isTrackedFixture(fixture) {
  return fixture.participants?.some((name) => {
    const normalized = normalizeName(name);
    return normalized.includes('fenerbahce') || normalized.includes('fenerbahçe') || normalized.includes('turkey') || normalized.includes('turkiye') || normalized.includes('türkiye');
  });
}

function namesMatch(candidate, search) {
  const normalizedCandidate = normalizeName(candidate);
  const normalizedSearch = normalizeName(search);
  return normalizedCandidate.includes(normalizedSearch) || normalizedSearch.split(/\s+/).every((part) => normalizedCandidate.includes(part));
}

function normalizeName(value) {
  return stringifyName(value).toLowerCase();
}

function stringifyName(value) {
  if (typeof value === 'string') return value;
  return value?.name || String(value || '');
}

function interpolate(template, params) {
  return Object.entries(params).reduce((path, [key, value]) => path.replaceAll(`{${key}}`, value), template);
}

function describeShape(payload) {
  if (Array.isArray(payload)) return `array(length=${payload.length})`;
  if (!payload || typeof payload !== 'object') return typeof payload;
  const keys = Object.keys(payload);
  const arrayKey = keys.find((key) => Array.isArray(payload[key]));
  return `object(keys=${keys.join(',')}${arrayKey ? ` ${arrayKey}.length=${payload[arrayKey].length}` : ''})`;
}
