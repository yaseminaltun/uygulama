# Sports Tracker

A focused personal sports dashboard for selected tennis players and Formula 1. It intentionally does not include general sports news or broad player/team tracking.

## Project Architecture

```text
.
├── backend
│   ├── Dockerfile
│   ├── package.json
│   └── src
│       ├── config
│       │   └── env.js
│       ├── controllers
│       │   ├── homeController.js
│       │   └── sportsController.js
│       ├── data
│       │   └── mockData.js
│       ├── routes
│       │   └── apiRoutes.js
│       ├── services
│       │   ├── calendarService.js
│       │   ├── f1Service.js
│       │   ├── homeService.js
│       │   ├── providerUtils.js
│       │   └── tennisService.js
│       └── server.js
├── database
│   └── init.sql
├── frontend
│   ├── Dockerfile
│   ├── index.html
│   ├── package.json
│   └── src
│       ├── App.jsx
│       ├── components
│       ├── pages
│       ├── services
│       ├── styles
│       ├── hooks.js
│       └── main.jsx
├── .env.example
├── docker-compose.yml
└── README.md
```

## Features

- Home dashboard with today's followed events and upcoming events.
- Tennis tab for Jannik Sinner and Carlos Alcaraz only.
- Formula 1 tab with race weekend sessions, results, driver standings, and constructor standings.
- Monthly calendar combining all followed events with sport badges and event details.
- Modular API services with real providers and mock fallback data.
- Responsive React UI with loading and error states.
- Docker Compose support for frontend, backend, and PostgreSQL.

## API Endpoints

- `GET /api/home/today`
- `GET /api/home/upcoming`
- `GET /api/tennis`
- `GET /api/f1`
- `GET /api/calendar`
- `GET /api/health`

## Run Locally

Copy environment variables:

```bash
cp .env.example .env
```

Open `.env` and fill in your real API keys:

```bash
RAPIDAPI_TENNIS_KEY=your_rapidapi_tennis_key
F1_SEASON=2026
FOOTBALL_SEASON=2025
TENNIS_SINNER_PLAYER_ID=
TENNIS_ALCARAZ_PLAYER_ID=
```

The backend service loads the root `.env` file through Docker Compose. Startup logs show whether required variables are present, but API key values are never printed.
Tennis player IDs are optional. Leave `TENNIS_SINNER_PLAYER_ID` and `TENNIS_ALCARAZ_PLAYER_ID` blank until the debug search endpoint verifies the provider's actual IDs.

Install and run the backend:

```bash
cd backend
npm install
npm run dev
```

Install and run the frontend in a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Run With Docker

```bash
docker compose up --build
```

After changing `.env`, restart the stack:

```bash
docker compose down
docker compose up --build
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4000/api/health`  
PostgreSQL: `localhost:55432`

## Sports APIs

Put API keys and provider IDs in `.env` at the project root. Do not commit `.env`.

- Formula 1 uses Jolpica F1 API at `https://api.jolpi.ca/ergast/f1`. It does not require a key. Set `F1_SEASON=2026`.
- Tennis uses RapidAPI ATP/WTA/ITF Tennis API at `https://tennis-api-atp-wta-itf.p.rapidapi.com`. Set `RAPIDAPI_TENNIS_KEY`, `TENNIS_SINNER_PLAYER_ID`, and `TENNIS_ALCARAZ_PLAYER_ID`.

If an API request fails or a required key/ID is missing, the backend logs a warning and returns mock fallback data. API responses include `source: "api"` when real provider data is used and `source: "mock-fallback"` when fallback data is used.

## Test API Endpoints

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/f1
curl http://localhost:4000/api/tennis
curl http://localhost:4000/api/home/today
curl http://localhost:4000/api/calendar
```
Tennis debug:

```bash
curl "http://localhost:4000/api/debug/tennis/fixtures?date=2026-05-01"
curl "http://localhost:4000/api/debug/tennis/search-player?name=Sinner"
curl "http://localhost:4000/api/debug/tennis/search-player?name=Alcaraz"
curl "http://localhost:4000/api/debug/tennis/fixtures?startDate=2026-05-01&endDate=2026-05-14&search=Sinner"
curl "http://localhost:4000/api/debug/tennis/fixtures?playerId=YOUR_PLAYER_ID"
curl "http://localhost:4000/api/debug/tennis/players?startDate=2026-05-01&endDate=2026-05-14&search=Alcaraz"
```

Backend logs show the exact football and tennis provider URLs, response status, and response shape/counts. Tennis rankings are loaded from `/tennis/v2/atp/ranking/singles/`; if that endpoint fails, the API returns `rankingsUnavailable: true` and `ATP rankings could not be loaded from the configured API.`

To check whether live provider data is being used:

```bash
curl http://localhost:4000/api/f1 | grep source
curl http://localhost:4000/api/tennis | grep source
```

## Provider Notes

The API logic is separated under `backend/src/services`. Each sport service fetches provider data, normalizes it into frontend-friendly event objects, and falls back to `backend/src/data/mockData.js` on errors.

Normalized event fields:

- `id`
- `sport`
- `title`
- `competition`
- `participants`
- `startTime`
- `status`
- `score`
- `result`
- `source`

Tennis player-card rankings come from the configured RapidAPI tennis ranking endpoint. Mock tennis ranking data is only returned when the tennis API itself falls back.
