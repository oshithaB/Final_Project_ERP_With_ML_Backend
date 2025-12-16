const db = require('../DB/db');

// Get top 10 products by sales quantity
const getTop10Products = async (companyId) => {
    try {
        const [rows] = await db.execute(`
            SELECT 
                p.name,
                p.sku,
                SUM(ii.quantity) as total_quantity,
                SUM(ii.total_price) as total_revenue
            FROM products p
            JOIN invoice_items ii ON p.id = ii.product_id
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE i.company_id = ? AND i.status != 'proforma'
            GROUP BY p.id, p.name, p.sku
            ORDER BY total_quantity DESC
            LIMIT 10
        `, [companyId]);
        return rows;
    } catch (error) {
        console.error('Error fetching top 10 products:', error);
        throw error;
    }
}

// Get top 5 salespersons by total sales amount
async function getTop5Salespersons(companyId) {
    try {
        const [rows] = await db.execute(`
            SELECT 
                e.name,
                COUNT(DISTINCT i.id) as total_invoices,
                SUM(i.total_amount) as total_sales
            FROM employees e
            JOIN invoices i ON e.id = i.employee_id
            WHERE i.company_id = ? AND i.status != 'proforma'
            GROUP BY e.id, e.name
            ORDER BY total_sales DESC
            LIMIT 5
        `, [companyId]);
        return rows;
    } catch (error) {
        console.error('Error fetching top 5 salespersons:', error);
        throw error;
    }
}

// Get monthly sales trend for the current year
async function getMonthlySalesTrend(companyId) {
    try {
        const [rows] = await db.execute(`
            SELECT 
                DATE_FORMAT(invoice_date, '%Y-%m') as month,
                SUM(total_amount) as total_sales,
                COUNT(id) as invoice_count
            FROM invoices
            WHERE company_id = ?
            AND YEAR(invoice_date) = YEAR(CURDATE())
            GROUP BY DATE_FORMAT(invoice_date, '%Y-%m')
            ORDER BY month
        `, [companyId]);
        return rows;
    } catch (error) {
        console.error('Error fetching monthly sales trend:', error);
        throw error;
    }
}

// Get customer purchase frequency
async function getCustomerPurchaseFrequency(companyId) {
    try {
        const [rows] = await db.execute(`
            SELECT 
                c.name,
                c.email,
                COUNT(i.id) as purchase_count,
                SUM(i.total_amount) as total_spent
            FROM customer c
            JOIN invoices i ON c.id = i.customer_id
            WHERE c.company_id = ? AND i.status != 'proforma'
            GROUP BY c.id, c.name, c.email
            ORDER BY total_spent DESC
            LIMIT 5
        `, [companyId]);
        return rows;
    } catch (error) {
        console.error('Error fetching customer purchase frequency:', error);
        throw error;
    }
}

// Get product category sales distribution
async function getCategorySalesDistribution(companyId) {
    try {
        const [rows] = await db.execute(`
            SELECT 
                pc.name as category_name,
                SUM(ii.quantity) as total_quantity,
                SUM(ii.total_price) as total_revenue
            FROM product_categories pc
            JOIN products p ON pc.id = p.category_id
            JOIN invoice_items ii ON p.id = ii.product_id
            JOIN invoices i ON ii.invoice_id = i.id
            WHERE pc.company_id = ?
            GROUP BY pc.id, pc.name
            ORDER BY total_revenue DESC
        `, [companyId]);
        return rows;
    } catch (error) {
        console.error('Error fetching category sales distribution:', error);
        throw error;
    }
}

// Get payment method distribution
async function getPaymentMethodDistribution(companyId) {
    try {
        const [rows] = await db.execute(`
            SELECT 
                pm.name as payment_method,
                COUNT(p.id) as payment_count,
                SUM(p.payment_amount) as total_amount
            FROM payment_methods pm
            JOIN payments p ON pm.name = p.payment_method
            WHERE p.company_id = ?
            GROUP BY pm.name
            ORDER BY total_amount DESC
        `, [companyId]);
        return rows;
    } catch (error) {
        console.error('Error fetching payment method distribution:', error);
        throw error;
    }
}

// Get Monthly Sales Trend Comparison with previous month
async function getMonthlySalesTrendComparison(companyId) {
    try {
        const [currentMonthRows] = await db.execute(`
            SELECT 
                SUM(total_amount) as total_sales,
                COUNT(id) as invoice_count
            FROM invoices
            WHERE company_id = ? AND status != 'proforma'
            AND YEAR(invoice_date) = YEAR(CURDATE())
            AND MONTH(invoice_date) = MONTH(CURDATE())
        `, [companyId]);

        const [previousMonthRows] = await db.execute(`
            SELECT 
                SUM(total_amount) as total_sales,
                COUNT(id) as invoice_count
            FROM invoices
            WHERE company_id = ?
            AND YEAR(invoice_date) = YEAR(CURDATE())
            AND MONTH(invoice_date) = MONTH(CURDATE()) - 1
        `, [companyId]);

        return {
            currentMonth: currentMonthRows[0],
            previousMonth: previousMonthRows[0]
        };
    } catch (error) {
        console.error('Error fetching monthly sales trend comparison:', error);
        throw error;
    }
}

module.exports = {
    getTop10Products,
    getTop5Salespersons,
    getMonthlySalesTrend,
    getCustomerPurchaseFrequency,
    getCategorySalesDistribution,
    getPaymentMethodDistribution,
    getMonthlySalesTrendComparison,
};