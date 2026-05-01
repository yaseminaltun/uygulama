import { tennis } from '../data/mockData.js';
import { env } from '../config/env.js';
import { addDaysDateKey, byStartTime, createMemoryCache, getEventStatus, warnFallback, withSource } from './providerUtils.js';

const BASE_URL = 'https://tennis-api-atp-wta-itf.p.rapidapi.com';
const TRACKED_PLAYERS = ['Jannik Sinner', 'Carlos Alcaraz'];
const PLACEHOLDER_PLAYER_NAMES = ['unknown player', 'unknown', 'tbd', 'tba', 'qualifier', 'bye'];
const cache = createMemoryCache();
const playerLookupCache = new Map();
const tournamentLookupCache = new Map();

export async function getTennisDashboard() {
  return cache(loadTennisDashboard);
}

async function loadTennisDashboard() {
  try {
    assertTennisConfig();

    const fixtureResult = await getTennisFixtureCandidates();
    const rankingResult = await getAtpRankings();
    const normalizedBatches = await Promise.all(fixtureResult.fixtures.map(({ payload, url }) => normalizeTennisFixtures(payload, url)));
    const normalizedMatches = dedupeMatches(normalizedBatches.flat());
    const { matches, filteredOutReasons } = filterTennisMatches(normalizedMatches);
    const placeholderResult = removePlaceholderMatchesWhenRealMatchExists(matches);
    const sortedMatches = placeholderResult.matches.sort(byStartTime);
    logIncludedMatches(sortedMatches);
    const debug = {
      requestedUrls: fixtureResult.requestedUrls,
      rawCounts: fixtureResult.rawCounts,
      filteredOutReasons: [...filteredOutReasons, ...placeholderResult.filteredOutReasons]
    };

    console.info(`[Tennis] source=api matches=${sortedMatches.length} rankings=${rankingResult.rankings.length}`);

    return {
      source: 'api',
      players: rankingResult.players,
      rankings: rankingResult.rankings,
      rankingsUnavailable: rankingResult.unavailable,
      message: rankingResult.message,
      rankingMessage: rankingResult.message,
      matches: sortedMatches,
      ...(sortedMatches.length ? {} : { debug })
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

async function getTennisFixtureCandidates() {
  const today = addDaysDateKey(0);
  const yesterday = addDaysDateKey(-1);
  const next21Days = addDaysDateKey(21);
  const endpoints = [
    { label: 'fixtures', path: '/tennis/v2/atp/fixtures' },
    { label: 'fixtures-today', path: `/tennis/v2/atp/fixtures/${today}` },
    { label: 'fixtures-range', path: `/tennis/v2/atp/fixtures/${yesterday}/${next21Days}` },
    { label: 'fixtures-player-47275', path: '/tennis/v2/atp/fixtures/player/47275' },
    { label: 'fixtures-player-68074', path: '/tennis/v2/atp/fixtures/player/68074' }
  ];
  const fixtures = [];
  const requestedUrls = [];
  const rawCounts = {};

  for (const { label, path } of endpoints) {
    const url = `${BASE_URL}${path}`;
    requestedUrls.push(url);

    try {
      const payload = await getTennis(path);
      const rawFixtures = extractFixtureArray(payload);
      const rawCount = rawFixtures.length;
      rawCounts[url] = rawCount;
      fixtures.push({ label, url, payload });
      console.info(`[Tennis] fixtures rawCount=${rawCount} url=${url}`);
      logTrackedRawFixtures(label, rawFixtures);
    } catch (error) {
      rawCounts[url] = `error: ${error.message}`;
      console.warn(`[Tennis] fixtures failed url=${url} error=${error.message}`);
    }
  }

  return { fixtures, requestedUrls, rawCounts };
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

export async function inspectRawTennisFixtures() {
  if (!env.rapidApiTennisKey) {
    throw new Error('Missing RAPIDAPI_TENNIS_KEY');
  }

  const fixtureResult = await getTennisFixtureCandidates();
  const rawFixtures = fixtureResult.fixtures.flatMap(({ label, url, payload }) =>
    extractFixtureArray(payload).map((fixture) => summarizeRawFixture(fixture, label, url))
  );

  return {
    requestedUrls: fixtureResult.requestedUrls,
    rawCounts: fixtureResult.rawCounts,
    rawFixtures
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
  const matches = await normalizeTennisFixtures(payload);
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

function summarizeRawFixture(fixture, sourceEndpoint, sourceUrl) {
  const [playerOne, playerTwo] = getFixturePlayerCandidates(fixture);
  const rawDate = getFixtureRawDate(fixture);
  const parsedStartTime = hasRealFixtureDate(fixture) ? normalizeTennisStartTime(rawDate, fixture.id) : null;

  return {
    sourceEndpoint,
    sourceUrl,
    id: getFixtureId(fixture),
    tournamentId: getFixtureTournamentId(fixture),
    rawDate,
    parsedStartTime,
    player1: playerOne?.name || 'Player 1',
    player1Id: playerOne?.id || null,
    player2: playerTwo?.name || 'Player 2',
    player2Id: playerTwo?.id || null,
    tournament: getFixtureTournament(fixture),
    round: getFixtureRound(fixture),
    status: getFixtureRawStatus(fixture),
    raw: fixture
  };
}

function logTrackedRawFixtures(sourceEndpoint, fixtures) {
  fixtures
    .map((fixture) => summarizeRawFixture(fixture, sourceEndpoint))
    .filter((fixture) => hasTrackedPlayerName([fixture.player1, fixture.player2]))
    .forEach((fixture) => {
      console.info(`[Tennis][RAW] source=${fixture.sourceEndpoint} id=${fixture.id} date=${fixture.rawDate || 'unknown'} p1=${fixture.player1} p2=${fixture.player2}`);
    });
}

function getFixtureId(fixture) {
  return String(fixture.id || fixture.fixtureId || fixture.match_id || fixture.matchId || '');
}

function getFixtureRawDate(fixture) {
  if (fixture.date === null) {
    return null;
  }

  return firstPresentValue([
    fixture.startTime,
    fixture.start_time,
    fixture.dateTime,
    fixture.datetime,
    fixture.time,
    fixture.date
  ]);
}

function getFixtureRawStatus(fixture) {
  return fixture.status || fixture.match_status || fixture.state || fixture.fixture_status || '';
}

function getFixtureTournament(fixture) {
  return fixture.tournament?.name || fixture.competition?.name || fixture.league?.name || fixture.event?.name || fixture.tournament_name || fixture.league_name || 'ATP Match';
}

function getFixtureTournamentId(fixture) {
  const value =
    fixture.tournamentId ||
    fixture.tournament_id ||
    fixture.tournament?.id ||
    fixture.competitionId ||
    fixture.competition_id ||
    fixture.competition?.id ||
    fixture.leagueId ||
    fixture.league_id ||
    fixture.league?.id ||
    fixture.eventId ||
    fixture.event_id ||
    fixture.event?.id;
  return value === undefined || value === null || value === '' ? null : String(value);
}

function getFixtureRound(fixture) {
  return fixture.round?.name || fixture.round_name || fixture.roundName || fixture.stage?.name || fixture.stage_name || fixture.phase || fixture.fixture_round || '';
}

function firstPresentValue(values) {
  const value = values.find((item) => item !== undefined && item !== null && String(item).trim() !== '');
  return value === undefined ? '' : value;
}

function hasRealFixtureDate(fixture) {
  if (fixture.date === null) {
    return false;
  }

  const rawDate = getFixtureRawDate(fixture);
  return rawDate !== undefined && rawDate !== null && String(rawDate).trim() !== '';
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

async function normalizeTennisFixtures(payload, sourceUrl = '') {
  const fixtures = extractFixtureArray(payload);
  const normalized = await Promise.all(fixtures.map((fixture) => normalizeTennisFixture(fixture, sourceUrl)));

  return normalized.filter(Boolean);
}

async function normalizeTennisFixture(fixture, sourceUrl = '') {
  const [playerOne, playerTwo] = getFixturePlayerCandidates(fixture);
  const home = playerOne?.name || 'Player 1';
  const away = playerTwo?.name || 'Player 2';
  const startRaw = getFixtureRawDate(fixture);
  const startTime = hasRealFixtureDate(fixture) ? normalizeTennisStartTime(startRaw, fixture.id) : null;
  const tournamentId = getFixtureTournamentId(fixture);
  const rawStatus = getFixtureRawStatus(fixture);
  const liveScore = fixture.score || fixture.scores || fixture.live_score || fixture.periods || null;
  const finalResult = fixture.result || fixture.final_score || fixture.winner || fixture.score || fixture.scores || null;
  const fallbackTournament = getFixtureTournament(fixture);
  const round = getFixtureRound(fixture);

  if (!startTime) {
    console.info(`[Tennis][EXCLUDED] reason=missing-raw-date id=${getFixtureId(fixture)} source=${sourceUrl || 'unknown'} p1=${home} p2=${away}`);
    return null;
  }

  if ((!isValidPlayerName(home) || !isValidPlayerName(away)) && !hasTrackedPlayerName([home, away])) {
    console.info(`[Tennis][EXCLUDED] reason=invalid-player-names id=${getFixtureId(fixture)} source=${sourceUrl || 'unknown'} p1=${home} p2=${away}`);
    return null;
  }

  const resolvedTournament = hasTrackedPlayerName([home, away]) ? await resolveTennisTournamentName(tournamentId) : null;
  const tournament = resolvedTournament || fallbackTournament || 'ATP Match';
  const status = getEventStatus(startTime, rawStatus);

  return {
    id: `tennis-${fixture.id || fixture.fixtureId || fixture.match_id || `${home}-${away}-${startTime}`}`.toLowerCase().replaceAll(' ', '-'),
    sport: 'Tennis',
    title: tournament,
    competition: tournament,
    participants: [home, away],
    participantDetails: [
      { name: home, id: playerOne?.id || null },
      { name: away, id: playerTwo?.id || null }
    ],
    startTime,
    status,
    score: status === 'live' ? stringifyScore(liveScore) : null,
    result: status === 'finished' ? stringifyScore(finalResult || liveScore) : null,
    source: 'api',
    fixtureSourceUrl: sourceUrl || undefined,
    tournamentId,
    round,
    hasDrawMetadata: hasExplicitDrawMetadata(fixture, tournament, round)
  };
}

async function resolveTennisTournamentName(tournamentId) {
  if (!tournamentId) {
    return null;
  }

  const cacheKey = String(tournamentId);
  if (tournamentLookupCache.has(cacheKey)) {
    return tournamentLookupCache.get(cacheKey);
  }

  const lookupPromise = fetchTennisTournamentName(cacheKey);
  tournamentLookupCache.set(cacheKey, lookupPromise);
  return lookupPromise;
}

async function fetchTennisTournamentName(tournamentId) {
  const paths = [
    `/tennis/v2/atp/tournament/${encodeURIComponent(tournamentId)}`,
    `/tennis/v2/atp/tournaments/${encodeURIComponent(tournamentId)}`
  ];

  for (const path of paths) {
    try {
      const payload = await getTennis(path);
      const name = extractTournamentName(payload);

      if (name) {
        console.info(`[Tennis] tournament resolved id=${tournamentId} name=${name} path=${path}`);
        return name;
      }

      console.info(`[Tennis] tournament lookup empty id=${tournamentId} path=${path} shape=${describeShape(payload)}`);
    } catch (error) {
      console.warn(`[Tennis] tournament lookup failed id=${tournamentId} path=${path} error=${error.message}`);
    }
  }

  return null;
}

function extractTournamentName(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.response,
    ...(Array.isArray(payload?.data) ? payload.data : []),
    ...(Array.isArray(payload?.response) ? payload.response : [])
  ];

  for (const candidate of candidates) {
    const name = getTournamentNameFromObject(candidate);
    if (name) return name;
  }

  return null;
}

function getTournamentNameFromObject(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const directName = value.name || value.fullName || value.full_name || value.tournamentName || value.tournament_name || value.title;
  if (directName && !isGenericCompetitionName(directName)) {
    return String(directName);
  }

  const nested = value.tournament || value.competition || value.league || value.event;
  if (nested && typeof nested === 'object') {
    const nestedName = nested.name || nested.fullName || nested.full_name || nested.title;
    if (nestedName && !isGenericCompetitionName(nestedName)) {
      return String(nestedName);
    }
  }

  return null;
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
  return hasTrackedPlayerName(match.participants);
}

function hasTrackedPlayerName(names = []) {
  return names.some((name) => TRACKED_PLAYERS.some((tracked) => playerNameContainsTrackedName(name, tracked)));
}

function filterTennisMatches(matches) {
  const filteredOutReasons = [];
  const included = [];

  matches.forEach((match) => {
    const reasons = [];

    if (!isTrackedTennisMatch(match)) {
      reasons.push('player_name_does_not_contain_sinner_or_alcaraz');
    }

    if (!isRelevantTennisWindow(match)) {
      reasons.push(`outside_europe_istanbul_window_${addDaysDateKey(-1)}_to_${addDaysDateKey(21)}`);
    }

    if (reasons.length) {
      const filtered = {
        id: match.id,
        participants: match.participants,
        startTime: match.startTime,
        status: match.status,
        reasons
      };
      filteredOutReasons.push(filtered);
      console.info(`[Tennis][EXCLUDED] reason=${reasons.join(',')} id=${match.id} p1=${match.participants[0]} p2=${match.participants[1]}`);
      console.info(`[Tennis] match excluded id=${match.id} players=${match.participants.join(' vs ')} startTime=${match.startTime} status=${match.status} reasons=${reasons.join(',')}`);
      return;
    }

    included.push(match);
  });

  return { matches: included, filteredOutReasons };
}

function removePlaceholderMatchesWhenRealMatchExists(matches) {
  const realPlayerGroups = new Set();
  const realPlayerWindow = new Set();
  const filteredOutReasons = [];

  matches.forEach((match) => {
    getTrackedPlayersForMatch(match).forEach((trackedPlayer) => {
      if (hasRealOpponentForTrackedPlayer(match, trackedPlayer)) {
        realPlayerGroups.add(getTrackedPlayerDateKey(match, trackedPlayer));
        realPlayerWindow.add(normalizeName(trackedPlayer));
      }
    });
  });

  const included = matches.filter((match) => {
    const removalReasonsByPlayer = getTrackedPlayersForMatch(match)
      .map((trackedPlayer) => {
        const reasons = getPlaceholderRemovalReasons(match, trackedPlayer, realPlayerGroups, realPlayerWindow);
        return { trackedPlayer, reasons };
      })
      .filter(({ reasons }) => reasons.length);

    if (!removalReasonsByPlayer.length) {
      return true;
    }

    const reasons = [...new Set(removalReasonsByPlayer.flatMap(({ reasons }) => reasons))];
    const removalPlayers = removalReasonsByPlayer.map(({ trackedPlayer }) => trackedPlayer);
    const filtered = {
      id: match.id,
      participants: match.participants,
      startTime: match.startTime,
      status: match.status,
      reasons,
      trackedPlayers: removalPlayers
    };
    filteredOutReasons.push(filtered);
    if (reasons.includes('placeholder_opponent_removed_because_real_match_exists_same_day')) {
      console.info(`[Tennis] Removed placeholder match because real match exists same day id=${match.id} players=${match.participants.join(' vs ')} date=${dateKeyFromTennisStartTime(match.startTime)} trackedPlayers=${removalPlayers.join(', ')}`);
    }
    console.info(`[Tennis][EXCLUDED] reason=${reasons.join(',')} id=${match.id} p1=${match.participants[0]} p2=${match.participants[1]}`);
    return false;
  });

  return { matches: included, filteredOutReasons };
}

function getPlaceholderRemovalReasons(match, trackedPlayer, realPlayerGroups, realPlayerWindow) {
  if (!hasPlaceholderOpponentForTrackedPlayer(match, trackedPlayer)) {
    return [];
  }

  const reasons = [];

  if (realPlayerGroups.has(getTrackedPlayerDateKey(match, trackedPlayer))) {
    reasons.push('placeholder_opponent_removed_because_real_match_exists_same_day');
  }

  if (realPlayerWindow.has(normalizeName(trackedPlayer))) {
    reasons.push('unknown-opponent-real-match-exists-in-window');
  }

  if (!match.hasDrawMetadata) {
    reasons.push('unknown-opponent-and-no-confirmation');
  }

  if (hasGenericCompetitionWithoutOpponentIdentity(match, trackedPlayer)) {
    reasons.push('unknown-opponent-generic-without-opponent-id');
  }

  return reasons;
}

function logIncludedMatches(matches) {
  matches.forEach((match) => {
    console.info(`[Tennis][INCLUDED] id=${match.id} p1=${match.participants[0]} p2=${match.participants[1]}`);
  });
}

function getTrackedPlayersForMatch(match) {
  return TRACKED_PLAYERS.filter((trackedPlayer) =>
    (match.participants || []).some((name) => playerNameContainsTrackedName(name, trackedPlayer))
  );
}

function getTrackedPlayerDateKey(match, trackedPlayer) {
  return `${normalizeName(trackedPlayer)}:${dateKeyFromTennisStartTime(match.startTime)}`;
}

function hasRealOpponentForTrackedPlayer(match, trackedPlayer) {
  return getOpponentDetailsForTrackedPlayer(match, trackedPlayer).some((opponent) => !isPlaceholderPlayerName(opponent.name));
}

function hasPlaceholderOpponentForTrackedPlayer(match, trackedPlayer) {
  return getOpponentDetailsForTrackedPlayer(match, trackedPlayer).some((opponent) => isPlaceholderPlayerName(opponent.name));
}

function getOpponentsForTrackedPlayer(match, trackedPlayer) {
  return getOpponentDetailsForTrackedPlayer(match, trackedPlayer).map((opponent) => opponent.name);
}

function getOpponentDetailsForTrackedPlayer(match, trackedPlayer) {
  const details = match.participantDetails || (match.participants || []).map((name) => ({ name, id: null }));
  return details.filter((player) => !playerNameContainsTrackedName(player.name, trackedPlayer));
}

function hasGenericCompetitionWithoutOpponentIdentity(match, trackedPlayer) {
  if (!isGenericCompetitionName(match.competition) && !isGenericCompetitionName(match.title)) {
    return false;
  }

  return getOpponentDetailsForTrackedPlayer(match, trackedPlayer).some((opponent) =>
    isPlaceholderPlayerName(opponent.name)
  );
}

function isGenericCompetitionName(value) {
  return ['atp match', 'atp tour'].includes(normalizeName(value).trim());
}

function hasExplicitDrawMetadata(fixture, _tournament, round) {
  return Boolean(
    round ||
      fixture.draw ||
      fixture.draw_name ||
      fixture.drawName ||
      fixture.bracket ||
      fixture.round_id ||
      fixture.roundId
  );
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
  const matchDateKey = dateKeyFromTennisStartTime(match.startTime);
  const today = addDaysDateKey(0);

  if (matchDateKey === today) {
    return true;
  }

  return matchDateKey >= addDaysDateKey(-1) && matchDateKey <= addDaysDateKey(21);
}

function isValidPlayerName(name) {
  const normalized = normalizeName(name);
  return Boolean(normalized) && normalized !== 'player 1' && normalized !== 'player 2' && !isPlaceholderPlayerName(name);
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
    const finalValue = Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    console.info(`[Tennis] time fixture=${fixtureId || 'unknown'} original=${raw} parsed=${Number.isNaN(parsed.getTime()) ? 'invalid' : parsed.toISOString()} final=${finalValue || 'invalid'}`);
    return finalValue;
  }

  const finalValue = `${match[1]}T${match[2]}:${match[3] || '00'}+03:00`;
  console.info(`[Tennis] time fixture=${fixtureId || 'unknown'} original=${raw} parsed=${Number.isNaN(parsed.getTime()) ? 'invalid' : parsed.toISOString()} final=${finalValue}`);
  return finalValue;
}

function dateKeyFromTennisStartTime(startTime) {
  const match = String(startTime || '').match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

function namesMatch(candidateName, expectedNormalizedName) {
  const candidate = normalizeName(candidateName);
  const expectedParts = expectedNormalizedName.split(/\s+/).filter(Boolean);
  return candidate === expectedNormalizedName || expectedParts.every((part) => candidate.includes(part));
}

function playerNameContainsTrackedName(candidateName, trackedName) {
  const candidate = normalizeName(candidateName);
  const tracked = normalizeName(trackedName);
  const lastName = tracked.split(/\s+/).filter(Boolean).at(-1) || tracked;
  return candidate.includes(tracked) || candidate.includes(lastName);
}

function isPlaceholderPlayerName(name) {
  return PLACEHOLDER_PLAYER_NAMES.includes(normalizeName(name).trim());
}

function dedupePlayers(players) {
  return Array.from(
    new Map(players.filter((player) => player.name).map((player) => [`${player.id || ''}-${normalizeName(player.name)}`, player])).values()
  );
}
