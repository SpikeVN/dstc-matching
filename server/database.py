import sqlite3
import json
import os
import uuid
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), "data.db")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            full_name TEXT DEFAULT '',
            created_date TEXT NOT NULL DEFAULT (datetime('now')),
            updated_date TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS contestant_profiles (
            id TEXT PRIMARY KEY,
            created_by TEXT NOT NULL,
            created_date TEXT NOT NULL DEFAULT (datetime('now')),
            updated_date TEXT NOT NULL DEFAULT (datetime('now')),
            display_name TEXT NOT NULL DEFAULT '',
            username TEXT NOT NULL DEFAULT '',
            bio TEXT DEFAULT '',
            birth_year INTEGER,
            gender TEXT DEFAULT '',
            city TEXT DEFAULT '',
            school TEXT DEFAULT '',
            major TEXT DEFAULT '',
            profile_image TEXT DEFAULT '',
            technical_skills TEXT DEFAULT '[]',
            soft_skills TEXT DEFAULT '[]',
            experience TEXT DEFAULT '',
            goals TEXT DEFAULT '[]',
            role TEXT DEFAULT '',
            achievements TEXT DEFAULT '',
            achievements_other TEXT DEFAULT '',
            has_team INTEGER DEFAULT 0,
            team_id TEXT DEFAULT '',
            profile_complete INTEGER DEFAULT 0,
            FOREIGN KEY (created_by) REFERENCES users(email)
        );

        CREATE TABLE IF NOT EXISTS matches (
            id TEXT PRIMARY KEY,
            created_date TEXT NOT NULL DEFAULT (datetime('now')),
            updated_date TEXT NOT NULL DEFAULT (datetime('now')),
            user1_id TEXT NOT NULL,
            user2_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'matched',
            user1_confirmed INTEGER DEFAULT 0,
            user2_confirmed INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            created_date TEXT NOT NULL DEFAULT (datetime('now')),
            updated_date TEXT NOT NULL DEFAULT (datetime('now')),
            match_id TEXT NOT NULL,
            sender_id TEXT NOT NULL,
            receiver_id TEXT DEFAULT '',
            content TEXT NOT NULL,
            is_read INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS swipe_actions (
            id TEXT PRIMARY KEY,
            created_date TEXT NOT NULL DEFAULT (datetime('now')),
            updated_date TEXT NOT NULL DEFAULT (datetime('now')),
            swiper_id TEXT NOT NULL,
            swiped_id TEXT NOT NULL,
            action TEXT NOT NULL,
            is_match INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            created_date TEXT NOT NULL DEFAULT (datetime('now')),
            updated_date TEXT NOT NULL DEFAULT (datetime('now')),
            name TEXT NOT NULL,
            leader_id TEXT NOT NULL,
            member_ids TEXT DEFAULT '[]',
            max_members INTEGER DEFAULT 4,
            status TEXT DEFAULT 'forming'
        );

        CREATE TABLE IF NOT EXISTS team_invites (
            id TEXT PRIMARY KEY,
            created_date TEXT NOT NULL DEFAULT (datetime('now')),
            updated_date TEXT NOT NULL DEFAULT (datetime('now')),
            team_id TEXT NOT NULL,
            inviter_id TEXT NOT NULL,
            invitee_id TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending'
        );
    """)

    conn.commit()
    conn.close()


def generate_id():
    return str(uuid.uuid4())


def now():
    return datetime.utcnow().isoformat()


def row_to_dict(row):
    if row is None:
        return None
    d = dict(row)
    # Parse JSON fields
    for field in ('technical_skills', 'soft_skills', 'goals', 'member_ids'):
        if field in d and isinstance(d[field], str):
            try:
                d[field] = json.loads(d[field])
            except (json.JSONDecodeError, TypeError):
                d[field] = []
    # Convert booleans
    for field in ('has_team', 'profile_complete', 'is_match', 'is_read', 'user1_confirmed', 'user2_confirmed'):
        if field in d:
            d[field] = bool(d[field])
    return d


def rows_to_list(rows):
    return [row_to_dict(r) for r in rows]