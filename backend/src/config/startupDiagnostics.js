import { env } from './env.js';

const diagnostics = [
  ['RAPIDAPI_TENNIS_KEY', env.rapidApiTennisKey, true],
  ['F1_SEASON', env.f1Season, false],
  ['TENNIS_SINNER_PLAYER_ID', env.tennisSinnerPlayerId, false],
  ['TENNIS_ALCARAZ_PLAYER_ID', env.tennisAlcarazPlayerId, false]
];

export function logStartupDiagnostics() {
  console.info('[Config] Environment variable check:');

  diagnostics.forEach(([name, value, secret]) => {
    const present = Boolean(value);
    const displayValue = secret ? (present ? 'present' : 'missing') : present ? value : 'missing';
    console.info(`[Config] ${name}: ${displayValue}`);
  });
}
