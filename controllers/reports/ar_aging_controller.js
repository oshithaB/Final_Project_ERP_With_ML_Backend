const db = require('../../DB/db');

const getARAgingSummary = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        // Current date is the "as of" date for the aging report
        let currentDate = end_date ? new Date(end_date) : new Date();
        let startDate = start_date ? new Date(start_date) : null;

        if (!startDate) {
            if (req.query.filter === 'week') {
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 7);
            } else if (req.query.filter === 'month') {
                startDate = new Date(currentDate);
                startDate.setMonth(currentDate.getMonth() - 1);
            } else {
                startDate = new Date(currentDate.getFullYear(), 0, 1);
            }
        }



        const query = `
            SELECT 
                co.name AS company_name,
                c.id AS customer_id,
                c.name AS customer_name,
                -- Current (Not yet due)
                SUM(CASE WHEN DATEDIFF(?, i.due_date) < 0 THEN i.balance_due ELSE 0 END) AS current,
                -- 1-30 days past due
                SUM(CASE WHEN DATEDIFF(?, i.due_date) BETWEEN 1 AND 30 THEN i.balance_due ELSE 0 END) AS due_1_30,
                -- 31-60 days past due
                SUM(CASE WHEN DATEDIFF(?, i.due_date) BETWEEN 31 AND 60 THEN i.balance_due ELSE 0 END) AS due_31_60,
                -- 61-90 days past due
                SUM(CASE WHEN DATEDIFF(?, i.due_date) BETWEEN 61 AND 90 THEN i.balance_due ELSE 0 END) AS due_61_90,
                -- Over 90 days past due
                SUM(CASE WHEN DATEDIFF(?, i.due_date) > 90 THEN i.balance_due ELSE 0 END) AS over_90,
                -- Total balance due
                SUM(i.balance_due) AS total_due
            FROM 
                invoices i
            LEFT JOIN 
                customer c ON i.customer_id = c.id
            LEFT JOIN 
                company co ON i.company_id = co.company_id
            WHERE 
                i.status != 'proforma' 
                AND i.status != 'paid'
                AND i.balance_due > 0
                AND i.company_id = ?
                AND i.invoice_date <= ?
            GROUP BY 
                co.name, c.id, c.name
            HAVING 
                SUM(i.balance_due) > 0
            ORDER BY 
                c.name ASC
        `;

        const params = [
            currentDate.toISOString().split('T')[0], // For current
            currentDate.toISOString().split('T')[0], // For 1-30
            currentDate.toISOString().split('T')[0], // For 31-60
            currentDate.toISOString().split('T')[0], // For 61-90
            currentDate.toISOString().split('T')[0], // For >90
            company_id,
            currentDate.toISOString().split('T')[0] // For invoice_date filter
        ];

        const [results] = await db.execute(query, params);

        const agingSummary = results.map(row => ({
            customerId: row.customer_id,
            companyName: row.company_name,
            customerName: row.customer_name,
            current: parseFloat(row.current || 0).toFixed(2),
            due1to30Days: parseFloat(row.due_1_30 || 0).toFixed(2),
            due31to60Days: parseFloat(row.due_31_60 || 0).toFixed(2),
            due61to90Days: parseFloat(row.due_61_90 || 0).toFixed(2),
            over90Days: parseFloat(row.over_90 || 0).toFixed(2),
            total: parseFloat(
                parseFloat(row.current || 0) +
                parseFloat(row.due_1_30 || 0) +
                parseFloat(row.due_31_60 || 0) +
                parseFloat(row.due_61_90 || 0) +
                parseFloat(row.over_90 || 0)
            ).toFixed(2),
            totalDue: parseFloat(row.total_due || 0).toFixed(2)
        }));

        res.status(200).json({
            success: true,
            data: agingSummary,
            message: 'A/R Aging Summary report retrieved successfully'
        });
    } catch (error) {
        console.error('Error generating A/R Aging Summary report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate A/R Aging Summary report',
            error: error.message
        });
    }
};

const getCustomerInvoices = async (req, res) => {
    try {
        const { company_id, customer_id } = req.params;
        const { start_date, end_date } = req.query;

        let query = `
            SELECT 
                i.id AS invoice_id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.total_amount,
                i.paid_amount,
                i.balance_due,
                i.status
            FROM 
                invoices i
            LEFT JOIN 
                customer c ON i.customer_id = c.id
            WHERE 
                i.company_id = ?
                AND i.customer_id = ?
                AND i.balance_due > 0
        `;

        const params = [company_id, customer_id];

        // Add date filtering if start_date and end_date are provided
        if (start_date && end_date) {
            query += ` AND i.invoice_date >= ? AND i.invoice_date <= ?`;
            params.push(start_date, end_date);
        } else if (start_date) {
            query += ` AND i.invoice_date >= ?`;
            params.push(start_date);
        } else if (end_date) {
            query += ` AND i.invoice_date <= ?`;
            params.push(end_date);
        }

        query += ` ORDER BY i.due_date ASC`;

        const [results] = await db.execute(query, params);

        const invoices = results.map(row => ({
            invoiceId: row.invoice_id,
            invoiceNumber: row.invoice_number,
            invoiceDate: row.invoice_date,
            dueDate: row.due_date,
            totalAmount: parseFloat(row.total_amount).toFixed(2),
            paidAmount: parseFloat(row.paid_amount).toFixed(2),
            balanceDue: parseFloat(row.balance_due).toFixed(2),
            status: row.status
        }));

        // Always return 200 status, even when no invoices are found
        res.status(200).json({
            success: true,
            data: invoices, // This will be an empty array if no invoices found
            message: invoices.length > 0
                ? 'Customer invoices retrieved successfully'
                : 'No invoices found for the specified customer in the given date range'
        });
    } catch (error) {
        console.error('Error fetching customer invoices:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer invoices',
            error: error.message
        });
    }
};

const getARAgingSummaryInDetails = async (req, res) => {
    try {
        const { company_id, customer_id } = req.params;
        const { start_date, end_date } = req.query;

        let currentDate = end_date ? new Date(end_date) : new Date();
        let startDate = start_date ? new Date(start_date) : null;

        if (!startDate) {
            if (req.query.filter === 'week') {
                startDate = new Date(currentDate);
                startDate.setDate(currentDate.getDate() - 7);
            } else if (req.query.filter === 'month') {
                startDate = new Date(currentDate);
                startDate.setMonth(currentDate.getMonth() - 1);
            } else {
                startDate = new Date(currentDate.getFullYear(), 0, 1);
            }
        }



        const query = `
            SELECT 
                i.id AS invoice_id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.total_amount,
                i.paid_amount,
                i.balance_due,
                i.status,
                c.name AS customer_name,
                co.name AS company_name,
                CASE 
                    WHEN DATEDIFF(?, i.due_date) < 0 THEN 'current'
                    WHEN DATEDIFF(?, i.due_date) BETWEEN 1 AND 30 THEN 'due_1_30'
                    WHEN DATEDIFF(?, i.due_date) BETWEEN 31 AND 60 THEN 'due_31_60'
                    WHEN DATEDIFF(?, i.due_date) BETWEEN 61 AND 90 THEN 'due_61_90'
                    WHEN DATEDIFF(?, i.due_date) > 90 THEN 'over_90'
                END AS aging_category
            FROM 
                invoices i
            LEFT JOIN 
                customer c ON i.customer_id = c.id
            LEFT JOIN 
                company co ON i.company_id = co.company_id
            WHERE 
                i.status != 'proforma'
                AND i.balance_due > 0
                AND i.company_id = ?
                AND i.customer_id = ?
                AND i.invoice_date <= ?
            ORDER BY 
                i.invoice_date DESC
        `;

        const params = [
            currentDate.toISOString().split('T')[0], // current
            currentDate.toISOString().split('T')[0], // 1-30
            currentDate.toISOString().split('T')[0], // 31-60
            currentDate.toISOString().split('T')[0], // 61-90
            currentDate.toISOString().split('T')[0], // >90
            company_id,
            customer_id,
            currentDate.toISOString().split('T')[0] // invoice_date filter
        ];

        const [results] = await db.execute(query, params);

        // Group invoices by aging category
        const groupedInvoices = {
            current: [],
            due_1_30: [],
            due_31_60: [],
            due_61_90: [],
            over_90: []
        };

        results.forEach(row => {
            const invoice = {
                invoiceId: row.invoice_id,
                invoiceNumber: row.invoice_number,
                invoiceDate: row.invoice_date,
                dueDate: row.due_date,
                totalAmount: parseFloat(row.total_amount).toFixed(2),
                paidAmount: parseFloat(row.paid_amount).toFixed(2),
                balanceDue: parseFloat(row.balance_due).toFixed(2),
                status: row.status,
                customerName: row.customer_name,
                companyName: row.company_name
            };

            groupedInvoices[row.aging_category].push(invoice);
        });

        if (Object.values(groupedInvoices).every(category => category.length === 0)) {
            return res.status(404).json({
                success: false,
                message: 'No invoices found for the specified customer in the given date range'
            });
        }

        res.status(200).json({
            success: true,
            data: groupedInvoices,
            message: 'A/R Aging Details report retrieved successfully'
        });

    } catch (error) {
        console.error('Error generating A/R Aging Details report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate A/R Aging Details report',
            error: error.message
        });
    }
};

module.exports = {
    getARAgingSummary,
    getCustomerInvoices,
    getARAgingSummaryInDetails,
};
