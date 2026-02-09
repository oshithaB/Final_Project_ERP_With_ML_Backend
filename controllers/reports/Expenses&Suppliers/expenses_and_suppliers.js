const { get } = require('http');
const db = require('../../../DB/db');

const getVendorsContactDetails = async (req, res) => {
    const { company_id } = req.params;
    try {
        const [rows] = await db.query(
            `SELECT 
          vendor_id,
          name,
          email,
          phone,
          address,
          tax_number
        FROM vendor
        WHERE is_active = TRUE AND company_id = ?`,
            [company_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                status: 'error',
                message: 'Vendor not found',
            });
        }

        res.status(200).json({
            status: 'success',
            data: rows,
        });
    } catch (error) {
        console.error('Error fetching vendor contacts:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

const getChequeDetails = async (req, res) => {
    const { company_id } = req.params;
    const { start_date, end_date } = req.query;

    try {
        let query = `
      SELECT b.*, pm.name AS payment_method_name, v.name AS vendor_name, e.name AS employee_name
      FROM bills b
      LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
      LEFT JOIN vendor v ON b.vendor_id = v.vendor_id
      LEFT JOIN employees e ON b.employee_id = e.id
      WHERE b.company_id = ? AND pm.name = 'cheque'
    `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(b.bill_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        console.log('Query params:', queryParams);

        const [rows] = await db.query(query, queryParams);

        res.status(200).json({
            status: 'success',
            data: rows,
            total_records: rows.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching cheque details:', error);
        res.status(500).json({
            status: 'error',
            message: 'Internal server error',
        });
    }
};

const getPurchasesByProductServiceSummary = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
          SELECT 
              p.id as product_id,
              p.name as product_name,
              p.sku,
              pc.name as category_name,
              SUM(bi.quantity) as total_quantity_purchased,
              SUM(bi.total_price) as total_purchase_amount,
              AVG(bi.unit_price) as average_unit_price,
              COUNT(DISTINCT b.id) as number_of_purchases
          FROM bill_items bi
          JOIN bills b ON bi.bill_id = b.id
          LEFT JOIN products p ON bi.product_id = p.id
          LEFT JOIN product_categories pc ON p.category_id = pc.id
          WHERE b.company_id = ?
      `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(b.bill_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += `
          GROUP BY p.id, p.name, p.sku, pc.name, bi.product_name
          ORDER BY total_purchase_amount DESC, COALESCE(p.name, bi.product_name)
      `;

        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching purchases by product/service summary:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getPurchasesByClassDetail = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
          SELECT 
              b.employee_id as class,
              e.name as employee_name,
              b.bill_number as order_no,
              b.bill_date as order_date,
              v.name as vendor_name,
              COALESCE(p.name, bi.product_name) as product_name,
              p.sku as sku,
              bi.description,
              bi.quantity as quantity,
              bi.unit_price as unit_price,
              bi.total_price as total_price
          FROM bill_items bi
          JOIN bills b ON bi.bill_id = b.id
          LEFT JOIN employees e ON b.employee_id = e.id
          LEFT JOIN products p ON bi.product_id = p.id
          LEFT JOIN vendor v ON b.vendor_id = v.vendor_id
          WHERE b.company_id = ?
      `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(b.bill_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += `
          ORDER BY b.employee_id, b.bill_date DESC, b.bill_number
      `;

        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching purchases by class detail:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getOpenPurchaseOrdersDetail = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
          SELECT 
              o.id,
              o.order_no,
              o.order_date,
              v.name as vendor_name,
              v.email as vendor_email,
              v.phone as vendor_phone,
              o.mailling_address,
              o.shipping_address,
              o.ship_via,
              o.total_amount,
              o.status,
              oi.name as item_name,
              oi.sku as item_sku,
              oi.description as item_description,
              oi.qty as item_quantity,
              oi.rate as item_rate,
              oi.amount as item_amount,
              o.class as employee_id,
              e.name as employee_name
          FROM orders o
          LEFT JOIN vendor v ON o.vendor_id = v.vendor_id
          LEFT JOIN order_items oi ON o.id = oi.order_id
          LEFT JOIN employees e ON o.class = e.id
          WHERE o.company_id = ? AND o.status = 'open'
      `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(o.order_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += `
          ORDER BY o.order_date DESC, o.order_no, oi.name
      `;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching open purchase orders detail:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getPurchaseList = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
          SELECT 
              b.id,
              b.bill_number as order_no,
              b.bill_date as order_date,
              v.name as vendor_name,
              v.email as vendor_email,
              NULL as mailling_address,
              NULL as shipping_address,
              NULL as ship_via,
              b.total_amount,
              b.status,
              NULL as category_name,
              b.employee_id as class,
              e.name as employee_name,
              NULL as location,
              COUNT(bi.id) as total_items,
              COUNT(bi.id) as received_items,
              COUNT(bi.id) as closed_items
          FROM bills b
          LEFT JOIN vendor v ON b.vendor_id = v.vendor_id
          LEFT JOIN bill_items bi ON b.id = bi.bill_id
          LEFT JOIN employees e ON b.employee_id = e.id
          WHERE b.company_id = ?
      `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(b.bill_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += `
          GROUP BY b.id, b.bill_number, b.bill_date, v.name, v.email, 
                   b.total_amount, b.status, b.employee_id
          ORDER BY b.bill_date DESC, b.bill_number
      `;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching purchase list:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getPurchasesBySupplierSummary = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
          SELECT 
              v.vendor_id,
              v.name as supplier_name,
              v.email,
              v.phone,
              v.address,
              COUNT(DISTINCT b.id) as total_purchases,
              SUM(b.total_amount) as total_purchase_amount,
              MIN(b.bill_date) as first_purchase_date,
              MAX(b.bill_date) as last_purchase_date,
              SUM(CASE WHEN b.status = 'open' THEN 1 ELSE 0 END) as open_orders,
              SUM(CASE WHEN b.status = 'paid' THEN 1 ELSE 0 END) as closed_orders
          FROM vendor v
          LEFT JOIN bills b ON v.vendor_id = b.vendor_id AND b.company_id = ?
      `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(b.bill_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += `
          WHERE v.company_id = ? AND v.is_active = TRUE
          GROUP BY v.vendor_id, v.name, v.email, v.phone, v.address
          HAVING total_purchases > 0
          ORDER BY total_purchase_amount DESC, v.name
      `;

        queryParams.push(company_id);

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching purchases by supplier summary:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getOpenPurchaseOrdersList = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
          SELECT 
              o.id,
              o.order_no,
              o.order_date,
              v.name as vendor_name,
              o.total_amount,
              o.status,
              COUNT(oi.id) as total_items
          FROM orders o
          LEFT JOIN vendor v ON o.vendor_id = v.vendor_id
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.company_id = ? AND o.status = 'open'
      `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(o.order_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += `
          GROUP BY o.id, o.order_no, o.order_date, v.name, o.total_amount, o.status
          ORDER BY o.order_date DESC, o.order_no
      `;

        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching open purchase orders list:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getExpenseBySupplierSummary = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, start_date, end_date });

        let query = `
          SELECT 
              p.id as payee_id,
              p.name as payee_name,
              COUNT(DISTINCT e.id) as total_expenses,
              SUM(CASE WHEN e.status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_expenses,
              SUM(CASE WHEN e.status = 'paid' THEN 1 ELSE 0 END) as paid_expenses,
              SUM(e.amount) as total_expense_amount,
              MIN(e.payment_date) as first_expense_date,
              MAX(e.payment_date) as last_expense_date,
              status,
              GROUP_CONCAT(DISTINCT ec.category_name) as expense_categories
          FROM expenses e
          JOIN payees p ON e.payee_id = p.id
          LEFT JOIN expense_items ei ON e.id = ei.expense_id
          LEFT JOIN expense_categories ec ON ei.category_id = ec.id
          WHERE e.company_id = ?
      `;

        const queryParams = [company_id];

        if (start_date && end_date) {
            query += ` AND DATE(e.payment_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += `
          GROUP BY p.id, p.name
          ORDER BY total_expense_amount DESC, p.name
      `;

        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);

        res.json({
            success: true,
            data: results,
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching expense by supplier summary:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getExpenseBySupplierDetail = async (req, res) => {
    try {
        const { company_id, payee_id } = req.params;
        const { start_date, end_date } = req.query;

        console.log('Received params:', { company_id, payee_id, start_date, end_date });

        let query = `
          SELECT 
              e.id as expense_id,
              e.expense_number,
              e.payment_date,
              e.amount as total_amount,
              e.notes as expense_notes,
              e.status,
              p.id as payee_id,
              p.name as payee_name,
              pa.payment_account_name,
              pm.name as payment_method,
              ei.id as expense_item_id,
              ei.description as item_description,
              ei.amount as item_amount,
              ec.category_name,
              at.account_type_name,
              dt.detail_type_name
          FROM expenses e
          JOIN payees p ON e.payee_id = p.id
          LEFT JOIN payment_account pa ON e.payment_account_id = pa.id
          LEFT JOIN payment_methods pm ON e.payment_method_id = pm.id
          LEFT JOIN expense_items ei ON e.id = ei.expense_id
          LEFT JOIN expense_categories ec ON ei.category_id = ec.id
          LEFT JOIN account_type at ON pa.account_type_id = at.id
          LEFT JOIN detail_type dt ON pa.detail_type_id = dt.id
          WHERE e.company_id = ? AND e.payee_id = ?
      `;

        const queryParams = [company_id, payee_id];

        if (start_date && end_date) {
            query += ` AND DATE(e.payment_date) BETWEEN DATE(?) AND DATE(?)`;
            queryParams.push(start_date, end_date);
            console.log('Date filter applied:', { start_date, end_date });
        }

        query += `
          ORDER BY e.payment_date DESC, e.expense_number, ei.id
      `;

        console.log('Final query:', query);
        console.log('Query params:', queryParams);

        const [results] = await db.execute(query, queryParams);

        console.log(`Found ${results.length} records`);

        // Get payee information for the response
        const [payeeInfo] = await db.execute(
            'SELECT id, name FROM payees WHERE id = ? AND company_id = ?',
            [payee_id, company_id]
        );

        if (payeeInfo.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Payee not found'
            });
        }

        res.json({
            success: true,
            data: results,
            payee_info: payeeInfo[0],
            total_records: results.length,
            filter_applied: { start_date, end_date }
        });
    } catch (error) {
        console.error('Error fetching expense by supplier detail:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getVendorsContactDetails,
    getChequeDetails,
    getPurchasesByProductServiceSummary,
    getPurchasesByClassDetail,
    getOpenPurchaseOrdersDetail,
    getPurchaseList,
    getPurchasesBySupplierSummary,
    getOpenPurchaseOrdersList,
    getExpenseBySupplierSummary,
    getExpenseBySupplierDetail
};
