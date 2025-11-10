-- Migration: add post_stock column to intrari_solutie (safe)
-- Run this in Supabase SQL editor or via psql.

ALTER TABLE intrari_solutie
  ADD COLUMN IF NOT EXISTS post_stock numeric;

-- Optionally ensure "tip" exists (it already exists in your schema, so this is safe):
ALTER TABLE intrari_solutie
  ADD COLUMN IF NOT EXISTS tip varchar(20);

-- Backfill existing rows' post_stock if you want to set it to previous_stock + quantity when missing:
-- UPDATE intrari_solutie
-- SET post_stock = (COALESCE(previous_stock, 0) + COALESCE(quantity, 0))
-- WHERE post_stock IS NULL;

-- Commit/Run instructions:
-- 1) In Supabase: go to "SQL editor" and paste this file, then Run.
-- 2) Or with psql: psql "<connection-string>" -f 20251110_add_post_stock_intrari_solutie.sql
-- Note: Adjust data type numeric -> integer if you store only integers.
