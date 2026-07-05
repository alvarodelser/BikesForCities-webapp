-- Migration 016: Widen routes.id from INTEGER (SERIAL) to BIGINT.
--
-- The routes_new_id_seq sequence exhausted the INT4 maximum (2,147,483,647).
-- Sequence counters advance even on rolled-back transactions, so repeated
-- ingestion retries on large cities (e.g. Madrid with 9.5M trips) drained
-- the 32-bit range. Widening to BIGINT gives ~9.2 × 10^18 headroom.
--
-- routes.id has no inbound foreign keys, so no dependent column changes needed.

ALTER TABLE routes ALTER COLUMN id TYPE BIGINT;
ALTER SEQUENCE routes_new_id_seq AS BIGINT MAXVALUE 9223372036854775807;
