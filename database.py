import sqlite3
import os
from flask import g

DATABASE = os.path.join(os.path.dirname(__file__), "reelbot.db")

def get_db():
    db = sqlite3.connect(DATABASE)
    db.row_factory = sqlite3.Row
    return db

def init_db():
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS automations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            keyword TEXT NOT NULL,
            link TEXT NOT NULL,
            dm_message TEXT DEFAULT 'Hey! Here is the link you asked for: {link} 🚀',
            reply_comment TEXT DEFAULT 'Check your DM! Sent you the link ✅',
            active INTEGER DEFAULT 1,
            triggered_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            instagram_username TEXT UNIQUE,
            instagram_id TEXT,
            last_comment TEXT,
            dms_received INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            username TEXT,
            message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # Insert default settings if not exists
    defaults = [
        ("ig_username", ""),
        ("ig_password", ""),
        ("poll_interval", "30"),
    ]
    for key, val in defaults:
        db.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (key, val))
    db.commit()
