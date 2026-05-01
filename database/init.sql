CREATE TABLE IF NOT EXISTS followed_entities (
  id SERIAL PRIMARY KEY,
  sport VARCHAR(32) NOT NULL,
  entity_type VARCHAR(32) NOT NULL,
  name VARCHAR(120) NOT NULL,
  external_id VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cached_events (
  id VARCHAR(120) PRIMARY KEY,
  sport VARCHAR(32) NOT NULL,
  title VARCHAR(200) NOT NULL,
  competition VARCHAR(160),
  participants JSONB DEFAULT '[]'::jsonb,
  start_time TIMESTAMP NOT NULL,
  status VARCHAR(32) NOT NULL,
  score VARCHAR(160),
  result VARCHAR(160),
  raw_payload JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO followed_entities (sport, entity_type, name)
VALUES
  ('Tennis', 'player', 'Jannik Sinner'),
  ('Tennis', 'player', 'Carlos Alcaraz'),
  ('F1', 'series', 'Formula 1'),
  ('Football', 'team', 'Fenerbahce'),
  ('Football', 'team', 'Türkiye')
ON CONFLICT DO NOTHING;
