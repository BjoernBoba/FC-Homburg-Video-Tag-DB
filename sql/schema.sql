-- ============================================================
-- Football Video Tags — Datenbankschema
-- Einmalig im Supabase SQL-Editor ausführen:
-- Supabase Dashboard → SQL Editor → New query → Paste → Run
-- ============================================================

-- UUID-Erweiterung (in Supabase meist schon aktiv)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- Tabellen
-- ------------------------------------------------------------

CREATE TABLE teams (
  id   UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE tags (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  color      TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE games (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date       DATE    NOT NULL,
  season     TEXT    NOT NULL,
  team_id    UUID    REFERENCES teams(id) ON DELETE SET NULL,
  opponent   TEXT    NOT NULL,
  home_away  TEXT    CHECK (home_away IN ('Heim', 'Auswärts')),
  result     TEXT,
  created_by UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE entries (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  game_id    UUID    REFERENCES games(id) ON DELETE CASCADE,
  minute     INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 250),
  second     INTEGER NOT NULL CHECK (second >= 0 AND second <= 59),
  comment    TEXT,
  created_by UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE entry_tags (
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  tag_id   UUID REFERENCES tags(id)    ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

-- ------------------------------------------------------------
-- Indizes für Suche/Filter-Queries
-- ------------------------------------------------------------

CREATE INDEX idx_games_date    ON games(date);
CREATE INDEX idx_games_season  ON games(season);
CREATE INDEX idx_games_team    ON games(team_id);
CREATE INDEX idx_entries_game  ON entries(game_id);

-- ------------------------------------------------------------
-- Seed-Daten: Mannschaften
-- ------------------------------------------------------------

INSERT INTO teams (name) VALUES
  ('U14'), ('U15'), ('U16'), ('U17'), ('U19'), ('U23');

-- ------------------------------------------------------------
-- Seed-Daten: Tags mit Farben
-- ------------------------------------------------------------

INSERT INTO tags (name, color) VALUES
  ('Spielaufbau (Dreier-Aufbau)',  '#3B82F6'),
  ('Spielaufbau (Vierer-Aufbau)', '#6366F1'),
  ('Angriffspressing',            '#EF4444'),
  ('Mittelfeldpressing',          '#F97316'),
  ('Abwehrpressing',              '#EAB308'),
  ('Umschalten Offensiv',         '#22C55E'),
  ('Umschalten Defensiv',         '#14B8A6');

-- ------------------------------------------------------------
-- Row Level Security (RLS)
-- Nur angemeldete Nutzer haben Zugriff — kein öffentlicher Zugang
-- ------------------------------------------------------------

ALTER TABLE teams      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags       ENABLE ROW LEVEL SECURITY;
ALTER TABLE games      ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_tags ENABLE ROW LEVEL SECURITY;

-- Teams: nur lesen
CREATE POLICY "teams_select" ON teams
  FOR SELECT TO authenticated USING (true);

-- Tags: lesen, erstellen, bearbeiten, löschen
CREATE POLICY "tags_select" ON tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "tags_insert" ON tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tags_update" ON tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "tags_delete" ON tags FOR DELETE TO authenticated USING (true);

-- Spiele: lesen, erstellen, bearbeiten, löschen
CREATE POLICY "games_select" ON games FOR SELECT TO authenticated USING (true);
CREATE POLICY "games_insert" ON games FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "games_update" ON games FOR UPDATE TO authenticated USING (true);
CREATE POLICY "games_delete" ON games FOR DELETE TO authenticated USING (true);

-- Einträge: lesen, erstellen, löschen
CREATE POLICY "entries_select" ON entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "entries_insert" ON entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "entries_delete" ON entries FOR DELETE TO authenticated USING (true);

-- Eintrag-Tag-Verknüpfungen: lesen, erstellen, löschen
CREATE POLICY "entry_tags_select" ON entry_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "entry_tags_insert" ON entry_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "entry_tags_delete" ON entry_tags FOR DELETE TO authenticated USING (true);
