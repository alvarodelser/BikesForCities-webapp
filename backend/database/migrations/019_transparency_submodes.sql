ALTER TABLE city_modes
    ADD COLUMN IF NOT EXISTS transparency_submodes JSONB DEFAULT '[]';
