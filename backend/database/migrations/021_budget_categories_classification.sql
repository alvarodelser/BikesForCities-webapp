ALTER TABLE city_budget_categories
    ADD COLUMN IF NOT EXISTS classification VARCHAR(16) NOT NULL DEFAULT 'functional';

ALTER TABLE city_budget_categories
    DROP CONSTRAINT IF EXISTS city_budget_categories_city_id_year_budget_type_category_co_key;

ALTER TABLE city_budget_categories
    ADD CONSTRAINT city_budget_categories_unique
    UNIQUE (city_id, year, budget_type, classification, category_code);
