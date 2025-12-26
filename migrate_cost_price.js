const db = require('./DB/db');

async function migrate() {
    try {
        console.log('Starting migration: Adding cost_price to invoice_items...');

        // Check if column already exists to prevent errors
        const [columns] = await db.query("SHOW COLUMNS FROM invoice_items LIKE 'cost_price'");

        if (columns.length === 0) {
            await db.query("ALTER TABLE invoice_items ADD COLUMN cost_price DECIMAL(15,4) DEFAULT 0 AFTER unit_price");
            console.log('Success: Column cost_price added to invoice_items.');
        } else {
            console.log('Column cost_price already exists.');
        }

        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

migrate();
