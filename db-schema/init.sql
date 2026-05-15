-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ROLES
-- We create explicit database roles to map to PostgREST/Supabase or manual row-level security
CREATE ROLE authed_user;

-- USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keycloak_id VARCHAR(255) UNIQUE NOT NULL, -- Serves as the primary Service ID (e.g. OFF-001)
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) CHECK (role IN ('Officer', 'Soldier', 'Family')) NOT NULL,
    rank_or_relation VARCHAR(255),
    unit_or_link VARCHAR(255),
    public_identity_key TEXT, -- Allow null for seed logic until real device registration occurs
    device_id VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active'
);

-- INVITE TOKENS TABLE
CREATE TABLE IF NOT EXISTS invite_tokens (
    token_hash VARCHAR(255) PRIMARY KEY,
    role VARCHAR(50) CHECK (role IN ('Officer', 'Soldier', 'Family')) NOT NULL,
    issuer_id UUID REFERENCES users(id),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_used BOOLEAN DEFAULT FALSE
);

-- GROUPS (Units, Platoons, Families)
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    creator_id UUID REFERENCES users(id),
    is_emergency_channel BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES groups(id),
    user_id UUID REFERENCES users(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);

-- MESSAGES (Encrypted Payloads Only)
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id) NOT NULL,
    receiver_id UUID REFERENCES users(id), -- Null if group message
    group_id UUID REFERENCES groups(id),   -- Null if direct message
    encrypted_payload TEXT NOT NULL,
    encrypted_session_key TEXT, -- Added for Hybrid E2EE (Sender encrypts AES key with Recipient RSA Public Key)
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read'))
);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- SYSTEM LOGS (Audit Trails)
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES users(id),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users can only read messages they sent or received
CREATE POLICY "Users can read their own messages" ON messages
    FOR SELECT
    USING (
        sender_id = current_setting('request.jwt.claim.sub')::uuid OR 
        receiver_id = current_setting('request.jwt.claim.sub')::uuid
    );

-- Users can only insert messages if they are the sender
CREATE POLICY "Users can insert messages as sender" ON messages
    FOR INSERT
    WITH CHECK (
        sender_id = current_setting('request.jwt.claim.sub')::uuid
    );

-- ==========================================
-- SEED DATA (Replacing Client Mocks)
-- ==========================================
INSERT INTO users (keycloak_id, name, role, rank_or_relation, unit_or_link) VALUES
('OFF-001', 'Gen. B. Rawat', 'Officer', 'General', 'Army HQ'),
('OFF-002', 'Col. S. Sharma', 'Officer', 'Colonel', '1st Battalion'),
('OFF-003', 'Major R. Singh', 'Officer', 'Major', 'Northern Command'),
('SOL-001', 'Hav. A. Patil', 'Soldier', 'Havildar', '1st Inf Div'),
('SOL-002', 'Naik J. Singh', 'Soldier', 'Naik', '2nd Inf Div'),
('SOL-003', 'Sep. R. Prasad', 'Soldier', 'Sepoy', '3rd Inf Div'),
('FAM-SOL-001', 'Patil Family', 'Family', 'Dependent', 'SOL-001'),
('FAM-SOL-002', 'Singh Family', 'Family', 'Dependent', 'SOL-002')
ON CONFLICT (keycloak_id) DO NOTHING;
