import { tennis } from '../data/mockData.js';
import { env } from '../config/env.js';
import { addDaysDateKey, byStartTime, createMemoryCache, getEventStatus, warnFallback, withSource } from './providerUtils.js';

const BASE_URL = 'https://tennis-api-atp-wta-itf.p.rapidapi.com';
const TRACKED_PLAYERS = ['Jannik Sinner', 'Carlos Alcaraz'];
const cache = createMemoryCache();
const playerLookupCache = new Map();

export async function getTennisDashboard() {
  return cache(loadTennisDashboard);
}

async function loadTennisDashboard() {
  try {
    assertTennisConfig();

    const fixturePayload = await getTennis(`/tennis/v2/atp/fixtures/${addDaysDateKey(-7)}/${addDaysDateKey(14)}`);
    const rankingResult = await getAtpRankings();
    const matches = dedupeMatches(normalizeTennisFixtures(fixturePayload))
      .filter(isRelevantTennisWindow)
      .sort(byStartTime);

    console.info(`[Tennis] source=api matches=${matches.length} rankings=${rankingResult.rankings.length}`);

    return {
      source: 'api',
      players: rankingResult.players,
      rankings: rankingResult.rankings,
      rankingsUnavailable: rankingResult.unavailable,
      message: rankingResult.message,
      rankingMessage: rankingResult.message,
      matches
    };
  } catch (error) {
    warnFallback('Tennis', error);
    return {
      ...tennis,
      source: 'mock-fallback',
      players: withSource(tennis.players, 'mock-fallback'),
      matches: withSource(tennis.matches, 'mock-fallback')
    };
  }
}

async function getAtpRankings() {
  try {
    const payload = await getTennis('/tennis/v2/atp/ranking/singles/');
    const rankingData = normalizeRankings(payload);

    if (!rankingData.players.length) {
      return {
        unavailable: true,
        message: 'ATP rankings could not be loaded from the configured API.',
        players: getUnavailableRankingPlayers(),
        rankings: []
      };
    }

    return { unavailable: false, message: undefined, ...rankingData };
  } catch (error) {
    console.warn(`[Tennis] ranking endpoint failed: ${error.message}`);
    return {
      unavailable: true,
      message: 'ATP rankings could not be loaded from the configured API.',
      players: getUnavailableRankingPlayers(),
      rankings: []
    };
  }
}

export async function getTennisEvents() {
  const dashboard = await getTennisDashboard();
  return dashboard.matches;
}

function getTennis(path) {
  const url = `${BASE_URL}${path}`;
  console.info(`[Tennis] GET ${url}`);

  return fetch(url, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-RapidAPI-Host': 'tennis-api-atp-wta-itf.p.rapidapi.com',
      'X-RapidAPI-Key': env.rapidApiTennisKey
    }
  }).then(async (response) => {
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();
    console.info(`[Tennis] response status=${response.status} shape=${describeShape(payload)}`);

    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText} for ${url}`);
    }

    return payload;
  });
}

export async function searchTennisPlayer(name) {
  if (!env.rapidApiTennisKey) {
    throw new Error('Missing RAPIDAPI_TENNIS_KEY');
  }

  const lookup = await lookupTennisPlayer(name);
  return {
    source: lookup.source,
    query: name,
    verifiedId: lookup.verifiedId,
    confidence: lookup.confidence,
    candidates: lookup.candidates,
    attemptedPaths: lookup.attemptedPaths
  };
}

async function lookupTennisPlayer(fullName, optionalEnvId = '') {
  const cacheKey = `${normalizeName(fullName)}:${optionalEnvId || ''}`;
  if (playerLookupCache.has(cacheKey)) {
    return playerLookupCache.get(cacheKey);
  }

  const attemptedPaths = [];
  const candidates = [];
  const expected = normalizeName(fullName);

  // The public docs/search results do not expose a reliable player-search route for this provider.
  // Inspect fixtures/rankings first, then try likely search paths for plans that may support them.
  const candidatePaths = [
    `/tennis/v2/atp/fixtures/${addDaysDateKey(-30)}/${addDaysDateKey(60)}`,
    '/tennis/v2/atp/fixtures',
    '/tennis/v2/atp/rankings',
    `/tennis/v2/atp/players/search/${encodeURIComponent(fullName)}`,
    `/tennis/v2/atp/players?search=${encodeURIComponent(fullName)}`,
    `/tennis/v2/atp/search/player/${encodeURIComponent(fullName)}`
  ];

  if (optionalEnvId) {
    console.info(`[Tennis] TENNIS player env id for ${fullName} is set, but will be verified by API before use.`);
  }

  for (const path of candidatePaths) {
    attemptedPaths.push(path);
    try {
      const payload = await getTennis(path);
      const found = extractPlayerCandidates(payload).filter((candidate) => namesMatch(candidate.name, expected));
      candidates.push(...found.map((candidate) => ({ ...candidate, path })));

      const verified = found.find((candidate) => candidate.id);
      if (verified) {
        console.info(`[Tennis] verified player ${fullName}: ${verified.name} (${verified.id}) via ${path}`);
        const result = {
          source: 'api',
          verifiedId: String(verified.id),
          confidence: 'name-match',
          candidates: dedupePlayers(candidates),
          attemptedPaths
        };
        playerLookupCache.set(cacheKey, result);
        return result;
      }
    } catch (error) {
      console.warn(`[Tennis] player lookup path failed for ${fullName}: ${path} - ${error.message}`);
    }
  }

  console.warn(`[Tennis] could not verify player ID for ${fullName}; falling back to fixture name filtering.`);
  const result = {
    source: 'api',
    verifiedId: null,
    confidence: 'unverified',
    candidates: dedupePlayers(candidates),
    attemptedPaths
  };
  playerLookupCache.set(cacheKey, result);
  return result;
}

export async function inspectTennisFixtures({ date, startDate, endDate, playerId, search } = {}) {
  if (!env.rapidApiTennisKey) {
    throw new Error('Missing RAPIDAPI_TENNIS_KEY');
  }

  const path = getTennisDebugPath({ date, startDate, endDate, playerId });
  const payload = await getTennis(path);
  const fixtures = extractFixtureArray(payload);
  const matches = normalizeTennisFixtures(payload);
  const players = extractPlayersFromFixtures(fixtures);

  return {
    source: 'api',
    url: `${BASE_URL}${path}`,
    shape: describeShape(payload),
    fixtureCount: fixtures.length,
    playerMatches: search ? players.filter((player) => normalizeName(player.name).includes(normalizeName(search))) : players,
    sampleFixtures: fixtures.slice(0, 5),
    normalizedMatches: matches.slice(0, 10)
  };
}

function getTennisDebugPath({ date, startDate, endDate, playerId }) {
  if (playerId) return `/tennis/v2/atp/fixtures/player/${encodeURIComponent(playerId)}`;
  if (startDate && endDate) return `/tennis/v2/atp/fixtures/${encodeURIComponent(startDate)}/${encodeURIComponent(endDate)}`;
  if (date) return `/tennis/v2/atp/fixtures/${encodeURIComponent(date)}`;
  return '/tennis/v2/atp/fixtures';
}

function getUnavailableRankingPlayers() {
  return TRACKED_PLAYERS.map((name) => ({
    id: name.toLowerCase().replaceAll(' ', '-'),
    name,
    country: name.includes('Sinner') ? 'Italy' : 'Spain',
    age: 'Unavailable',
    handedness: 'Unavailable',
    ranking: 'Unavailable',
    points: 'Unavailable',
    record: 'Unavailable',
    rankingNote: 'ATP rankings could not be loaded from the configured API.',
    source: 'api'
  }));
}

function extractPlayersFromFixtures(fixtures) {
  const players = new Map();

  fixtures.forEach((fixture) => {
    getFixturePlayerCandidates(fixture).forEach((player) => {
      if (player.name && player.name !== 'Player 1' && player.name !== 'Player 2') {
        players.set(`${player.name}-${player.id || ''}`, player);
      }
    });
  });

  return [...players.values()];
}

function getFixturePlayerCandidates(fixture) {
  return [
    fixture.player1,
    fixture.player2,
    fixture.player_one,
    fixture.player_two,
    fixture.home,
    fixture.away,
    fixture.localteam,
    fixture.visitorteam,
    fixture.firstPlayer,
    fixture.secondPlayer,
    { id: fixture.player_1_id || fixture.player1_id || fixture.player1Id || fixture.home_id, name: fixture.player_1_name || fixture.player1_name || fixture.player1Name || fixture.home_name },
    { id: fixture.player_2_id || fixture.player2_id || fixture.player2Id || fixture.away_id, name: fixture.player_2_name || fixture.player2_name || fixture.player2Name || fixture.away_name }
  ]
    .filter(Boolean)
    .map((player) => ({
      id: player.id || player.playerId || player.player_id || player.playerID,
      name: player.name || player.fullName || player.full_name || [player.firstName, player.lastName].filter(Boolean).join(' ') || [player.first_name, player.last_name].filter(Boolean).join(' ')
    }));
}

function extractPlayerCandidates(payload) {
  const fixtures = extractFixtureArray(payload);
  const fromFixtures = extractPlayersFromFixtures(fixtures);
  const arrays = collectArrays(payload);
  const fromArrays = arrays.flatMap((item) => normalizePlayerCandidate(item)).filter((player) => player.name);

  return dedupePlayers([...fromFixtures, ...fromArrays]);
}

function collectArrays(value, depth = 0) {
  if (depth > 4 || !value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== 'object') return [];

  return Object.values(value).flatMap((child) => collectArrays(child, depth + 1));
}

function normalizePlayerCandidate(item) {
  if (!item || typeof item !== 'object') return [];
  const nestedPlayers = getFixturePlayerCandidates(item);
  const direct = {
    id: item.id || item.playerId || item.player_id || item.playerID,
    name: item.name || item.fullName || item.full_name || item.playerName || item.player_name || [item.firstName, item.lastName].filter(Boolean).join(' ') || [item.first_name, item.last_name].filter(Boolean).join(' ')
  };

  return [direct, ...nestedPlayers].filter((player) => player.name);
}

function describeShape(payload) {
  if (Array.isArray(payload)) return `array(length=${payload.length})`;
  if (!payload || typeof payload !== 'object') return typeof payload;

  const keys = Object.keys(payload);
  const arrayKey = keys.find((key) => Array.isArray(payload[key]));
  const nestedDataArray = Array.isArray(payload.data) ? ` data.length=${payload.data.length}` : '';
  return `object(keys=${keys.join(',')}${arrayKey ? ` ${arrayKey}.length=${payload[arrayKey].length}` : ''}${nestedDataArray})`;
}

function assertTennisConfig() {
  const missing = [
    ['RAPIDAPI_TENNIS_KEY', env.rapidApiTennisKey]
  ].filter(([, value]) => !value);

  // TODO: Fill TENNIS_SINNER_PLAYER_ID and TENNIS_ALCARAZ_PLAYER_ID after confirming IDs from debug fixture/player inspection.
  if (missing.length) {
    throw new Error(`Missing tennis env vars: ${missing.map(([key]) => key).join(', ')}`);
  }
}

function normalizeTennisFixtures(payload) {
  const fixtures = extractFixtureArray(payload);

  return fixtures.flatMap((fixture) => {
    const [playerOne, playerTwo] = getFixturePlayerCandidates(fixture);
    const home = playerOne?.name || 'Player 1';
    const away = playerTwo?.name || 'Player 2';
    const startRaw = fixture.startTime || fixture.start_time || fixture.dateTime || fixture.datetime || fixture.time || fixture.date;
    const startTime = normalizeTennisStartTime(startRaw || new Date(), fixture.id);
    const rawStatus = fixture.status || fixture.match_status || fixture.state || fixture.fixture_status;
    const status = getEventStatus(startTime, rawStatus);
    const liveScore = fixture.score || fixture.scores || fixture.live_score || fixture.periods || null;
    const finalResult = fixture.result || fixture.final_score || fixture.winner || fixture.score || fixture.scores || null;
    const tournament = fixture.tournament?.name || fixture.competition?.name || fixture.league?.name || fixture.event?.name || fixture.tournament_name || fixture.league_name || 'ATP Match';

    if (!isValidPlayerName(home) || !isValidPlayerName(away)) return [];

    return [{
      id: `tennis-${fixture.id || fixture.fixtureId || fixture.match_id || `${home}-${away}-${startTime}`}`.toLowerCase().replaceAll(' ', '-'),
      sport: 'Tennis',
      title: tournament,
      competition: tournament,
      participants: [home, away],
      startTime,
      status,
      score: status === 'live' ? stringifyScore(liveScore) : null,
      result: status === 'finished' ? stringifyScore(finalResult || liveScore) : null,
      source: 'api'
    }];
  }).filter(isTrackedTennisMatch);
}

function normalizeRankings(payload) {
  const rows = collectArrays(payload);
  const normalizedRows = rows
    .map(normalizeRankingRow)
    .filter((row) => row.name && Number.isFinite(row.ranking))
    .sort((a, b) => a.ranking - b.ranking);

  const trackedRows = TRACKED_PLAYERS.map((trackedName) =>
    normalizedRows.find((row) => namesMatch(row.name, normalizeName(trackedName)))
  ).filter(Boolean);
  const topTen = normalizedRows.slice(0, 10);
  const rankings = dedupePlayers([...topTen, ...trackedRows]).sort((a, b) => a.ranking - b.ranking);

  return {
    players: trackedRows,
    rankings
  };
}

function normalizeRankingRow(row) {
  const player = row.player || row;
  const name = player.name || player.fullName || player.full_name || row.playerName || row.player_name || [player.firstName, player.lastName].filter(Boolean).join(' ');
  const ranking = Number(row.rank || row.ranking || row.position || row.place);
  const points = Number(row.points || row.point || row.pts || 0);

  return {
    id: String(player.id || player.playerId || row.playerId || row.id || name),
    name,
    country: player.countryAcr || player.country || row.country || '',
    age: 'Unavailable',
    handedness: 'Unavailable',
    ranking,
    points,
    record: 'Unavailable',
    isTracked: TRACKED_PLAYERS.some((trackedName) => namesMatch(name, normalizeName(trackedName))),
    source: 'api'
  };
}

function extractFixtureArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.response)) return payload.response;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.fixtures)) return payload.fixtures;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload?.data?.fixtures)) return payload.data.fixtures;
  return [];
}

function isTrackedTennisMatch(match) {
  return match.participants?.some((name) => TRACKED_PLAYERS.some((tracked) => namesMatch(name, normalizeName(tracked)) || namesMatch(name, normalizeName(tracked.split(' ').at(-1)))));
}

function stringifyScore(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(stringifyScore).filter(Boolean).join(', ');
  if (typeof value === 'object') return Object.values(value).filter((item) => item !== null && item !== undefined).join('-');
  return String(value);
}

function normalizeName(name) {
  return String(name || '').toLowerCase();
}

function dedupeMatches(matches) {
  return Array.from(new Map(matches.map((match) => [getMatchDedupeKey(match), match])).values());
}

function isRelevantTennisWindow(match) {
  const start = new Date(match.startTime);
  const min = new Date();
  min.setDate(min.getDate() - 7);
  const max = new Date();
  max.setDate(max.getDate() + 14);
  return start >= min && start <= max;
}

function isValidPlayerName(name) {
  const normalized = normalizeName(name);
  return Boolean(normalized) && normalized !== 'unknown player' && normalized !== 'player 1' && normalized !== 'player 2';
}

function getMatchDedupeKey(match) {
  const participants = [...(match.participants || [])].map(normalizeName).sort().join('-');
  return `${participants}-${match.startTime.slice(0, 16)}`;
}

function normalizeTennisStartTime(rawValue, fixtureId) {
  if (rawValue instanceof Date) {
    return rawValue.toISOString();
  }

  const raw = String(rawValue);
  const parsed = new Date(raw);
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::(\d{2}))?/);

  if (!match) {
    const fallback = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    console.info(`[Tennis] time fixture=${fixtureId || 'unknown'} original=${raw} parsed=${Number.isNaN(parsed.getTime()) ? 'invalid' : parsed.toISOString()} final=${fallback}`);
    return fallback;
  }

  const finalValue = `${match[1]}T${match[2]}:${match[3] || '00'}+03:00`;
  console.info(`[Tennis] time fixture=${fixtureId || 'unknown'} original=${raw} parsed=${Number.isNaN(parsed.getTime()) ? 'invalid' : parsed.toISOString()} final=${finalValue}`);
  return finalValue;
}

function namesMatch(candidateName, expectedNormalizedName) {
  const candidate = normalizeName(candidateName);
  const expectedParts = expectedNormalizedName.split(/\s+/).filter(Boolean);
  return candidate === expectedNormalizedName || expectedParts.every((part) => candidate.includes(part));
}

function dedupePlayers(players) {
  return Array.from(
    new Map(players.filter((player) => player.name).map((player) => [`${player.id || ''}-${normalizeName(player.name)}`, player])).values()
  );
}
