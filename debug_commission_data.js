const fs = require('fs');
const db = require('./DB/db');

async function debugCommission() {
    try {
        let output = '--- DEBUGGING COMMISSION DATA ---\n';

        // 1. Check Employees
        const [employees] = await db.query('SELECT id, name, is_active FROM employees');
        output += '\n1. Employees: ' + JSON.stringify(employees, null, 2);

        // 2. Check Invoices (Limit 10)
        const [invoices] = await db.query(`
            SELECT id, invoice_number, employee_id, status, total_amount, updated_at 
            FROM invoices 
            ORDER BY id DESC LIMIT 10
        `);
        output += '\n2. Recent Invoices: ' + JSON.stringify(invoices, null, 2);

        // 3. Check Invoice Items & Products
        if (invoices.length > 0) {
            const invoiceIds = invoices.map(i => i.id).join(',');
            const [items] = await db.query(`
                SELECT ii.invoice_id, ii.product_id, ii.quantity, ii.total_price, 
                       p.name as product_name, p.commission, p.commission_type
                FROM invoice_items ii
                JOIN products p ON ii.product_id = p.id
                WHERE ii.invoice_id IN (${invoiceIds})
            `);
            output += '\n3. Invoice Items & Commissions: ' + JSON.stringify(items, null, 2);
        }

        // 4. Test Join Logic
        const [report] = await db.query(`
            SELECT
                e.name AS employee_name,
                i.invoice_number,
                i.status,
                p.name as product_name,
                p.commission,
                p.commission_type,
                ii.quantity,
                ii.total_price,
                CASE 
                    WHEN p.commission_type = 'percentage' THEN ii.total_price * (p.commission / 100)
                    ELSE ii.quantity * p.commission
                END as calc_comm
            FROM employees e
            LEFT JOIN invoices i ON e.id = i.employee_id
            LEFT JOIN invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN products p ON ii.product_id = p.id
            WHERE e.is_active = TRUE
            ORDER BY i.id DESC
            LIMIT 20
        `);
        output += '\n4. Report Simulation: ' + JSON.stringify(report, null, 2);

        fs.writeFileSync('debug_output.txt', output);
        console.log('Debug output written to debug_output.txt');

    } catch (error) {
        console.error('Debug Error:', error);
    } finally {
        process.exit();
    }
}

debugCommission();
