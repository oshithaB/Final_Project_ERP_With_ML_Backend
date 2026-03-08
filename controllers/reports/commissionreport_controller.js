const db = require('../../DB/db');


const getCommissionReport = async (req, res) => {
    const { start_date, end_date } = req.query;
    try {
        let sumExpression = `COALESCE(SUM(ii.quantity * p.commission), 0)`;
        let params = [];

        if (start_date && end_date) {
            // Option 1: Use DATE() function to compare only the date part
            sumExpression = `COALESCE(SUM(CASE 
                WHEN DATE(i.invoice_date) >= ? AND DATE(i.invoice_date) <= ? 
                THEN ii.quantity * p.commission
                ELSE 0 
            END), 0)`;
            params = [start_date, end_date];
        } else {
            // No dates provided, calculate total
            sumExpression = `COALESCE(SUM(ii.quantity * p.commission), 0)`;
        }

        const query = `
            SELECT
                e.id AS employee_id,
                e.name AS employee_name,
                e.email AS employee_email,
                ${sumExpression} AS total_commission
            FROM
                employees e
            LEFT JOIN
                invoices i ON e.id = i.employee_id
            LEFT JOIN
                invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN
                products p ON ii.product_id = p.id
            WHERE
                e.is_active = TRUE AND i.status = 'paid'
            GROUP BY
                e.id, e.name, e.email
            ORDER BY
                e.name ASC
        `;

        // Execute the query
        const [results] = await db.execute(query, params);

        // Format the response
        const commissionReport = results.map(row => ({
            employeeId: row.employee_id,
            employeeName: row.employee_name,
            employeeEmail: row.employee_email,
            totalCommission: parseFloat(row.total_commission).toFixed(2)
        }));

        // Send the response
        res.status(200).json({
            success: true,
            data: commissionReport,
            message: 'Commission report retrieved successfully'
        });
    } catch (error) {
        console.error('Error generating commission report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate commission report',
            error: error.message
        });
    }
};

// getCommissionReportByEmployeeId
const getCommissionReportByEmployeeId = async (req, res) => {
    const { employeeId } = req.params;
    const { start_date, end_date } = req.query;
    try {
        let sumExpression = `COALESCE(SUM(ii.quantity * p.commission), 0)`;
        let paramsTotal = [employeeId];
        if (start_date && end_date) {
            // Use DATE() function to compare only the date part
            sumExpression = `COALESCE(SUM(CASE 
                WHEN DATE(i.invoice_date) >= ? AND DATE(i.invoice_date) <= ? 
                THEN ii.quantity * p.commission
                ELSE 0 
            END), 0)`;
            paramsTotal = [start_date, end_date, employeeId];
        }

        // Query to calculate total commission for a specific employee
        const totalCommissionQuery = `
            SELECT
                e.id AS employee_id,
                e.name AS employee_name,
                e.email AS employee_email,
                ${sumExpression} AS total_commission
            FROM
                employees e
            LEFT JOIN
                invoices i ON e.id = i.employee_id
            LEFT JOIN
                invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN
                products p ON ii.product_id = p.id
            WHERE
                e.is_active = TRUE AND e.id = ? AND i.status = 'paid'
            GROUP BY
                e.id, e.name, e.email
        `;

        let whereDate = '';
        let paramsInvoices = [];
        if (start_date && end_date) {
            // Use DATE() function for date comparison
            whereDate = ' AND DATE(i.invoice_date) >= ? AND DATE(i.invoice_date) <= ?';
            paramsInvoices = [employeeId, start_date, end_date];
        } else {
            paramsInvoices = [employeeId];
        }

        // Query to fetch invoice details for the employee (as salesperson)
        const invoicesQuery = `
            SELECT
                i.id AS invoice_id,
                i.invoice_number,
                i.invoice_date,
                i.updated_at AS paid_date,
                i.customer_id,
                i.company_id,
                i.total_amount,
                i.discount_amount,
                co.name AS company_name,
                c.name AS customer_name,
                p.id AS product_id,
                p.name AS product_name,
                ii.quantity,
                p.commission AS commission_per_unit,
                p.commission_type,
                (ii.quantity * p.commission) AS total_commission
            FROM
                employees e
            INNER JOIN
                invoices i ON e.id = i.employee_id
            INNER JOIN
                invoice_items ii ON i.id = ii.invoice_id
            INNER JOIN
                products p ON ii.product_id = p.id
            LEFT JOIN
                customer c ON i.customer_id = c.id
            LEFT JOIN
                company co ON i.company_id = co.company_id
            WHERE
                e.is_active = TRUE AND e.id = ?${whereDate} AND i.status = 'paid'
            ORDER BY
                i.updated_at DESC
        `;

        // Execute the queries
        const [totalCommissionResults] = await db.execute(totalCommissionQuery, paramsTotal);
        const [invoicesResults] = await db.execute(invoicesQuery, paramsInvoices);

        if (totalCommissionResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found or has no commission data'
            });
        }

        const row = totalCommissionResults[0];
        const commissionReport = {
            employeeId: row.employee_id,
            employeeName: row.employee_name,
            employeeEmail: row.employee_email,
            totalCommission: parseFloat(row.total_commission).toFixed(2),
            invoices: invoicesResults.map(invoice => ({
                invoiceId: invoice.invoice_id,
                companyId: invoice.company_id,
                companyName: invoice.company_name,
                invoiceNumber: invoice.invoice_number,
                invoiceDate: invoice.invoice_date,
                paidDate: invoice.paid_date,
                discountAmount: parseFloat(invoice.discount_amount || 0).toFixed(2),
                totalAmount: parseFloat(invoice.total_amount).toFixed(2),
                customerId: invoice.customer_id,
                customerName: invoice.customer_name,
                productId: invoice.product_id,
                productName: invoice.product_name,
                quantity: invoice.quantity,
                commissionPerUnit: parseFloat(invoice.commission_per_unit).toFixed(2),
                totalCommission: parseFloat(invoice.total_commission).toFixed(2),
            }))
        };

        // Send the response
        res.status(200).json({
            success: true,
            data: commissionReport,
            message: 'Commission report for employee retrieved successfully'
        });
    } catch (error) {
        console.error('Error generating commission report for employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate commission report for employee',
            error: error.message
        });
    }
};

module.exports = {
    getCommissionReport,
    getCommissionReportByEmployeeId
};

