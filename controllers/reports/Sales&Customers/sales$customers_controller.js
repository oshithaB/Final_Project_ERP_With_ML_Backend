const { get } = require('http');
const db = require('../../../DB/db');
const ExcelJS = require('exceljs');

// Get customer contacts
const getCustomerContacts = async (req, res) => {
  const { company_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
          id,
          name,
          tax_number,
          email,
          phone,
          billing_address,
          shipping_address
       FROM customer
       WHERE company_id = ? AND is_active = TRUE`,
      [company_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Customer not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: rows,
    });
  } catch (error) {
    console.error('Error fetching customer contacts:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error',
    });
  }
};

// Get sales by employee summary
const getSalesByEmployeeSummary = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
          e.name AS employee_name,
          COUNT(i.id) AS total_invoices,
          SUM(i.total_amount) AS total_sales,
          SUM(i.paid_amount) AS total_paid,
          SUM(i.balance_due) AS total_balance_due
       FROM employees e
       LEFT JOIN invoices i ON e.id = i.employee_id
       WHERE e.is_active = TRUE
         AND i.company_id = ?
         AND i.total_amount IS NOT NULL
         AND i.status != 'proforma'
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` GROUP BY e.id, e.name`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching sales by employee summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get sales by customer summary
const getSalesByCustomerSummary = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
          c.id AS customer_id,
          c.name AS customer_name,
          COUNT(i.id) AS total_invoices,
          SUM(i.total_amount) AS total_sales,
          SUM(i.paid_amount) AS total_paid,
          SUM(i.balance_due) AS total_balance_due
       FROM customer c
       LEFT JOIN invoices i ON c.id = i.customer_id
       WHERE c.is_active = TRUE
         AND c.company_id = ?
         AND i.total_amount IS NOT NULL
         AND i.status != 'proforma'
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` GROUP BY c.id, c.name`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching sales by customer summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get sales by customer detail
const getSalesByCustomerDetail = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
          c.name AS customer_name,
          i.invoice_number,
          i.invoice_date,
          i.due_date,
          i.total_amount,
          i.paid_amount,
          i.balance_due,
          i.status
       FROM customer c
       JOIN invoices i ON c.id = i.customer_id
       WHERE c.is_active = TRUE
         AND c.company_id = ?
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` ORDER BY c.name, i.invoice_date`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching sales by customer detail:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get Sales by CustomerID Detail
const getSalesByCustomerIDDetail = async (req, res) => {
  const { company_id, customer_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT
          c.name AS customer_name,
          i.invoice_number,
          i.invoice_date,
          i.due_date,
          i.total_amount,
          i.paid_amount,
          i.balance_due,
          i.status
        FROM customer c
        JOIN invoices i ON c.id = i.customer_id
        WHERE c.is_active = TRUE
          AND c.company_id = ?
          AND c.id = ?
    `;

    const queryParams = [company_id, customer_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` ORDER BY i.invoice_date DESC`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching sales by customer ID detail:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get Sales by Employee Detail
const getSalesByEmployeeDetail = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT
          e.name AS employee_name,
          i.invoice_number,
          i.invoice_date,
          i.due_date,
          i.total_amount,
          i.paid_amount,
          i.balance_due,
          i.status
        FROM employees e
        JOIN invoices i ON e.id = i.employee_id
        WHERE e.is_active = TRUE
          AND i.company_id = ?
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` ORDER BY e.name, i.invoice_date`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching sales by employee detail:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get product/service list
const getProductServiceList = async (req, res) => {
  const { company_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
          p.id,
          p.name,
          p.sku,
          p.description,
          p.unit_price,
          p.manual_count,
          p.quantity_on_hand,
          pc.name AS category_name
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.is_active = TRUE
         AND p.company_id = ?`,
      [company_id]
    );

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching product/service list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get sales by product/service summary
const getSalesByProductServiceSummary = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT
          p.id AS product_id,
          p.name AS product_name,
          p.sku,
          p.unit_price,
          p.cost_price,
          p.manual_count,
          SUM(CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END * ii.quantity) AS total_cost,
          SUM(ii.quantity) AS total_quantity_sold,
          SUM(ii.total_price) AS total_sales
       FROM products p
       JOIN invoice_items ii ON p.id = ii.product_id
       JOIN invoices i ON ii.invoice_id = i.id
       WHERE p.company_id = ? AND i.status != 'proforma'
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` GROUP BY p.id, p.name, p.sku`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching sales by product/service summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get income by customer summary
const getIncomeByCustomerSummary = async (req, res) => {
  try {
    const { company_id } = req.params;
    const { start_date, end_date } = req.query;

    if (!company_id) {
      return res.status(400).json({
        success: false,
        message: 'Company ID is required'
      });
    }

    // Build date filter condition
    const today = new Date().toISOString().split('T')[0];
    const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    let dateCondition = 'AND i.invoice_date BETWEEN ? AND ?';
    let dateParams = [startOfYear, today];

    if (start_date && end_date) {
      dateCondition = 'AND i.invoice_date BETWEEN ? AND ?';
      dateParams = [start_date, end_date];
    } else if (start_date) {
      dateCondition = 'AND i.invoice_date >= ?';
      dateParams = [start_date];
    } else if (end_date) {
      dateCondition = 'AND i.invoice_date <= ?';
      dateParams = [end_date];
    }

    // Get product income per customer
    const [productIncomeResult] = await db.execute(`
          SELECT 
              c.id AS customer_id,
              c.name AS customer_name,
              COALESCE(SUM(ii.quantity * ii.actual_unit_price), 0) as product_income
          FROM invoices i
          INNER JOIN invoice_items ii ON i.id = ii.invoice_id
          INNER JOIN customer c ON i.customer_id = c.id
          WHERE i.company_id = ?
          AND c.is_active = TRUE
          AND i.status != 'proforma'
          ${dateCondition}
          GROUP BY c.id, c.name
      `, [company_id, ...dateParams]);

    // Get shipping income per customer
    const [shippingIncomeResult] = await db.execute(`
          SELECT 
              c.id AS customer_id,
              c.name AS customer_name,
              COALESCE(SUM(i.shipping_cost), 0) as shipping_income
          FROM invoices i
          INNER JOIN customer c ON i.customer_id = c.id
          WHERE i.company_id = ?
          AND c.is_active = TRUE
          AND i.status != 'proforma'
          ${dateCondition}
          GROUP BY c.id, c.name
      `, [company_id, ...dateParams]);

    // Get tax income per customer
    const [taxIncomeResult] = await db.execute(`
          SELECT 
              c.id AS customer_id,
              c.name AS customer_name,
              COALESCE(SUM(i.tax_amount), 0) as tax_income
          FROM invoices i
          INNER JOIN customer c ON i.customer_id = c.id
          WHERE i.company_id = ?
          AND c.is_active = TRUE
          AND i.status != 'proforma'
          ${dateCondition}
          GROUP BY c.id, c.name
      `, [company_id, ...dateParams]);

    // Get cost of sales per customer (expenses)
    const [costOfSalesResult] = await db.execute(`
          SELECT 
              c.id AS customer_id,
              c.name AS customer_name,
              COALESCE(SUM(ii.quantity * CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END), 0) as cost_of_sales
          FROM invoices i
          INNER JOIN invoice_items ii ON i.id = ii.invoice_id
          LEFT JOIN products p ON ii.product_id = p.id
          INNER JOIN customer c ON i.customer_id = c.id
          WHERE i.company_id = ?
          AND c.is_active = TRUE
          AND i.status != 'proforma'
          ${dateCondition}
          GROUP BY c.id, c.name
      `, [company_id, ...dateParams]);

    // Get discount per customer
    const [discountResult] = await db.execute(`
          SELECT 
              c.id AS customer_id,
              c.name AS customer_name,
              COALESCE(SUM(i.discount_amount), 0) as discount
          FROM invoices i
          INNER JOIN customer c ON i.customer_id = c.id
          WHERE i.company_id = ?
          AND c.is_active = TRUE
          AND i.status != 'proforma'
          ${dateCondition}
          GROUP BY c.id, c.name
      `, [company_id, ...dateParams]);

    // Prepare data for all customers
    const customerData = {};

    // Process all results and combine data by customer
    const resultsMap = {
      productIncome: productIncomeResult,
      shippingIncome: shippingIncomeResult,
      taxIncome: taxIncomeResult,
      costOfSales: costOfSalesResult,
      discount: discountResult
    };

    for (const [key, result] of Object.entries(resultsMap)) {
      result.forEach(row => {
        if (!customerData[row.customer_id]) {
          customerData[row.customer_id] = {
            customer_name: row.customer_name,
            product_income: 0,
            shipping_income: 0,
            tax_income: 0,
            cost_of_sales: 0,
            discount: 0
          };
        }

        if (key === 'productIncome') {
          customerData[row.customer_id].product_income = parseFloat(row.product_income || 0);
        }
        if (key === 'shippingIncome') {
          customerData[row.customer_id].shipping_income = parseFloat(row.shipping_income || 0);
        }
        if (key === 'taxIncome') {
          customerData[row.customer_id].tax_income = parseFloat(row.tax_income || 0);
        }
        if (key === 'costOfSales') {
          customerData[row.customer_id].cost_of_sales = parseFloat(row.cost_of_sales || 0);
        }
        if (key === 'discount') {
          customerData[row.customer_id].discount = parseFloat(row.discount || 0);
        }
      });
    }

    // Calculate final income and expense values
    const summaryData = Object.values(customerData).map(customer => {
      const total_income = customer.product_income + customer.shipping_income + customer.tax_income - customer.discount;
      const total_expense = customer.cost_of_sales;

      return {
        customer_name: customer.customer_name,
        income: total_income,
        expense: total_expense,
        net_profit: total_income - total_expense
      };
    });

    res.status(200).json({
      status: 'success',
      data: summaryData
    });

  } catch (error) {
    console.error('Error fetching income by customer summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get sales by product/service detail
const getSalesByProductServiceDetail = async (req, res) => {
  const { company_id, product_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT
          p.id AS product_id,
          p.name AS product_name,
          p.sku,
          COALESCE(CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END, 0) AS cost_price,
          (CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END * ii.quantity) AS total_cost,
          ii.description,
          ii.quantity,
          ii.unit_price,
          ii.total_price,
          i.invoice_number,
          i.invoice_date,
          i.status,
          c.name AS customer_name
          
       FROM products p
       JOIN invoice_items ii ON p.id = ii.product_id
       JOIN invoices i ON ii.invoice_id = i.id
       JOIN customer c ON i.customer_id = c.id
       WHERE p.company_id = ? AND p.id = ?
    `;

    const queryParams = [company_id, product_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` ORDER BY p.name, i.invoice_date`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching sales by product/service detail:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get customer phone list
const getCustomerPhoneList = async (req, res) => {
  const { company_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
          name,
          phone
       FROM customer
       WHERE is_active = TRUE
         AND company_id = ?`,
      [company_id]
    );

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching customer phone list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get deposit detail
const getDepositDetail = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
          p.id,
          p.payment_date,
          p.payment_amount,
          p.payment_method,
          p.deposit_to,
          c.name AS customer_name,
          i.invoice_number,
          i.balance_due,
          i.total_amount,
          i.status AS invoice_status
       FROM payments p
       JOIN customer c ON p.customer_id = c.id
       JOIN invoices i ON p.invoice_id = i.id
       WHERE p.company_id = ?
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND p.payment_date BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` ORDER BY p.payment_date DESC, p.id DESC`;

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

// Get estimates by customer
const getEstimatesByCustomer = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
          c.name AS customer_name,
          e.estimate_number,
          e.estimate_date,
          e.expiry_date,
          e.total_amount,
          e.status
       FROM customer c
       JOIN estimates e ON c.id = e.customer_id
       WHERE c.company_id = ?
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND e.estimate_date BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` ORDER BY c.name, e.estimate_date`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching estimates by customer:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get inventory valuation summary
const getInventoryValuationSummary = async (req, res) => {
  const { company_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
          p.name AS product_name,
          p.sku,
          p.quantity_on_hand AS qty,
          p.cost_price AS cost_price,
          (p.quantity_on_hand * p.cost_price) AS asset_value
          FROM products p
       WHERE p.is_active = TRUE
         AND p.company_id = ?`,
      [company_id]
    );

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching inventory valuation summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get inventory valuation detail
const getInventoryValuationDetail = async (req, res) => {
  const { company_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
          p.name AS product_name,
          p.sku,
          p.description,
          p.quantity_on_hand,
          p.unit_price,
          p.cost_price,
          (p.quantity_on_hand * p.unit_price) AS total_value,
          pc.name AS category_name
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       WHERE p.is_active = TRUE
         AND p.company_id = ?`,
      [company_id]
    );

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching inventory valuation detail:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get payment method list
const getPaymentMethodList = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT DISTINCT
          pm.id,
          pm.name
       FROM payment_methods pm
       JOIN payments p ON pm.name = p.payment_method
       WHERE p.company_id = ?
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND p.payment_date BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching payment method list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get stock take worksheet
const getStockTakeWorksheet = async (req, res) => {
  const { company_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
          p.id,
          p.name AS product_name,
          p.description,
          p.quantity_on_hand,
          p.manual_count,
          p.reorder_level,
          p.cost_price,
          pc.name AS category_name,
          v.name AS preferred_vendor
       FROM products p
       LEFT JOIN product_categories pc ON p.category_id = pc.id
       LEFT JOIN vendor v ON p.preferred_vendor_id = v.vendor_id
       WHERE p.is_active = TRUE
         AND p.company_id = ?
       ORDER BY p.id desc`,
      [company_id]
    );

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching stock take worksheet:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

const updateProductManualCount = async (req, res) => {
  const { company_id } = req.params;
  const { product_id } = req.params;
  const { manual_count } = req.body;

  if (manual_count !== null && manual_count !== undefined && (isNaN(parseFloat(manual_count)) || manual_count < 0)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid manual count value'
    });
  }

  try {
    const [result] = await db.query(
      `UPDATE products 
       SET manual_count = ? 
       WHERE id = ? AND company_id = ?`,
      [manual_count, product_id, company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Product not found or not updated'
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Manual count updated successfully'
    });
  }

  catch (error) {
    console.error('Error updating product manual count:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get time activities by customer detail
const getTimeActivitiesByCustomerDetail = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
          c.name AS customer_name,
          i.invoice_number,
          i.invoice_date,
          ii.description,
          ii.quantity AS hours,
          ii.unit_price AS hourly_rate,
          ii.total_price
       FROM customer c
       JOIN invoices i ON c.id = i.customer_id
       JOIN invoice_items ii ON i.id = ii.invoice_id
       WHERE ii.description LIKE '%time activity%'
         AND c.company_id = ?
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` ORDER BY c.name, i.invoice_date`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching time activities by customer detail:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Get transaction list by customer
const getTransactionListByCustomer = async (req, res) => {
  const { company_id } = req.params;
  const { start_date, end_date } = req.query;

  try {
    let query = `
      SELECT 
          c.name AS customer_name,
          i.invoice_number,
          i.invoice_date,
          i.total_amount,
          i.paid_amount,
          i.balance_due,
          i.status,
          p.payment_date,
          p.payment_amount,
          p.payment_method
       FROM customer c
       LEFT JOIN invoices i ON c.id = i.customer_id
       LEFT JOIN payments p ON i.id = p.invoice_id
       WHERE c.company_id = ? AND c.is_active = TRUE
    `;

    const queryParams = [company_id];

    if (start_date && end_date) {
      query += ` AND DATE(i.invoice_date) BETWEEN ? AND ?`;
      queryParams.push(start_date, end_date);
    }

    query += ` ORDER BY c.name, i.invoice_date, p.payment_date`;

    const [rows] = await db.query(query, queryParams);

    res.status(200).json({
      status: 'success',
      data: rows
    });
  } catch (error) {
    console.error('Error fetching transaction list by customer:', error);
    res.status(500).json({
      status: 'error',
      message: 'Internal server error'
    });
  }
};

// Excel Download Handlers
const getInventoryValuationSummaryExcel = async (req, res) => {
  const { company_id } = req.params;
  console.log(`[Excel Debug] Req received: InventoryValuation. Company: ${company_id}`);
  try {
    const [rows] = await db.query(
      `SELECT 
              p.name AS product_name,
              p.sku,
              p.quantity_on_hand AS qty,
              p.cost_price AS cost_price,
              (p.quantity_on_hand * p.cost_price) AS asset_value
           FROM products p
           WHERE p.is_active = TRUE
             AND p.company_id = ?`,
      [company_id]
    );

    console.log(`[Excel Debug] DB Query success. Rows: ${rows.length}`);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Inventory Valuation');

    worksheet.columns = [
      { header: 'Product Name', key: 'product_name', width: 30 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Qty', key: 'qty', width: 10 },
      { header: 'Cost Price', key: 'cost_price', width: 15 },
      { header: 'Asset Value', key: 'asset_value', width: 15 }
    ];

    worksheet.addRows(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory_valuation.xlsx');

    await workbook.xlsx.write(res);
    res.end();
    console.log('[Excel Debug] Response sent.');
  } catch (error) {
    console.error('[Excel Debug] Error:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

const getProductServiceListExcel = async (req, res) => {
  const { company_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
              p.name,
              p.sku,
              p.description,
              p.unit_price,
              p.cost_price,
              p.quantity_on_hand,
              pc.name AS category_name
           FROM products p
           LEFT JOIN product_categories pc ON p.category_id = pc.id
           WHERE p.is_active = TRUE
             AND p.company_id = ?`,
      [company_id]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Product List');

    worksheet.columns = [
      { header: 'Name', key: 'name', width: 30 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Sales Price', key: 'unit_price', width: 15 },
      { header: 'Cost', key: 'cost_price', width: 15 },
      { header: 'Qty on Hand', key: 'quantity_on_hand', width: 15 },
      { header: 'Category', key: 'category_name', width: 20 }
    ];

    worksheet.addRows(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=product_list.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

const getStockTakeWorksheetExcel = async (req, res) => {
  const { company_id } = req.params;
  try {
    const [rows] = await db.query(
      `SELECT 
              p.name,
              p.sku,
              p.quantity_on_hand
           FROM products p
           WHERE p.is_active = TRUE
             AND p.company_id = ?
           ORDER BY p.name`,
      [company_id]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Stock Take Worksheet');

    worksheet.columns = [
      { header: 'Product Name', key: 'name', width: 30 },
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Qty on Hand', key: 'quantity_on_hand', width: 15 },
      { header: 'Physical Count', key: 'physical_count', width: 15 } // Blank column for manual entry
    ];

    worksheet.addRows(rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=stock_take_worksheet.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating Excel:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
};

module.exports = {
  getCustomerContacts,
  getSalesByEmployeeSummary,
  getSalesByCustomerSummary,
  getSalesByCustomerDetail,
  getSalesByEmployeeDetail,
  getProductServiceList,
  getSalesByProductServiceSummary,
  getIncomeByCustomerSummary,
  getSalesByProductServiceDetail,
  getCustomerPhoneList,
  getDepositDetail,
  getEstimatesByCustomer,
  getInventoryValuationSummary,
  getInventoryValuationDetail,
  getPaymentMethodList,
  getStockTakeWorksheet,
  updateProductManualCount,
  getTimeActivitiesByCustomerDetail,
  getTransactionListByCustomer,
  getSalesByCustomerIDDetail,
  getInventoryValuationSummaryExcel,
  getProductServiceListExcel,
  getStockTakeWorksheetExcel
};