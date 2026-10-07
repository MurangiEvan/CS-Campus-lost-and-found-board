ALTER TABLE items
  ADD COLUMN IF NOT EXISTS custody_status VARCHAR(20),
  ADD COLUMN IF NOT EXISTS storage_location VARCHAR(255),
  ADD COLUMN IF NOT EXISTS custodian_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'items_custody_status_check' AND conrelid = 'items'::regclass
  ) THEN
    ALTER TABLE items ADD CONSTRAINT items_custody_status_check
      CHECK (custody_status IS NULL OR custody_status IN ('in_custody', 'released'));
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS item_image_uploads (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  content_type VARCHAR(50) NOT NULL,
  byte_size BIGINT NOT NULL CHECK (byte_size > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'attached', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_image_uploads_pending
  ON item_image_uploads(user_id, expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS custody_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES users(id),
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('intake', 'reassigned', 'released')),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custody_events_item_created
  ON custody_events(item_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_items_active_created_at
  ON items(created_at DESC) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_items_search_vector ON items USING GIN (search_vector);

DROP INDEX IF EXISTS idx_items_location;
CREATE INDEX IF NOT EXISTS idx_items_location_trgm ON items USING GIN (location gin_trgm_ops);

DROP INDEX IF EXISTS idx_items_search;