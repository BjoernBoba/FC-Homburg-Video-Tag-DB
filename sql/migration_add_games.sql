-- ============================================================
-- Migration: Spiel-Entity hinzufügen
-- Ausführen im Supabase SQL-Editor (einmalig)
-- ACHTUNG: Löscht bestehende Einträge (entry_tags, entries)
-- ============================================================

-- 1. Alte Tabellen entfernen
DROP TABLE IF EXISTS entry_tags;
DROP TABLE IF EXISTS entries;

-- 2. Spiele-Tabelle anlegen
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

-- 3. Einträge-Tabelle neu anlegen (jetzt mit game_id statt date/season/team_id)
CREATE TABLE entries (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  game_id    UUID    REFERENCES games(id) ON DELETE CASCADE,
  minute     INTEGER NOT NULL CHECK (minute >= 0 AND minute <= 250),
  second     INTEGER NOT NULL CHECK (second >= 0 AND second <= 59),
  comment    TEXT,
  created_by UUID    REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Eintrag-Tag-Verknüpfung neu anlegen
CREATE TABLE entry_tags (
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  tag_id   UUID REFERENCES tags(id)    ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

-- 5. Indizes
CREATE INDEX idx_games_date    ON games(date);
CREATE INDEX idx_games_season  ON games(season);
CREATE INDEX idx_games_team    ON games(team_id);
CREATE INDEX idx_entries_game  ON entries(game_id);

-- 6. Row Level Security
ALTER TABLE games      ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries    ENABLE ROW LEVEL SECURITY;
ALTER TABLE entry_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "games_select" ON games FOR SELECT TO authenticated USING (true);
CREATE POLICY "games_insert" ON games FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "games_update" ON games FOR UPDATE TO authenticated USING (true);
CREATE POLICY "games_delete" ON games FOR DELETE TO authenticated USING (true);

CREATE POLICY "entries_select" ON entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "entries_insert" ON entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "entries_delete" ON entries FOR DELETE TO authenticated USING (true);

CREATE POLICY "entry_tags_select" ON entry_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "entry_tags_insert" ON entry_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "entry_tags_delete" ON entry_tags FOR DELETE TO authenticated USING (true);
