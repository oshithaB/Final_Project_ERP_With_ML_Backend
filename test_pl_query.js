const db = require('./DB/db');

async function testPL() {
    try {
        const company_id = 1; // Assuming company 1 exists
        const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        const today = new Date().toISOString().split('T')[0];

        console.log(`Testing P&L query for company ${company_id} from ${startOfYear} to ${today}...`);

        const [result] = await db.execute(`
            SELECT 
                COALESCE(SUM(ii.quantity * CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END), 0) as cost_of_sales
            FROM invoices i
            INNER JOIN invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN products p ON ii.product_id = p.id
            WHERE i.company_id = ? 
            AND i.status != 'proforma'
            AND i.invoice_date BETWEEN ? AND ?
        `, [company_id, startOfYear, today]);

        console.log('Result:', result[0]);
        process.exit(0);
    } catch (error) {
        console.error('P&L Query failed!', error);
        process.exit(1);
    }
}

testPL();
