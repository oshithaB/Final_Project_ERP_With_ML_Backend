const db = require("../../DB/db");

const getSalesReport = async (req, res) => {
    const { start_date, end_date } = req.query;
    try {
        let whereClause = '';
        let params = [];
        if (start_date && end_date) {
            whereClause = 'WHERE i.invoice_date >= ? AND i.invoice_date <= ? AND i.status != "proforma"';
            params = [start_date, end_date];
        }

        const query = `
            SELECT
                e.id AS employee_id,
                e.name AS employee_name,
                e.email AS employee_email,
                COALESCE(SUM(i.total_amount), 0) AS total_sales_amount
            FROM
                employees e
            LEFT JOIN
                invoices i ON e.id = i.employee_id
            ${whereClause}
            GROUP BY
                e.name
        `;

        // Execute the query
        const [results] = await db.execute(query, params);

        // Format the response
        const salesReport = results.map(row => ({
            employeeId: row.employee_id,
            employeeName: row.employee_name,
            employeeEmail: row.employee_email,
            totalSalesAmount: parseFloat(row.total_sales_amount).toFixed(2)
        }));

        // Send the response
        res.status(200).json({
            success: true,
            data: salesReport,
            message: 'Sales report by employee retrieved successfully'
        });
    } catch (error) {
        console.error('Error generating sales report by employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate sales report by employee',
            error: error.message
        });
    }
};

const getSalesReportByEmployeeId = async (req, res) => {
    const { employeeId } = req.params;
    const { start_date, end_date } = req.query;
    try {
        let sumExpression = 'COALESCE(SUM(i.total_amount), 0)';
        let paramsTotal = [employeeId];
        if (start_date && end_date) {
            sumExpression = 'COALESCE(SUM(CASE WHEN i.invoice_date >= ? AND i.invoice_date <= ? THEN i.total_amount ELSE 0 END), 0)';
            paramsTotal = [start_date, end_date, employeeId];
        }

        // Query to calculate total sales amount for a specific employee
        const totalSalesQuery = `
            SELECT
                e.id AS employee_id,
                e.name AS employee_name,
                e.email AS employee_email,
                ${sumExpression} AS total_sales_amount
            FROM
                employees e
            LEFT JOIN
                invoices i ON e.id = i.employee_id
            WHERE
                e.is_active = TRUE AND e.id = ?
            GROUP BY
                e.id, e.name, e.email
        `;

        let whereDate = '';
        let paramsInvoices = [employeeId];
        if (start_date && end_date) {
            whereDate = ' AND i.invoice_date >= ? AND i.invoice_date <= ?';
            paramsInvoices = [employeeId, start_date, end_date];
        }

        // Query to fetch invoice details for the employee
        const invoicesQuery = `
            SELECT
                i.id AS invoice_id,
                i.invoice_number,
                i.invoice_date,
                i.customer_id,
                i.company_id,
                i.total_amount,
                i.status,
                i.paid_amount,
                i.discount_amount,
                co.name AS company_name,
                c.name AS customer_name
            FROM
                employees e
            LEFT JOIN
                invoices i ON e.id = i.employee_id
            LEFT JOIN
                customer c ON i.customer_id = c.id
            LEFT JOIN
                company co ON i.company_id = co.company_id
            WHERE
                e.is_active = TRUE AND e.id = ? AND i.id IS NOT NULL${whereDate}
            ORDER BY
                i.invoice_date DESC
        `;

        // Execute the queries
        const [totalSalesResults] = await db.execute(totalSalesQuery, paramsTotal);
        const [invoicesResults] = await db.execute(invoicesQuery, paramsInvoices);

        if (totalSalesResults.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found or no sales data available'
            });
        }

        const row = totalSalesResults[0];
        const salesReport = {
            employeeId: row.employee_id,
            employeeName: row.employee_name,
            employeeEmail: row.employee_email,
            totalSalesAmount: parseFloat(row.total_sales_amount).toFixed(2),
            invoices: invoicesResults.map(invoice => ({
                invoiceId: invoice.invoice_id,
                companyId: invoice.company_id,
                companyName: invoice.company_name,
                invoiceNumber: invoice.invoice_number,
                invoiceDate: invoice.invoice_date,
                paidAmount: parseFloat(invoice.paid_amount).toFixed(2),
                discountAmount: parseFloat(invoice.discount_amount).toFixed(2),
                totalAmount: parseFloat(invoice.total_amount).toFixed(2),
                status: invoice.status,
                customerId: invoice.customer_id,
                customerName: invoice.customer_name
            }))
        };

        // Send the response
        res.status(200).json({
            success: true,
            data: salesReport,
            message: 'Sales report for the employee retrieved successfully'
        });
    } catch (error) {
        console.error('Error generating sales report for the employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate sales report for the employee',
            error: error.message
        });
    }
};

module.exports = {
    getSalesReport,
    getSalesReportByEmployeeId
};