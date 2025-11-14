-- Migration: add invoice number and expiration date columns
-- Adds: numar_factura (varchar) and expiration_date (timestamp with time zone)
-- Targets: intrari_solutie (movements) and solutions (master product table)
-- Run this in Supabase SQL editor or via psql.

ALTER TABLE intrari_solutie
  ADD COLUMN IF NOT EXISTS numar_factura varchar(100);

ALTER TABLE intrari_solutie
  ADD COLUMN IF NOT EXISTS expiration_date timestamptz;

-- Also add expiration_date to solutions (optional, to store product-level expiry)
ALTER TABLE solutions
  ADD COLUMN IF NOT EXISTS expiration_date timestamptz;

-- If you prefer a date-only column instead of timestamptz, replace with DATE.

-- Backfill examples (optional):
-- 1) If you want to set expiration_date based on an existing 'lot' mapping table, run a custom UPDATE here.
-- 2) To set empty invoice numbers to NULL (no-op):
--    UPDATE intrari_solutie SET numar_factura = NULL WHERE numar_factura = '';

-- Run instructions:
-- 1) In Supabase: go to Project -> SQL editor, paste this file and Run.
-- 2) Or with psql: psql "<connection-string>" -f 20251114_add_invoice_and_expiration.sql

-- Note: After running the migration, update your application code to include
-- the new fields when inserting/selecting from `intrari_solutie` and `solutions`.
-- Example insert into intrari_solutie:
-- INSERT INTO intrari_solutie (solution_id, quantity, previous_stock, post_stock, tip, lot, numar_ordine, numar_factura, expiration_date, created_at)
-- VALUES (..., 'FACT123', '2026-01-01T00:00:00Z', ...);
