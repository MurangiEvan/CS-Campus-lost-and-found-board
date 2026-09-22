-- Lost and Found Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE items ADD COLUMN IF NOT EXISTS item_category VARCHAR(20) NOT NULL DEFAULT 'other';
ALTER TABLE items ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES users(id);
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_item_category_check;
ALTER TABLE items ADD CONSTRAINT items_item_category_check CHECK (item_category IN ('cards', 'keys', 'phones', 'bags', 'other'));

CREATE TABLE IF NOT EXISTS resolution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    resolved_by UUID NOT NULL REFERENCES users(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_item_category ON items(item_category);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_items_date_event ON items(date_event);
CREATE INDEX IF NOT EXISTS idx_items_location ON items(location);
CREATE INDEX IF NOT EXISTS idx_items_search ON items USING GIN (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));
