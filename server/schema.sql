-- Lost and Found Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    account_type VARCHAR(10) NOT NULL DEFAULT 'student' CHECK (account_type IN ('student', 'staff')),
    student_number VARCHAR(30) UNIQUE,
    staff_number VARCHAR(30) UNIQUE,
    password_hash TEXT NOT NULL,
    email_updates BOOLEAN NOT NULL DEFAULT TRUE,
    match_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Safe additions for databases created from the earlier email-only schema.
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'student';
ALTER TABLE users ADD COLUMN IF NOT EXISTS student_number VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS staff_number VARCHAR(30);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_updates BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS match_alerts BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE users SET account_type = 'student' WHERE account_type IS NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_type_check;
ALTER TABLE users ADD CONSTRAINT users_account_type_check CHECK (account_type IN ('student', 'staff'));
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_number ON users(student_number) WHERE student_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_staff_number ON users(staff_number) WHERE staff_number IS NOT NULL;

-- Items table
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('lost', 'found')),
    item_category VARCHAR(20) NOT NULL DEFAULT 'other' CHECK (item_category IN ('cards', 'keys', 'phones', 'bags', 'other')),
    location VARCHAR(255) NOT NULL,
    date_event DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
    resolution_notes TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id),
    custody_status VARCHAR(20) CHECK (custody_status IN ('in_custody', 'released')),
    storage_location VARCHAR(255),
    custodian_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS item_category VARCHAR(20) NOT NULL DEFAULT 'other';
ALTER TABLE items ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);
ALTER TABLE items ADD COLUMN IF NOT EXISTS custody_status VARCHAR(20);
ALTER TABLE items ADD COLUMN IF NOT EXISTS storage_location VARCHAR(255);
ALTER TABLE items ADD COLUMN IF NOT EXISTS custodian_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_category_check;
ALTER TABLE items ADD CONSTRAINT items_item_category_check CHECK (item_category IN ('cards', 'keys', 'phones', 'bags', 'other'));
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_custody_status_check;
ALTER TABLE items ADD CONSTRAINT items_custody_status_check CHECK (custody_status IS NULL OR custody_status IN ('in_custody', 'released'));

CREATE TABLE IF NOT EXISTS resolution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    resolved_by UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS custody_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('intake', 'reassigned', 'released')),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Audit events for staff actions
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_item_category ON items(item_category);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_date_event ON items(date_event);
DROP INDEX IF EXISTS idx_items_location;
CREATE INDEX IF NOT EXISTS idx_items_location_trgm ON items USING GIN (location gin_trgm_ops);
-- Add a stored tsvector column for faster full-text search and index it.
ALTER TABLE items ADD COLUMN IF NOT EXISTS search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
) STORED;
CREATE INDEX IF NOT EXISTS idx_items_search_vector ON items USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_items_active_created_at ON items(created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_item_image_uploads_pending ON item_image_uploads(user_id, expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_custody_events_item_created ON custody_events(item_id, created_at DESC);
