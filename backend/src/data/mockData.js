import { dateKeyInAppTimeZone } from '../utils/dateUtils.js';

const todayIso = dateKeyInAppTimeZone();

export const followedItems = {
  tennisPlayers: ['Jannik Sinner', 'Carlos Alcaraz'],
  f1: ['Formula 1'],
  footballTeams: ['Fenerbahce', 'Türkiye']
};

export const events = [
  {
    id: 'tennis-sinner-rome-qf',
    sport: 'Tennis',
    title: 'Italian Open Quarter-final',
    competition: 'ATP Masters 1000 Rome',
    participants: ['Jannik Sinner', 'Daniil Medvedev'],
    startTime: `${todayIso}T14:00:00+03:00`,
    status: 'upcoming',
    score: null,
    result: null
  },
  {
    id: 'tennis-alcaraz-rome-r16',
    sport: 'Tennis',
    title: 'Italian Open Round of 16',
    competition: 'ATP Masters 1000 Rome',
    participants: ['Carlos Alcaraz', 'Holger Rune'],
    startTime: `${todayIso}T18:30:00+03:00`,
    status: 'live',
    score: 'Alcaraz leads 6-4, 2-1',
    result: null
  },
  {
    id: 'f1-miami-practice-1',
    sport: 'F1',
    title: 'Miami Grand Prix Practice 1',
    competition: 'Formula 1',
    participants: ['All drivers'],
    startTime: `${todayIso}T21:30:00+03:00`,
    status: 'upcoming',
    score: null,
    result: null
  },
  {
    id: 'football-fenerbahce-konyaspor',
    sport: 'Football',
    title: 'Fenerbahce vs Konyaspor',
    competition: 'Süper Lig',
    participants: ['Fenerbahce', 'Konyaspor'],
    startTime: `${todayIso}T20:00:00+03:00`,
    status: 'upcoming',
    score: null,
    result: null
  },
  {
    id: 'football-turkiye-georgia',
    sport: 'Football',
    title: 'Türkiye vs Georgia',
    competition: 'World Cup Qualifiers',
    participants: ['Türkiye', 'Georgia'],
    startTime: addDays(2, 'T21:45:00+03:00'),
    status: 'upcoming',
    score: null,
    result: null
  },
  {
    id: 'f1-miami-qualifying',
    sport: 'F1',
    title: 'Miami Grand Prix Qualifying',
    competition: 'Formula 1',
    participants: ['All drivers'],
    startTime: addDays(1, 'T23:00:00+03:00'),
    status: 'upcoming',
    score: null,
    result: null
  },
  {
    id: 'tennis-sinner-final',
    sport: 'Tennis',
    title: 'Madrid Open Final',
    competition: 'ATP Masters 1000 Madrid',
    participants: ['Jannik Sinner', 'Carlos Alcaraz'],
    startTime: addDays(-3, 'T17:00:00+03:00'),
    status: 'finished',
    score: null,
    result: 'Sinner def. Alcaraz 7-6, 6-4'
  }
];

export const tennis = {
  players: [
    {
      id: 'jannik-sinner',
      name: 'Jannik Sinner',
      country: 'Italy',
      age: 24,
      handedness: 'Right-handed',
      ranking: 1,
      points: 11830,
      record: '27-2'
    },
    {
      id: 'carlos-alcaraz',
      name: 'Carlos Alcaraz',
      country: 'Spain',
      age: 22,
      handedness: 'Right-handed',
      ranking: 3,
      points: 7010,
      record: '24-5'
    }
  ],
  matches: events.filter((event) => event.sport === 'Tennis')
};

export const formulaOne = {
  weekend: {
    name: 'Miami Grand Prix',
    circuit: 'Miami International Autodrome',
    location: 'Miami, United States',
    sessions: [
      session('Practice 1', todayIso, '21:30', 'upcoming'),
      session('Sprint Qualifying', addDaysRaw(1), '01:30', 'upcoming'),
      session('Sprint', addDaysRaw(1), '19:00', 'upcoming'),
      session('Qualifying', addDaysRaw(1), '23:00', 'upcoming'),
      session('Race', addDaysRaw(2), '23:00', 'upcoming')
    ]
  },
  raceResults: [
    { position: 1, driver: 'Max Verstappen', team: 'Red Bull Racing', time: '1:31:44.742' },
    { position: 2, driver: 'Lando Norris', team: 'McLaren', time: '+3.812s' },
    { position: 3, driver: 'Charles Leclerc', team: 'Ferrari', time: '+7.119s' }
  ],
  driverStandings: [
    { position: 1, driver: 'Max Verstappen', team: 'Red Bull Racing', points: 156 },
    { position: 2, driver: 'Lando Norris', team: 'McLaren', points: 132 },
    { position: 3, driver: 'Charles Leclerc', team: 'Ferrari', points: 121 },
    { position: 4, driver: 'Lewis Hamilton', team: 'Ferrari', points: 87 }
  ],
  constructorStandings: [
    { position: 1, team: 'McLaren', points: 249 },
    { position: 2, team: 'Ferrari', points: 208 },
    { position: 3, team: 'Red Bull Racing', points: 181 },
    { position: 4, team: 'Mercedes', points: 155 }
  ]
};

export const football = {
  teams: ['Fenerbahce', 'Türkiye'],
  matches: events.filter((event) => event.sport === 'Football'),
  superLigStandings: [
    { position: 1, team: 'Fenerbahce', played: 34, wins: 27, draws: 5, losses: 2, points: 86 },
    { position: 2, team: 'Galatasaray', played: 34, wins: 26, draws: 4, losses: 4, points: 82 },
    { position: 3, team: 'Besiktas', played: 34, wins: 19, draws: 8, losses: 7, points: 65 },
    { position: 4, team: 'Trabzonspor', played: 34, wins: 18, draws: 7, losses: 9, points: 61 }
  ]
};

function addDays(days, timeSuffix) {
  return `${addDaysRaw(days)}${timeSuffix}`;
}

function addDaysRaw(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function session(name, date, time, status) {
  return {
    id: `f1-${name.toLowerCase().replaceAll(' ', '-')}`,
    name,
    startTime: `${date}T${time}:00+03:00`,
    status
  };
}
