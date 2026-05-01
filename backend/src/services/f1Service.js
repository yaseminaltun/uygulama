import { formulaOne } from '../data/mockData.js';
import { env } from '../config/env.js';
import { byStartTime, createMemoryCache, fetchJson, getEventStatus, toIstanbulIso, warnFallback, withSource } from './providerUtils.js';

const BASE_URL = 'https://api.jolpi.ca/ergast/f1';
const cache = createMemoryCache();

export async function getFormulaOneDashboard() {
  return cache(loadFormulaOneDashboard);
}

async function loadFormulaOneDashboard() {
  try {
    const [racesPayload, resultsPayload, driverStandingsPayload, constructorStandingsPayload, qualifyingPayload, sprintPayload] =
      await Promise.all([
        getF1('races'),
        getF1('results'),
        getF1('driverstandings'),
        getF1('constructorstandings'),
        getF1('qualifying'),
        getF1('sprint')
      ]);

    const races = racesPayload.MRData?.RaceTable?.Races || [];
    const events = normalizeRaceEvents(races, qualifyingPayload, sprintPayload);
    const nextRace = races.find((race) => new Date(getRaceDateTime(race)) >= new Date()) || races.at(-1) || {};
    const sessions = events
      .filter((event) => event.round === nextRace.round)
      .map((event) => ({
        id: event.id,
        name: event.sessionName,
        startTime: event.startTime,
        status: event.status,
        source: 'api'
      }));

    return {
      source: 'api',
      events,
      weekend: {
        name: nextRace.raceName || 'Formula 1 Weekend',
        circuit: nextRace.Circuit?.circuitName || 'TBC',
        location: formatLocation(nextRace.Circuit?.Location),
        sessions
      },
      raceResults: normalizeRaceResults(resultsPayload),
      driverStandings: normalizeDriverStandings(driverStandingsPayload),
      constructorStandings: normalizeConstructorStandings(constructorStandingsPayload)
    };
  } catch (error) {
    warnFallback('Formula 1', error);
    return {
      ...formulaOne,
      source: 'mock-fallback',
      events: withSource(formulaOne.weekend.sessions.map(sessionToEvent), 'mock-fallback'),
      weekend: {
        ...formulaOne.weekend,
        sessions: withSource(formulaOne.weekend.sessions, 'mock-fallback')
      },
      raceResults: withSource(formulaOne.raceResults, 'mock-fallback'),
      driverStandings: withSource(formulaOne.driverStandings, 'mock-fallback'),
      constructorStandings: withSource(formulaOne.constructorStandings, 'mock-fallback')
    };
  }
}

export async function getFormulaOneEvents() {
  const dashboard = await getFormulaOneDashboard();
  return dashboard.events || dashboard.weekend.sessions.map(sessionToEvent);
}

function getF1(path) {
  return fetchJson(`${BASE_URL}/${env.f1Season}/${path}`);
}

function normalizeRaceEvents(races) {
  return races.flatMap((race) => {
    const sessions = [
      ['First Practice', race.FirstPractice],
      ['Second Practice', race.SecondPractice],
      ['Third Practice', race.ThirdPractice],
      ['Sprint Qualifying', race.SprintQualifying],
      ['Sprint', race.Sprint],
      ['Qualifying', race.Qualifying],
      ['Race', { date: race.date, time: race.time }]
    ];

    return sessions
      .filter(([, session]) => session?.date)
      .map(([sessionName, session]) => {
        const startTime = toIstanbulIso(`${session.date}T${session.time || '00:00:00Z'}`);
        return {
          id: `f1-${env.f1Season}-${race.round}-${sessionName.toLowerCase().replaceAll(' ', '-')}`,
          sport: 'F1',
          title: `${race.raceName} ${sessionName}`,
          sessionName,
          competition: 'Formula 1',
          participants: ['All drivers'],
          startTime,
          status: getEventStatus(startTime),
          score: null,
          result: null,
          round: race.round,
          source: 'api'
        };
      });
  }).sort(byStartTime);
}

function normalizeRaceResults(payload) {
  const races = payload.MRData?.RaceTable?.Races || [];
  const latestRaceWithResults = [...races].reverse().find((race) => race.Results?.length);

  return (latestRaceWithResults?.Results || []).slice(0, 10).map((result) => ({
    position: Number(result.position),
    driver: `${result.Driver?.givenName || ''} ${result.Driver?.familyName || ''}`.trim(),
    team: result.Constructor?.name || 'Unknown',
    time: result.Time?.time || result.status || '',
    source: 'api'
  }));
}

function normalizeDriverStandings(payload) {
  const standings = payload.MRData?.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];

  return standings.map((standing) => ({
    position: Number(standing.position),
    driver: `${standing.Driver?.givenName || ''} ${standing.Driver?.familyName || ''}`.trim(),
    team: standing.Constructors?.[0]?.name || 'Unknown',
    points: Number(standing.points),
    source: 'api'
  }));
}

function normalizeConstructorStandings(payload) {
  const standings = payload.MRData?.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];

  return standings.map((standing) => ({
    position: Number(standing.position),
    team: standing.Constructor?.name || 'Unknown',
    points: Number(standing.points),
    source: 'api'
  }));
}

function getRaceDateTime(race) {
  return `${race.date}T${race.time || '00:00:00Z'}`;
}

function formatLocation(location = {}) {
  return [location.locality, location.country].filter(Boolean).join(', ') || 'TBC';
}

function sessionToEvent(session) {
  return {
    id: session.id,
    sport: 'F1',
    title: session.name,
    competition: 'Formula 1',
    participants: ['All drivers'],
    startTime: session.startTime,
    status: session.status,
    score: null,
    result: null,
    source: session.source || 'mock-fallback'
  };
}
