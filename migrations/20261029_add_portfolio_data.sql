-- Additive migration for persisting an ordered portfolio photo/edit snapshot.
-- Run once against an existing LUMEN database; existing rows are retained.
ALTER TABLE portfolio_briefs
  ADD COLUMN portfolio_data JSON DEFAULT NULL;
