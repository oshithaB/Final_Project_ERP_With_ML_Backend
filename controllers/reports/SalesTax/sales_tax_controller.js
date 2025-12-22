const db = require('../../../DB/db');

// SSCL (100%) - Tax Detail Report
const SSCL100percentTaxDetail = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                i.invoice_number,
                i.invoice_date,
                c.name AS customer_name,
                ii.tax_rate AS tax_rate,
                SUM(ii.tax_amount) AS total_tax_amount,
                i.total_amount,
                'SSCL' AS tax_rate_name
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN customer c ON i.customer_id = c.id
            WHERE i.company_id = ?
                AND (ii.tax_rate = 2.564 OR ii.tax_rate = 5.00)
                AND i.status != 'cancelled' 
                AND i.status != 'proforma'
        `;

        const queryParams = [company_id];

        // Add date filtering if provided
        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY i.id, i.invoice_number, i.invoice_date, c.name, ii.tax_rate, i.total_amount, 'SSCL'`;
        query += ` ORDER BY i.invoice_date DESC, i.invoice_number`;

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
        console.error('Error fetching SSCL 100% tax detail report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// VAT 18% - Tax Detail Report
const VAT18percentTaxDetail = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                i.invoice_number,
                i.invoice_date,
                c.name as customer_name,
                18.00 as tax_rate,
                SUM(ii.tax_amount) as total_tax_amount,
                i.total_amount,
                'VAT' as tax_rate_name
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN customer c ON i.customer_id = c.id
            WHERE i.company_id = ?
            AND ii.tax_rate = 18.00
            AND i.status != 'cancelled' AND i.status != 'proforma'
        `;

        const queryParams = [company_id];

        // Add date filtering if provided
        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY i.id, i.invoice_number, i.invoice_date, c.name, i.total_amount`;
        query += ` ORDER BY i.invoice_date DESC, i.invoice_number`;

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
        console.error('Error fetching VAT 18% tax detail report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const SSCL100percentTaxException = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT 
                i.invoice_number,
                i.invoice_date,
                c.name as customer_name,
                c.is_taxable as customer_taxable,
                ii.product_name,
                ii.description,
                ii.quantity,
                ii.unit_price,
                ii.tax_rate,
                ii.tax_amount,
                ii.total_price,
                CASE 
                    WHEN c.is_taxable = 1 AND ii.tax_rate != 100.00 THEN 'Missing SSCL Tax'
                    WHEN c.is_taxable = 0 AND ii.tax_rate = 100.00 THEN 'Unexpected SSCL Tax'
                    WHEN ii.tax_amount != (ii.quantity * ii.unit_price * ii.tax_rate / 100) THEN 'Tax Calculation Error'
                    ELSE 'Other Exception'
                END as exception_reason
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN customer c ON i.customer_id = c.id
            WHERE i.company_id = ? 
            AND i.status != 'cancelled'
            AND (
                (c.is_taxable = 1 AND ii.tax_rate != 100.00) OR
                (c.is_taxable = 0 AND ii.tax_rate = 100.00) OR
                (ii.tax_amount != (ii.quantity * ii.unit_price * ii.tax_rate / 100))
            )
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` ORDER BY i.invoice_date DESC, i.invoice_number`;

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
        console.error('Error fetching SSCL 100% tax exception report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const VAT18percentTaxException = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT 
                i.invoice_number,
                i.invoice_date,
                c.name as customer_name,
                c.is_taxable as customer_taxable,
                ii.product_name,
                ii.description,
                ii.quantity,
                ii.unit_price,
                ii.tax_rate,
                ii.tax_amount,
                ii.total_price,
                CASE 
                    WHEN c.is_taxable = 1 AND ii.tax_rate != 18.00 THEN 'Missing VAT 18%'
                    WHEN c.is_taxable = 0 AND ii.tax_rate = 18.00 THEN 'Unexpected VAT 18%'
                    WHEN ii.tax_amount != (ii.quantity * ii.unit_price * ii.tax_rate / 100) THEN 'Tax Calculation Error'
                    ELSE 'Other Exception'
                END as exception_reason
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN customer c ON i.customer_id = c.id
            WHERE i.company_id = ? 
            AND i.status != 'cancelled'
            AND (
                (c.is_taxable = 1 AND ii.tax_rate != 18.00) OR
                (c.is_taxable = 0 AND ii.tax_rate = 18.00) OR
                (ii.tax_amount != (ii.quantity * ii.unit_price * ii.tax_rate / 100))
            )
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` ORDER BY i.invoice_date DESC, i.invoice_number`;

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
        console.error('Error fetching VAT 18% tax exception report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const SSCL100percentTaxSummary = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT 
                DATE_FORMAT(DATE(i.invoice_date), '%Y-%m') as period,
                COUNT(DISTINCT i.id) as total_invoices,
                COUNT(ii.id) as total_items,
                SUM(ii.quantity * ii.unit_price) as taxable_amount,
                SUM(ii.tax_amount) as total_tax_collected,
                AVG(ii.tax_rate) as average_tax_rate
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE i.company_id = ? 
            AND ii.tax_rate = 100.00
            AND i.status != 'cancelled'
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY DATE_FORMAT(DATE(i.invoice_date), '%Y-%m') ORDER BY period DESC`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);
        
        console.log(`Found ${results.length} records`);
        if (results.length > 0) {
            console.log('Date range in results:', {
                earliest: results[results.length - 1].period,
                latest: results[0].period
            });
        }

        const totals = results.reduce((acc, row) => {
            acc.total_invoices += row.total_invoices;
            acc.total_items += row.total_items;
            acc.taxable_amount += parseFloat(row.taxable_amount);
            acc.total_tax_collected += parseFloat(row.total_tax_collected);
            return acc;
        }, { total_invoices: 0, total_items: 0, taxable_amount: 0, total_tax_collected: 0 });

        res.json({
            success: true,
            data: results,
            totals: totals,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching SSCL 100% tax summary report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const VAT18percentTaxSummary = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT 
                DATE_FORMAT(DATE(i.invoice_date), '%Y-%m') as period,
                COUNT(DISTINCT i.id) as total_invoices,
                COUNT(ii.id) as total_items,
                SUM(ii.quantity * ii.unit_price) as taxable_amount,
                SUM(ii.tax_amount) as total_tax_collected,
                AVG(ii.tax_rate) as average_tax_rate
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            WHERE i.company_id = ? 
            AND ii.tax_rate = 18.00
            AND i.status != 'cancelled'
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY DATE_FORMAT(DATE(i.invoice_date), '%Y-%m') ORDER BY period DESC`;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);
        
        console.log(`Found ${results.length} records`);
        if (results.length > 0) {
            console.log('Date range in results:', {
                earliest: results[results.length - 1].period,
                latest: results[0].period
            });
        }

        const totals = results.reduce((acc, row) => {
            acc.total_invoices += row.total_invoices;
            acc.total_items += row.total_items;
            acc.taxable_amount += parseFloat(row.taxable_amount);
            acc.total_tax_collected += parseFloat(row.total_tax_collected);
            return acc;
        }, { total_invoices: 0, total_items: 0, taxable_amount: 0, total_tax_collected: 0 });

        res.json({
            success: true,
            data: results,
            totals: totals,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching VAT 18% tax summary report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const taxLiabilityReport = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT 
                tr.name as tax_type,
                tr.rate as tax_rate,
                COUNT(DISTINCT i.id) as total_invoices,
                SUM(ii.quantity * ii.unit_price) as taxable_amount,
                SUM(ii.tax_amount) as tax_collected,
                SUM(CASE WHEN i.status = 'paid' THEN ii.tax_amount ELSE 0 END) as tax_received,
                SUM(CASE WHEN i.status != 'paid' THEN ii.tax_amount ELSE 0 END) as tax_outstanding
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN tax_rates tr ON ii.tax_rate = tr.rate AND tr.company_id = i.company_id
            WHERE i.company_id = ? 
            AND i.status != 'cancelled'
            AND ii.tax_rate > 0
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY tr.name, tr.rate, ii.tax_rate ORDER BY ii.tax_rate DESC`;

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

        const totals = results.reduce((acc, row) => {
            acc.total_invoices += row.total_invoices;
            acc.taxable_amount += parseFloat(row.taxable_amount);
            acc.tax_collected += parseFloat(row.tax_collected);
            acc.tax_received += parseFloat(row.tax_received);
            acc.tax_outstanding += parseFloat(row.tax_outstanding);
            return acc;
        }, { total_invoices: 0, taxable_amount: 0, tax_collected: 0, tax_received: 0, tax_outstanding: 0 });

        res.json({
            success: true,
            data: results,
            totals: totals,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching tax liability report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const transactionDetailByTaxCode = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date, tax_code } = req.query;

        console.log('Received params:', { company_id, start_date, end_date, tax_code });

        let query = `
            SELECT 
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                c.name as customer_name,
                c.tax_number as customer_tax_number,
                ii.product_name,
                ii.description,
                ii.quantity,
                ii.unit_price,
                ii.actual_unit_price,
                ii.tax_rate,
                ii.tax_amount,
                ii.total_price,
                tr.name as tax_rate_name,
                i.status as invoice_status,
                i.paid_amount,
                i.balance_due
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            JOIN customer c ON i.customer_id = c.id
            LEFT JOIN tax_rates tr ON ii.tax_rate = tr.rate AND tr.company_id = i.company_id
            WHERE i.company_id = ? 
            AND i.status != 'cancelled'
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        if (tax_code) {
            query += ` AND ii.tax_rate = ?`;
            queryParams.push(parseFloat(tax_code));
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

        const summaryByTaxRate = results.reduce((acc, row) => {
            const taxRate = row.tax_rate;
            if (!acc[taxRate]) {
                acc[taxRate] = {
                    tax_rate: taxRate,
                    tax_rate_name: row.tax_rate_name || `${taxRate}%`,
                    transaction_count: 0,
                    total_taxable_amount: 0,
                    total_tax_amount: 0
                };
            }
            acc[taxRate].transaction_count++;
            acc[taxRate].total_taxable_amount += parseFloat(row.quantity * row.unit_price);
            acc[taxRate].total_tax_amount += parseFloat(row.tax_amount);
            return acc;
        }, {});

        res.json({
            success: true,
            data: results,
            summary: Object.values(summaryByTaxRate),
            total_records: results.length,
            filter_applied: { start_date, end_date, tax_code }
        });
    } catch (error) {
        console.error('Error fetching transaction detail by tax code report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    SSCL100percentTaxDetail,
    VAT18percentTaxDetail,
    SSCL100percentTaxException,
    VAT18percentTaxException,
    SSCL100percentTaxSummary,
    VAT18percentTaxSummary,
    taxLiabilityReport,
    transactionDetailByTaxCode
};