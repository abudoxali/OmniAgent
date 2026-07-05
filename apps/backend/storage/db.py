"""SQLite database initialization and session management."""
import aiosqlite
import os

DB_PATH = os.getenv("DB_PATH", "./data/omniagent.db")


async def init_db():
    """Initialize the database and create tables if they don't exist."""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                context TEXT,
                prompt TEXT,
                response TEXT,
                model_used TEXT,
                status TEXT DEFAULT 'completed'
            )
        """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS action_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL DEFAULT (datetime('now')),
                action_type TEXT NOT NULL,
                risk_level TEXT NOT NULL,
                approved INTEGER DEFAULT 0,
                details TEXT
            )
        """
        )
        await db.execute(
            """
            CREATE TABLE IF NOT EXISTS workspace_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                content_preview TEXT NOT NULL DEFAULT '',
                is_pinned INTEGER NOT NULL DEFAULT 0,
                is_archived INTEGER NOT NULL DEFAULT 0,
                is_completed INTEGER NOT NULL DEFAULT 0,
                source TEXT,
                provider TEXT,
                model TEXT,
                mode TEXT,
                metadata_json TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """
        )
        await db.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workspace_items_type_updated
            ON workspace_items (item_type, is_archived, is_pinned, updated_at DESC)
        """
        )
        await db.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workspace_items_search
            ON workspace_items (title, item_type, is_archived)
        """
        )
        await db.commit()


async def get_db():
    """Get a database connection."""
    return await aiosqlite.connect(DB_PATH)
