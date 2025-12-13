const db = require('./DB/db');

async function addReferenceColumn() {
    try {
        const connection = await db.getConnection();

        // Check if column exists first
        const [columns] = await connection.query("SHOW COLUMNS FROM invoices LIKE 'reference'");
        if (columns.length > 0) {
            console.log("Column 'reference' already exists.");
        } else {
            console.log("Adding 'reference' column...");
            await connection.query("ALTER TABLE invoices ADD COLUMN reference VARCHAR(255) NULL AFTER head_note");
            console.log("Column 'reference' added successfully.");
        }

        connection.release();
        process.exit(0);
    } catch (err) {
        console.error("Error adding column:", err);
        process.exit(1);
    }
}

addReferenceColumn();
