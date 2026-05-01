import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',
  appTimeZone: process.env.APP_TIME_ZONE || 'Europe/Istanbul',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  rapidApiFootballKey: process.env.RAPIDAPI_FOOTBALL_KEY || '',
  rapidApiFootballHost: process.env.RAPIDAPI_FOOTBALL_HOST || '',
  rapidApiFootballBaseUrl: process.env.RAPIDAPI_FOOTBALL_BASE_URL || '',
  rapidApiTennisKey: process.env.RAPIDAPI_TENNIS_KEY || process.env.TENNIS_API_KEY || '',
  f1Season: process.env.F1_SEASON || '2026',
  tennisSinnerPlayerId: process.env.TENNIS_SINNER_PLAYER_ID || '',
  tennisAlcarazPlayerId: process.env.TENNIS_ALCARAZ_PLAYER_ID || '',
  footballSeason: process.env.FOOTBALL_SEASON || '2025'
};
