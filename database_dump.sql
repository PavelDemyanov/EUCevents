-- Database dump for Event Management System
-- Generated on: 2025-08-22
-- PostgreSQL version: 14+

-- Drop existing tables if they exist
DROP TABLE IF EXISTS event_chats CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS reserved_numbers CASCADE;
DROP TABLE IF EXISTS fixed_number_bindings CASCADE;
DROP TABLE IF EXISTS chats CASCADE;
DROP TABLE IF EXISTS bots CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS admin_users CASCADE;

-- Create tables with proper structure

-- Admin Users table
CREATE TABLE admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR NOT NULL UNIQUE,
    password TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    full_name VARCHAR,
    email VARCHAR,
    is_super_admin BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Events table
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    datetime TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    share_code VARCHAR,
    description VARCHAR(900),
    allowed_transport_types TEXT[] DEFAULT ARRAY['monowheel', 'scooter', 'eboard', 'spectator']
);

-- Bots table
CREATE TABLE bots (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL,
    name VARCHAR NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Chats table
CREATE TABLE chats (
    id SERIAL PRIMARY KEY,
    chat_id VARCHAR NOT NULL,
    bot_id INTEGER NOT NULL REFERENCES bots(id),
    title VARCHAR,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Users (participants) table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    telegram_id VARCHAR NOT NULL,
    telegram_nickname VARCHAR,
    full_name TEXT NOT NULL,
    phone VARCHAR NOT NULL,
    transport_type VARCHAR NOT NULL,
    participant_number INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT true,
    event_id INTEGER NOT NULL REFERENCES events(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
    transport_model VARCHAR
);

-- Reserved Numbers table
CREATE TABLE reserved_numbers (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    number INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Fixed Number Bindings table
CREATE TABLE fixed_number_bindings (
    id SERIAL PRIMARY KEY,
    telegram_nickname VARCHAR NOT NULL,
    participant_number INTEGER NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Event Chats table
CREATE TABLE event_chats (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id),
    chat_id INTEGER NOT NULL REFERENCES chats(id),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
CREATE INDEX idx_users_event_id ON users(event_id);
CREATE INDEX idx_users_participant_number ON users(participant_number);
CREATE INDEX idx_chats_chat_id ON chats(chat_id);
CREATE INDEX idx_events_share_code ON events(share_code);
CREATE INDEX idx_reserved_numbers_event_id ON reserved_numbers(event_id);
CREATE INDEX idx_event_chats_event_id ON event_chats(event_id);
CREATE INDEX idx_event_chats_chat_id ON event_chats(chat_id);

-- Add unique constraints
ALTER TABLE users ADD CONSTRAINT unique_participant_number_per_event UNIQUE(event_id, participant_number);
ALTER TABLE reserved_numbers ADD CONSTRAINT unique_reserved_number_per_event UNIQUE(event_id, number);

-- Insert default admin user (admin/admin123)
INSERT INTO admin_users (username, password, is_active, full_name, is_super_admin) VALUES 
('admin', '$2b$10$8K1p/a0dClxnNnA2H5L.8euI0M8zjZQNr8w2/vXlQrEe/3YRZqm.q', true, 'Администратор', true);

-- Sample event data (optional - remove if not needed)
-- INSERT INTO events (name, location, datetime, description) VALUES 
-- ('Пример мероприятия', 'Москва, Красная площадь', '2025-08-25 10:00:00', 'Пример описания мероприятия для тестирования системы');

COMMIT;