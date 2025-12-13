const db = require('./DB/db');

async function checkSchema() {
    try {
        const [rows] = await db.query("SHOW COLUMNS FROM invoices");
        rows.forEach(r => console.log(r.Field));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkSchema();
