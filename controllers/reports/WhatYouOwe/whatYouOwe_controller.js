const db = require('../../../DB/db');

const getSupplierBalanceSummary = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
            SELECT
                v.vendor_id,
                v.name AS customer_name,
                v.email,
                v.phone,
                v.balance AS total_balance_due
            FROM vendor v
            LEFT JOIN orders o ON v.vendor_id = o.vendor_id
            WHERE v.company_id = ?
            AND v.is_active = 1
        `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(o.order_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += ` GROUP BY v.vendor_id, v.name, v.email, v.phone`;
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
        console.error('Error fetching vendor balance summary report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getSupplierBalanceDetail = async (req, res) => {
    try {
        const { company_id, vendor_id } = req.params;
        const { start_date, end_date } = req.query;

        let query = `
            SELECT
                o.id,
                v.vendor_id,
                v.name AS vendor_name,
                v.email AS vendor_email,
                v.phone AS vendor_phone,
                o.order_no,
                o.order_date,
                o.status,
                oi.name AS product_name,
                oi.sku AS product_sku,
                oi.qty AS quantity,
                oi.rate AS unit_cost_price,
                (oi.qty * oi.rate) AS total_cost_price
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN vendor v ON o.vendor_id = v.vendor_id
            WHERE o.company_id = ?
            AND o.vendor_id = ?
        `;

        const queryParams = [company_id, vendor_id];

        if (start_date && end_date) {
            query += ` AND DATE(o.order_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
        }

        query += ` ORDER BY o.order_date DESC`;

        const [results] = await db.execute(query, queryParams);

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching vendor balance detail report:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getAPAgingSummary = async(req, res) => {
    try {
        const { company_id } = req.params;
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

        const next15Days = new Date(currentDate);
        next15Days.setDate(currentDate.getDate() + 15);
        const next30Days = new Date(currentDate);
        next30Days.setDate(currentDate.getDate() + 30);
        const next60Days = new Date(currentDate);
        next60Days.setDate(currentDate.getDate() + 60);

        const query = `
            SELECT 
                co.name AS company_name,
                v.vendor_id AS vendor_id,
                v.name AS vendor_name,
                SUM(CASE WHEN b.due_date = ? THEN (b.total_amount - COALESCE(b.paid_amount, 0)) ELSE 0 END) AS due_today,
                SUM(CASE WHEN b.due_date > ? AND b.due_date <= ? THEN (b.total_amount - COALESCE(b.paid_amount, 0)) ELSE 0 END) AS due_15_days,
                SUM(CASE WHEN b.due_date > ? AND b.due_date <= ? THEN (b.total_amount - COALESCE(b.paid_amount, 0)) ELSE 0 END) AS due_30_days,
                SUM(CASE WHEN b.due_date > ? AND b.due_date <= ? THEN (b.total_amount - COALESCE(b.paid_amount, 0)) ELSE 0 END) AS due_60_days,
                SUM(CASE WHEN b.due_date < ? THEN (b.total_amount - COALESCE(b.paid_amount, 0)) ELSE 0 END) AS overdue,
                SUM(b.total_amount - COALESCE(b.paid_amount, 0)) AS total_outstanding
            FROM 
                bills b
            LEFT JOIN 
                vendor v ON b.vendor_id = v.vendor_id
            LEFT JOIN 
                company co ON b.company_id = co.company_id
            WHERE 
                b.company_id = ? 
                AND b.bill_date >= ?
                AND b.bill_date <= ?
                AND (b.total_amount - COALESCE(b.paid_amount, 0)) > 0
                AND b.status IN ('opened', 'partially_paid', 'overdue')
            GROUP BY 
                co.name, v.vendor_id, v.name
            HAVING 
                total_outstanding > 0
            ORDER BY 
                v.name ASC
        `;

        const params = [
            currentDate.toISOString().split('T')[0], // due_today
            currentDate.toISOString().split('T')[0], next15Days.toISOString().split('T')[0], // due_15_days
            next15Days.toISOString().split('T')[0], next30Days.toISOString().split('T')[0], // due_30_days
            next30Days.toISOString().split('T')[0], next60Days.toISOString().split('T')[0], // due_60_days
            currentDate.toISOString().split('T')[0], // overdue (bills with due_date before today)
            company_id,
            startDate.toISOString().split('T')[0],
            currentDate.toISOString().split('T')[0]
        ];

        const [results] = await db.execute(query, params);

        // Calculate totals across all vendors
        const totals = {
            due_today: 0,
            due_15_days: 0,
            due_30_days: 0,
            due_60_days: 0,
            overdue: 0,
            total_outstanding: 0
        };

        const agingSummary = results.map(row => {
            const vendorData = {
                company_name: row.company_name,
                vendor_id: row.vendor_id,
                vendor_name: row.vendor_name,
                due_today: parseFloat(row.due_today) || 0,
                due_15_days: parseFloat(row.due_15_days) || 0,
                due_30_days: parseFloat(row.due_30_days) || 0,
                due_60_days: parseFloat(row.due_60_days) || 0,
                overdue: parseFloat(row.overdue) || 0,
                total_outstanding: parseFloat(row.total_outstanding) || 0
            };

            // Add to totals
            totals.due_today += vendorData.due_today;
            totals.due_15_days += vendorData.due_15_days;
            totals.due_30_days += vendorData.due_30_days;
            totals.due_60_days += vendorData.due_60_days;
            totals.overdue += vendorData.overdue;
            totals.total_outstanding += vendorData.total_outstanding;

            return vendorData;
        });

        res.status(200).json({
            success: true,
            data: {
                vendors: agingSummary,
                totals: totals,
                period: {
                    start_date: startDate.toISOString().split('T')[0],
                    end_date: currentDate.toISOString().split('T')[0],
                    current_date: currentDate.toISOString().split('T')[0]
                }
            },
            message: 'A/P Aging Summary report retrieved successfully'
        });
    } catch (error) {
        console.error('Error generating A/P Aging Summary report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate A/P Aging Summary report',
            error: error.message
        });
    }
};

const getAPAgingSummaryInDetails = async (req, res) => {
    try {
        const { company_id, vendor_id } = req.params;
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

        const next15Days = new Date(currentDate);
        next15Days.setDate(currentDate.getDate() + 15);
        const next30Days = new Date(currentDate);
        next30Days.setDate(currentDate.getDate() + 30);
        const next60Days = new Date(currentDate);
        next60Days.setDate(currentDate.getDate() + 60);

        const query = `
            SELECT 
                b.id AS bill_id,
                b.bill_number,
                b.bill_date,
                b.due_date,
                b.total_amount,
                COALESCE(b.paid_amount, 0) AS paid_amount,
                (b.total_amount - COALESCE(b.paid_amount, 0)) AS balance_due,
                b.status,
                v.name AS vendor_name,
                co.name AS company_name,
                CASE 
                    WHEN b.due_date = ? THEN 'due_today'
                    WHEN b.due_date > ? AND b.due_date <= ? THEN 'due_15_days'
                    WHEN b.due_date > ? AND b.due_date <= ? THEN 'due_30_days'
                    WHEN b.due_date > ? AND b.due_date <= ? THEN 'due_60_days'
                    WHEN b.due_date < ? THEN 'overdue'
                END AS aging_category
            FROM 
                bills b
            LEFT JOIN 
                vendor v ON b.vendor_id = v.vendor_id
            LEFT JOIN 
                company co ON b.company_id = co.company_id
            WHERE 
                b.status IN ('opened', 'partially_paid', 'overdue')
                AND (b.total_amount - COALESCE(b.paid_amount, 0)) > 0
                AND b.company_id = ?
                AND b.vendor_id = ?
                AND b.bill_date >= ?
                AND b.bill_date <= ?
            ORDER BY 
                b.bill_date DESC
        `;

        const params = [
            currentDate.toISOString().split('T')[0], // due_today
            currentDate.toISOString().split('T')[0], next15Days.toISOString().split('T')[0], // due_15_days
            next15Days.toISOString().split('T')[0], next30Days.toISOString().split('T')[0], // due_30_days
            next30Days.toISOString().split('T')[0], next60Days.toISOString().split('T')[0], // due_60_days
            currentDate.toISOString().split('T')[0], // overdue
            company_id,
            vendor_id,
            startDate.toISOString().split('T')[0],
            currentDate.toISOString().split('T')[0]
        ];

        const [results] = await db.execute(query, params);

        // Group bills by aging category
        const groupedBills = {
            due_today: [],
            due_15_days: [],
            due_30_days: [],
            due_60_days: [],
            overdue: []
        };

        results.forEach(row => {
            const bill = {
                billId: row.bill_id,
                billNumber: row.bill_number,
                billDate: row.bill_date,
                dueDate: row.due_date,
                totalAmount: parseFloat(row.total_amount).toFixed(2),
                paidAmount: parseFloat(row.paid_amount).toFixed(2),
                balanceDue: parseFloat(row.balance_due).toFixed(2),
                status: row.status,
                vendorName: row.vendor_name,
                companyName: row.company_name
            };

            if (row.aging_category && groupedBills[row.aging_category]) {
                groupedBills[row.aging_category].push(bill);
            }
        });

        res.status(200).json({
            success: true,
            data: groupedBills,
            message: 'A/P Aging Details report retrieved successfully'
        });

    } catch (error) {
        console.error('Error generating A/P Aging Details report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate A/P Aging Details report',
            error: error.message
        });
    }
};

const billAndAppliedPayments = async (req, res) => {
    const { company_id } = req.params;
    const { start_date, end_date } = req.query;
    
    try {
      let query = `
        SELECT 
            bp.id,
            bp.payment_date,
            bp.payment_amount,
            bp.payment_method,
            bp.deposit_to,
            v.vendor_id AS vendor_id,
            v.name AS vendor_name,
            b.bill_number,
            b.balance_due,
            b.total_amount,
            b.status AS invoice_status
         FROM bill_payments bp
         JOIN vendor v ON bp.vendor_id = v.vendor_id
         JOIN bills b ON bp.bill_id = b.id
         WHERE bp.company_id = ?
      `;
      
      const queryParams = [company_id];
  
      if (start_date && end_date) {
        query += ` AND bp.payment_date BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
      }
  
      query += ` ORDER BY b.bill_number DESC, bp.payment_date DESC, bp.id DESC`;
  
      const [rows] = await db.query(query, queryParams);
  
      res.status(200).json({
        status: 'success',
        data: rows
      });
    } catch (error) {
      console.error('Error fetching deposit detail:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
};

const unpaidBills = async(req, res) => {
    const { company_id } = req.params;
    const { start_date, end_date } = req.query;
    
    try {
      let query = `
         SELECT b.*, v.name AS vendor_name
         FROM bills b
         JOIN vendor v ON b.vendor_id = v.vendor_id
         WHERE b.company_id = ? AND b.status != 'paid'
      `;
      
      const queryParams = [company_id];
  
      if (start_date && end_date) {
        query += ` AND b.bill_date BETWEEN ? AND ?`;
        queryParams.push(start_date, end_date);
      }
  
      query += ` ORDER BY b.bill_number DESC`;
  
      const [rows] = await db.query(query, queryParams);
  
      res.status(200).json({
        status: 'success',
        data: rows
      });
    } catch (error) {
      console.error('Error fetching deposit detail:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error'
      });
    }
};

module.exports = {
    getSupplierBalanceSummary,
    getSupplierBalanceDetail,
    getAPAgingSummary,
    getAPAgingSummaryInDetails,
    billAndAppliedPayments,
    unpaidBills,
}