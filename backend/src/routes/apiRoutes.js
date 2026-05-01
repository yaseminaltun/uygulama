import { Router } from 'express';
import { debugFootballLeagues, debugFootballTeams, debugTennisFixtures, debugTennisSearchPlayer } from '../controllers/debugController.js';
import { today, upcoming } from '../controllers/homeController.js';
import { calendar, football, formulaOne, tennis } from '../controllers/sportsController.js';

export const apiRoutes = Router();

apiRoutes.get('/health', (req, res) => res.json({ status: 'ok' }));
apiRoutes.get('/home/today', today);
apiRoutes.get('/home/upcoming', upcoming);
apiRoutes.get('/tennis', tennis);
apiRoutes.get('/f1', formulaOne);
apiRoutes.get('/football', football);
apiRoutes.get('/calendar', calendar);
apiRoutes.get('/debug/football/teams', debugFootballTeams);
apiRoutes.get('/debug/football/leagues', debugFootballLeagues);
apiRoutes.get('/debug/tennis/fixtures', debugTennisFixtures);
apiRoutes.get('/debug/tennis/players', debugTennisFixtures);
apiRoutes.get('/debug/tennis/search-player', debugTennisSearchPlayer);
