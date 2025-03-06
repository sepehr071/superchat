// Import database in a way that avoids circular dependency
let db;
function initDb(database) {
  db = database;
}

function migrateAdminColumn() {
  // Make sure db is initialized
  if (!db) {
    throw new Error('Database not initialized for admin migrations');
  }
  
  console.log('Checking for admin column migration...');
  
  // Check if the is_admin column exists in the users table
  try {
    // Try to select the is_admin column from a record
    db.prepare('SELECT is_admin FROM users LIMIT 1').get();
    console.log('Users is_admin column already exists, skipping migration');
  } catch (error) {
    // If error, the column doesn't exist and needs to be added
    if (error.message.includes('no such column')) {
      console.log('Migrating database to add is_admin column to users table...');
      
      // Begin transaction
      db.exec('BEGIN TRANSACTION');
      
      try {
        // Add the is_admin column with default value 0 (not admin)
        db.exec(`ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`);
        
        // Commit transaction
        db.exec('COMMIT');
        console.log('Added is_admin column to users table');
        
        // See if there's a user with username 'god' and set them as admin
        const godUser = db.prepare('SELECT id FROM users WHERE username = ?').get('god');
        if (godUser) {
          db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run('god');
          console.log('Set god user as admin');
        }
      } catch (error) {
        // Rollback on error
        db.exec('ROLLBACK');
        console.error('Failed to add is_admin column to users table:', error);
        throw error;
      }
    } else {
      console.error('Error checking for is_admin column:', error);
      throw error;
    }
  }
}

function migrateUserCascadeDelete() {
  // Make sure db is initialized
  if (!db) {
    throw new Error('Database not initialized for admin migrations');
  }
  
  console.log('Checking for conversations cascade delete migration...');
  
  // Check if we need to do the migration
  // We will create a test table and check if we can add the ON DELETE CASCADE constraint
  try {
    // Check if the foreign key constraint exists correctly
    const foreignKeyInfo = db.prepare(`
      SELECT * FROM pragma_foreign_key_list('conversations')
      WHERE id = 0 AND "table" = 'users'
    `).get();
    
    if (foreignKeyInfo && foreignKeyInfo.on_delete === 'CASCADE') {
      console.log('Conversations table already has ON DELETE CASCADE, skipping migration');
      return;
    }
    
    console.log('Migrating database to add ON DELETE CASCADE for conversations...');
    
    // Begin transaction
    db.exec('BEGIN TRANSACTION');
    
    try {
      // Get the current CREATE TABLE statement for conversations
      const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='conversations'").get();
      if (!tableInfo) {
        throw new Error('Conversations table definition not found');
      }
      
      // Create a temporary table with the correct ON DELETE CASCADE constraint
      db.exec(`
        CREATE TABLE temp_conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          updated_at TEXT DEFAULT (datetime('now')),
          type TEXT DEFAULT 'pdf',
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);
      
      // Copy all data from the original table to the temp table
      db.exec(`INSERT INTO temp_conversations SELECT * FROM conversations`);
      
      // Drop the original table
      db.exec(`DROP TABLE conversations`);
      
      // Rename the temp table to the original name
      db.exec(`ALTER TABLE temp_conversations RENAME TO conversations`);
      
      // Commit transaction
      db.exec('COMMIT');
      console.log('Successfully added ON DELETE CASCADE to conversations table');
    } catch (error) {
      // Rollback on error
      db.exec('ROLLBACK');
      console.error('Failed to add ON DELETE CASCADE to conversations:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error checking for ON DELETE CASCADE constraint:', error);
    throw error;
  }
}

// We don't run migrations here, they will be called from database.js
// after properly initializing the db variable

module.exports = {
  initDb,
  migrateAdminColumn,
  migrateUserCascadeDelete
};