ALTER TABLE items
  ADD COLUMN IF NOT EXISTS item_category VARCHAR(20) NOT NULL DEFAULT 'other';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'items_item_category_check'
      AND conrelid = 'items'::regclass
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_item_category_check
      CHECK (item_category IN ('cards', 'keys', 'phones', 'bags', 'other'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_items_item_category ON items(item_category);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_updates BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS match_alerts BOOLEAN NOT NULL DEFAULT TRUE;