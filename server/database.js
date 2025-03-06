const sqlite = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to SQLite database
const dbPath = path.join(dataDir, 'claude-pdf.db');
const db = sqlite(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Helper function to get current ISO timestamp with timezone
function getCurrentISOTimestamp() {
  return new Date().toISOString();
}

// Create tables if they don't exist
function initializeDatabase() {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Conversations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      type TEXT DEFAULT 'pdf',
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // PDF Files table - new table for multiple files
  db.exec(`
    CREATE TABLE IF NOT EXISTS pdf_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      upload_time TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    )
  `);

  // Messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
    )
  `);

  // Message-files relationship table - new table for tracking which files are referenced in each message
  db.exec(`
    CREATE TABLE IF NOT EXISTS message_files (
      message_id INTEGER NOT NULL,
      file_id INTEGER NOT NULL,
      PRIMARY KEY (message_id, file_id),
      FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
      FOREIGN KEY (file_id) REFERENCES pdf_files (id) ON DELETE CASCADE
    )
  `);

  console.log('Database initialized successfully');
}

// Helper function to handle database migration
function migrateDatabase() {
  // Check if we need to migrate from old schema to new schema
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='pdf_files'
  `).get();
  
  if (!tableExists && db.prepare(`SELECT COUNT(*) as count FROM conversations`).get().count > 0) {
    console.log('Migrating database to support multiple files...');
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    try {
      // Get all existing conversations with single pdf_path
      const conversations = db.prepare(`
        SELECT id, pdf_path FROM conversations WHERE pdf_path IS NOT NULL
      `).all();
      
      // Create temporary table to hold conversation data without pdf_path
      db.exec(`
        CREATE TABLE temp_conversations (
          id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          title TEXT,
          created_at TEXT,
          updated_at TEXT,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);
      
      // Copy data to temp table
      db.exec(`
        INSERT INTO temp_conversations (id, user_id, title, created_at, updated_at)
        SELECT id, user_id, title, created_at, updated_at FROM conversations
      `);
      
      // Drop original table
      db.exec(`DROP TABLE conversations`);
      
      // Create new conversations table without pdf_path but with type field
      db.exec(`
        CREATE TABLE conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          type TEXT DEFAULT 'pdf',
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `);
      
      // Copy data back
      db.exec(`
        INSERT INTO conversations (id, user_id, title, created_at, updated_at)
        SELECT id, user_id, title, created_at, updated_at FROM temp_conversations
      `);
      
      // Drop temp table
      db.exec(`DROP TABLE temp_conversations`);
      
      // Create pdf_files table
      db.exec(`
        CREATE TABLE pdf_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          file_path TEXT NOT NULL,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          upload_time TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (conversation_id) REFERENCES conversations (id) ON DELETE CASCADE
        )
      `);
      
      // Create message_files table
      db.exec(`
        CREATE TABLE message_files (
          message_id INTEGER NOT NULL,
          file_id INTEGER NOT NULL,
          PRIMARY KEY (message_id, file_id),
          FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE,
          FOREIGN KEY (file_id) REFERENCES pdf_files (id) ON DELETE CASCADE
        )
      `);
      
      // Migrate existing PDF paths to the new table
      const insertFile = db.prepare(`
        INSERT INTO pdf_files (conversation_id, file_path, file_name, file_type, upload_time)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      for (const conv of conversations) {
        if (conv.pdf_path) {
          const fileName = path.basename(conv.pdf_path);
          insertFile.run(conv.id, conv.pdf_path, fileName, 'application/pdf', getCurrentISOTimestamp());
        }
      }
      
      // Commit transaction
      db.exec('COMMIT');
      console.log('Database migration completed successfully');
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      console.error('Database migration failed:', error);
      throw error;
    }
  }
}

// Helper function to add the type column to conversations table if it doesn't exist
function migrateConversationType() {
  // Check if the type column exists in the conversations table
  try {
    // Try to select the type column from a record
    db.prepare('SELECT type FROM conversations LIMIT 1').get();
    console.log('Conversations type column already exists, skipping migration');
  } catch (error) {
    // If error, the column doesn't exist and needs to be added
    if (error.message.includes('no such column')) {
      console.log('Migrating database to add conversation type...');
      
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      try {
        // Add the type column with default value 'pdf'
        db.exec(`ALTER TABLE conversations ADD COLUMN type TEXT DEFAULT 'pdf'`);
        
        // Update all existing records to have type 'pdf'
        db.exec(`UPDATE conversations SET type = 'pdf'`);
        
        // Commit transaction
        db.exec('COMMIT');
        console.log('Added type column to conversations table');
      } catch (error) {
        // Rollback on error
        db.exec('ROLLBACK');
        console.error('Failed to add type column to conversations table:', error);
        throw error;
      }
    } else {
      console.error('Error checking for type column:', error);
      throw error;
    }
  }
}

// Import the admin migration functions
const adminMigration = require('./admin-migration');

// Initialize and migrate the database
initializeDatabase();
migrateDatabase();
migrateConversationType();

// Initialize the admin migration with db instance and run migrations
adminMigration.initDb(db);
adminMigration.migrateAdminColumn();
adminMigration.migrateUserCascadeDelete();

// Export the database and helper functions
module.exports = {
  db,
  getCurrentISOTimestamp
};
