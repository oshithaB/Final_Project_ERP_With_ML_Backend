const db = require('../../../DB/db');

const getOpenInvoices = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                i.id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                c.name AS customer_name,
                i.subtotal,
                i.tax_amount,
                i.discount_amount,
                i.total_amount,
                i.paid_amount,
                i.balance_due,
                i.status
            FROM invoices i
            JOIN customer c ON i.customer_id = c.id
            WHERE i.company_id = ?
            AND i.status IN ('opened', 'partially_paid', 'overdue')
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` ORDER BY c.name, i.invoice_date DESC, i.invoice_number`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0) {
            console.log('Date range in results:', {
                earliest: results[results.length - 1].invoice_date,
                latest: results[0].invoice_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching open invoices report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getCustomerBalanceSummary = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                c.id,
                c.name AS customer_name,
                c.email,
                c.phone,
                SUM(i.balance_due) AS total_balance_due
            FROM customer c
            LEFT JOIN invoices i ON c.id = i.customer_id
            WHERE c.company_id = ?
            AND i.status IN ('opened', 'sent', 'partially_paid', 'overdue')
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY c.id, c.name, c.email, c.phone`;
        query += ` ORDER BY total_balance_due DESC`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0 && start_date && end_date) {
            console.log('Date range in results:', {
                earliest: start_date,
                latest: end_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching customer balance summary report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getCustomerBalanceDetail = async (req, res) => {
    try {
        const { company_id, customer_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                c.id,
                c.name AS customer_name,
                c.email,
                c.phone,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.subtotal,
                i.tax_amount,
                i.discount_amount,
                i.total_amount,
                i.paid_amount,
                i.balance_due,
                i.status
            FROM customer c
            LEFT JOIN invoices i ON c.id = i.customer_id
            WHERE c.company_id = ? AND c.id = ?
            AND i.status IN ('opened', 'sent', 'partially_paid', 'overdue')
        `;

        const queryParams = [company_id, customer_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` ORDER BY c.name, i.invoice_date DESC, i.invoice_number`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0) {
            console.log('Date range in results:', {
                earliest: results[results.length - 1].invoice_date,
                latest: results[0].invoice_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching customer balance detail report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getCollectionReport = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                p.id,
                p.payment_date,
                p.payment_amount,
                p.payment_method,
                p.deposit_to,
                c.name AS customer_name,
                i.invoice_number
            FROM payments p
            JOIN customer c ON p.customer_id = c.id
            JOIN invoices i ON p.invoice_id = i.id
            WHERE p.company_id = ?
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(p.payment_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` ORDER BY p.payment_date DESC, i.invoice_number`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0) {
            console.log('Date range in results:', {
                earliest: results[results.length - 1].payment_date,
                latest: results[0].payment_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching collection report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getStatementList = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                c.id,
                c.name AS customer_name,
                c.email,
                c.phone,
                COUNT(i.id) AS invoice_count,
                SUM(i.total_amount) AS total_invoiced,
                SUM(i.paid_amount) AS total_paid,
                SUM(i.balance_due) AS total_balance_due
            FROM customer c
            LEFT JOIN invoices i ON c.id = i.customer_id
            WHERE c.company_id = ?
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY c.id, c.name, c.email, c.phone`;
        query += ` ORDER BY c.name`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0 && start_date && end_date) {
            console.log('Date range in results:', {
                earliest: start_date,
                latest: end_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching statement list report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getInvoiceList = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                i.id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                c.name AS customer_name,
                i.subtotal,
                i.tax_amount,
                i.discount_amount,
                i.total_amount,
                i.paid_amount,
                i.balance_due,
                i.status
            FROM invoices i
            JOIN customer c ON i.customer_id = c.id
            WHERE i.company_id = ?
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` ORDER BY c.name, i.invoice_date DESC, i.invoice_number`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0) {
            console.log('Date range in results:', {
                earliest: results[results.length - 1].invoice_date,
                latest: results[0].invoice_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching invoice list report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getTermsList = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT DISTINCT
                i.terms,
                COUNT(i.id) AS invoice_count,
                SUM(i.total_amount) AS total_invoiced
            FROM invoices i
            WHERE i.company_id = ?
            AND i.terms IS NOT NULL
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY i.terms`;
        query += ` ORDER BY i.terms`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0 && start_date && end_date) {
            console.log('Date range in results:', {
                earliest: start_date,
                latest: end_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching terms list report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getUnbilledCharges = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                e.id,
                e.estimate_number,
                e.estimate_date,
                c.name AS customer_name,
                e.subtotal,
                e.tax_amount,
                e.discount_amount,
                e.total_amount,
                e.status
            FROM estimates e
            JOIN customer c ON e.customer_id = c.id
            WHERE e.company_id = ?
            AND e.status = 'accepted'
            AND e.invoice_id IS NULL
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(e.estimate_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` ORDER BY e.estimate_date DESC, e.estimate_number`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0) {
            console.log('Date range in results:', {
                earliest: results[results.length - 1].estimate_date,
                latest: results[0].estimate_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching unbilled charges report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getUnbilledTime = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                e.id,
                e.estimate_number,
                e.estimate_date,
                c.name AS customer_name,
                ei.description,
                ei.quantity,
                ei.unit_price,
                ei.tax_amount,
                ei.total_price
            FROM estimates e
            JOIN estimate_items ei ON e.id = ei.estimate_id
            JOIN customer c ON e.customer_id = c.id
            WHERE e.company_id = ?
            AND e.status = 'accepted'
            AND e.invoice_id IS NULL
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(e.estimate_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` ORDER BY e.estimate_date DESC, e.estimate_number`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);
        if (results.length > 0) {
            console.log('Date range in results:', {
                earliest: results[results.length - 1].estimate_date,
                latest: results[0].estimate_date
            });
        }

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching unbilled time report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getOpenInvoices,
    getCustomerBalanceSummary,
    getCustomerBalanceDetail,
    getCollectionReport,
    getStatementList,
    getInvoiceList,
    getTermsList,
    getUnbilledCharges,
    getUnbilledTime
};