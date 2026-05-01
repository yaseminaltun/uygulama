import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { logStartupDiagnostics } from './config/startupDiagnostics.js';
import { apiRoutes } from './routes/apiRoutes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.frontendOrigin }));
app.use(express.json());

app.use('/api', apiRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(env.port, () => {
  console.log(`Sports tracker API running on port ${env.port}`);
  logStartupDiagnostics();
});
