const db = require('../config/database').db;

/**
 * Migration script to add auto_generated_title column to conversations table
 */
function runMigration() {
  console.log('Running migration: add auto_generated_title column');
  
  try {
    // Check if the column already exists
    const tableInfo = db.prepare("PRAGMA table_info(conversations)").all();
    const columnExists = tableInfo.some(col => col.name === 'auto_generated_title');
    
    if (!columnExists) {
      // Add the new column
      db.prepare(`
        ALTER TABLE conversations
        ADD COLUMN auto_generated_title BOOLEAN DEFAULT 0
      `).run();
      
      console.log('Added auto_generated_title column to conversations table');
    } else {
      console.log('Column auto_generated_title already exists, skipping');
    }
    
    return { success: true, message: 'Migration completed successfully' };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, message: error.message };
  }
}

// If this script is run directly, execute the migration
if (require.main === module) {
  const result = runMigration();
  if (result.success) {
    console.log('✅ ' + result.message);
    process.exit(0);
  } else {
    console.error('❌ ' + result.message);
    process.exit(1);
  }
}

module.exports = {
  runMigration
};