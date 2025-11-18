-- Migration: add `furnizor` (supplier) to movements and solutions
-- Run this in your Supabase SQL editor or psql against the project database.

BEGIN;

ALTER TABLE IF EXISTS intrari_solutie
  ADD COLUMN IF NOT EXISTS furnizor text;

ALTER TABLE IF EXISTS solutions
  ADD COLUMN IF NOT EXISTS furnizor text;

COMMIT;
