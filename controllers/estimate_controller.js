const db = require("../DB/db");
const lockStore = require('../utils/lockStore');

const getEstimates = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({ error: "Company ID is required" });
    }

    await db.query(`
            UPDATE estimates
            SET status = 'closed'
            WHERE company_id = ? 
              AND status = 'pending' 
              AND expiry_date IS NOT NULL 
              AND expiry_date < NOW()
        `, [companyId]);

    const query = `SELECT 
                            e.id,
                            e.estimate_number,
                            e.company_id,
                            e.customer_id,
                            c.name AS customer_name,
                            e.employee_id,
                            emp.name AS employee_name,
                            e.estimate_date,
                            e.expiry_date,
                            e.head_note,
                            e.subtotal,
                            e.discount_type,
                            e.discount_amount,
                            e.tax_amount,
                            e.total_amount,
                            e.status,
                            e.is_active,
                            e.notes,
                            e.terms,
                            e.shipping_address,
                            e.shipping_cost,
                            e.billing_address,
                            e.ship_via,
                            e.shipping_date,
                            e.tracking_number,
                            e.invoice_id,
                            e.created_at
                        FROM 
                            estimates e
                        JOIN 
                            customer c ON e.customer_id = c.id
                        LEFT JOIN 
                            employees emp ON e.employee_id = emp.id
                        WHERE 
                            e.company_id = ? AND e.is_active = 1
                        ORDER BY e.created_at DESC;
                        `;
    const [estimates] = await db.query(query, [companyId]);
    res.json(estimates);
  } catch (error) {
    console.error("Error fetching estimates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

const getEstimatesByCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return res.status(400).json({ error: "Customer ID is required" });
    }

    await db.query(`
            UPDATE estimates
            SET status = 'closed'
            WHERE customer_id = ?
              AND status = 'pending'
              AND expiry_date IS NOT NULL
              AND expiry_date < NOW()
        `, [customerId]);

    const query = `SELECT 
                            e.id,
                            e.estimate_number,
                            e.company_id,
                            e.customer_id,
                            c.name AS customer_name,
                            e.employee_id,
                            emp.name AS employee_name,
                            e.estimate_date,
                            e.expiry_date,
                            e.head_note,
                            e.subtotal,
                            e.discount_type,
                            e.discount_amount,
                            e.tax_amount,
                            e.total_amount,
                            e.status,
                            e.is_active,
                            e.notes,
                            e.terms,
                            e.shipping_address,
                            e.shipping_cost,
                            e.billing_address,
                            e.ship_via,
                            e.shipping_date,
                            e.tracking_number
                        FROM 
                            estimates e
                        JOIN 
                            customer c ON e.customer_id = c.id
                        LEFT JOIN 
                            employees emp ON e.employee_id = emp.id
                        WHERE 
                            e.customer_id = ? AND e.is_active = 1;`;
    const [estimates] = await db.query(query, [customerId]);
    res.json(estimates);
  } catch (error) {
    console.error("Error fetching estimates by customer:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

const createEstimate = async (req, res) => {
  let connection;
  try {
    const {
      estimate_number,
      company_id,
      customer_id,
      employee_id,
      estimate_date,
      expiry_date,
      head_note,
      discount_type,
      discount_value,
      shipping_cost,
      status,
      is_active,
      notes,
      terms,
      shipping_address,
      billing_address,
      ship_via,
      shipping_date,
      tracking_number,
      items
    } = req.body;

    // Validate required fields
    if (!estimate_number) {
      return res.status(400).json({ error: "Estimate number is required" });
    }
    if (!company_id) {
      return res.status(400).json({ error: "Company ID is required" });
    }
    if (!customer_id) {
      return res.status(400).json({ error: "Customer ID is required" });
    }
    if (!estimate_date) {
      return res.status(400).json({ error: "Estimate date is required" });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "At least one valid item is required" });
    }

    // Validate items (only input fields, not calculations)
    for (const item of items) {
      if (!item.product_id || item.product_id === 0) {
        return res.status(400).json({ error: "Each item must have a valid product ID" });
      }
      if (!item.description) {
        return res.status(400).json({ error: "Each item must have a description" });
      }
      if (!item.quantity || item.quantity <= 0) {
        return res.status(400).json({ error: "Each item must have a valid quantity" });
      }
      if ((item.unit_price === undefined || item.unit_price === null) || item.unit_price < 0) {
        return res.status(400).json({ error: "Each item must have a valid unit price" });
      }
      if (item.tax_rate < 0 || isNaN(item.tax_rate)) {
        return res.status(400).json({ error: "Tax rate must be a non-negative number" });
      }
    }

    // Initialize database connection
    connection = await db.getConnection();
    await connection.beginTransaction();

    // --- Transactional Estimate Number Generation ---
    // Select company row FOR UPDATE to lock it for sequence safety
    // User wants shared prefix with Invoice, so select invoice_prefix
    const [companyData] = await connection.query(
      `SELECT current_estimate_number, invoice_prefix, invoice_separators FROM company WHERE company_id = ? FOR UPDATE`,
      [company_id]
    );

    if (companyData.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Company not found" });
    }

    const { current_estimate_number, invoice_prefix, invoice_separators } = companyData[0];
    const nextNumber = (current_estimate_number || 0) + 1;
    // Format sequence as 4 digits (e.g. 0001) as requested
    const nextNumberStr = String(nextNumber).padStart(4, '0');

    // Generate YY format
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);

    // Use company prefix (invoice_prefix)
    const prefix = invoice_prefix || 'EST';

    // Check separator setting
    const useSeparator = (invoice_separators !== 0 && invoice_separators !== false);
    const sep = useSeparator ? '-' : '';

    // Format: COMPANY_PREFIX[-]YY[-]EST[-]SEQUENCE
    const newEstimateNumber = `${prefix}${sep}${yy}${sep}EST${sep}${nextNumberStr}`;

    console.log(`Generated New Estimate Number: ${newEstimateNumber}`);

    // Prevent duplicate estimate numbers (sanity check, though sequence should be unique)
    const [duplicateEstimate] = await connection.query(
      `SELECT id FROM estimates WHERE estimate_number = ? AND company_id = ?`,
      [newEstimateNumber, company_id]
    );
    if (duplicateEstimate.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: `Estimate number '${newEstimateNumber}' already exists` });
    }

    // Update estimate_number variable to be used in insertion
    // Note: We need to use newEstimateNumber in the INSERT statement later.
    // The variable 'estimate_number' was destructured from const, so we can't reassign it if strict.
    // But we can use 'newEstimateNumber' in the values array.

    // Recalculate item values
    const updatedItems = items.map(item => {
      const subtotal = item.quantity * item.unit_price;
      const actualUnitPrice = Number((item.unit_price / (1 + item.tax_rate / 100)).toFixed(4));
      const taxAmount = Number((actualUnitPrice * item.tax_rate / 100 * item.quantity).toFixed(2));
      const totalPrice = Number(subtotal.toFixed(2));

      return {
        ...item,
        actual_unit_price: actualUnitPrice,
        tax_amount: taxAmount,
        total_price: totalPrice
      };
    });

    // Calculate totals
    const calculatedSubtotal = Number(updatedItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2));
    const calculatedTaxAmount = Number(updatedItems.reduce((sum, item) => sum + item.tax_amount, 0).toFixed(2));
    const calculatedDiscountAmount = discount_type === 'percentage'
      ? Number((calculatedSubtotal * (discount_value || 0) / 100).toFixed(2))
      : Number((discount_value || 0).toFixed(2));
    const calculatedTotalAmount = Number((calculatedSubtotal + (shipping_cost || 0) - calculatedDiscountAmount).toFixed(2));

    // Insert into estimates table
    const estimateQuery = `INSERT INTO estimates
                    (estimate_number, company_id, customer_id, employee_id, estimate_date, expiry_date, head_note, 
                     subtotal, discount_type, discount_amount, shipping_cost, tax_amount, total_amount, 
                     status, is_active, notes, terms, shipping_address, billing_address, ship_via, 
                     shipping_date, tracking_number)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const estimateValues = [
      newEstimateNumber, // Use the generated estimate number
      company_id,
      customer_id,
      employee_id || null,
      estimate_date,
      expiry_date || null,
      head_note || null,
      calculatedSubtotal,
      discount_type || 'fixed',
      calculatedDiscountAmount,
      shipping_cost || 0,
      calculatedTaxAmount,
      calculatedTotalAmount,
      status || 'pending',
      is_active !== undefined ? is_active : true,
      notes || null,
      terms || null,
      shipping_address || null,
      billing_address || null,
      ship_via || null,
      shipping_date || null,
      tracking_number || null
    ];

    const [estimateResult] = await connection.query(estimateQuery, estimateValues);

    if (estimateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Failed to create estimate" });
    }

    // --- Update company current_estimate_number ---
    await connection.query(
      `UPDATE company SET current_estimate_number = ? WHERE company_id = ?`,
      [nextNumber, company_id]
    );

    // Insert estimate items
    const itemQuery = `INSERT INTO estimate_items
                      (estimate_id, product_id, description, quantity, unit_price, actual_unit_price, tax_rate, tax_amount, total_price)
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const item of updatedItems) {
      const itemValues = [
        estimateResult.insertId,
        item.product_id,
        item.description,
        item.quantity,
        item.unit_price,
        item.actual_unit_price,
        item.tax_rate,
        item.tax_amount,
        item.total_price
      ];
      const [itemResult] = await connection.query(itemQuery, itemValues);
      if (itemResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).json({ error: "Failed to create estimate items" });
      }
    }

    // Commit transaction
    await connection.commit();

    // Response object
    const newEstimate = {
      id: estimateResult.insertId,
      estimate_number,
      company_id,
      customer_id,
      employee_id,
      estimate_date,
      expiry_date,
      head_note,
      subtotal: calculatedSubtotal,
      discount_type,
      discount_value,
      discount_amount: calculatedDiscountAmount,
      shipping_cost,
      tax_amount: calculatedTaxAmount,
      total_amount: calculatedTotalAmount,
      status,
      is_active,
      notes,
      terms,
      shipping_address,
      billing_address,
      ship_via,
      shipping_date,
      tracking_number,
      created_at: new Date().toISOString(),
      items: updatedItems
    };

    res.status(201).json(newEstimate);
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error creating estimate:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: `Estimate number '${req.body.estimate_number}' already exists` });
    }
    res.status(500).json({ error: error.sqlMessage || "Internal server error" });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const editEstimate = async (req, res) => {
  const {
    id,
    estimate_number,
    company_id,
    customer_id,
    employee_id,
    estimate_date,
    expiry_date,
    head_note,
    subtotal,
    discount_type,
    discount_amount,
    shipping_cost,
    tax_amount,
    total_amount,
    status,
    is_active,
    notes,
    terms,
    shipping_address,
    billing_address,
    ship_via,
    shipping_date,
    tracking_number,
    items
  } = req.body;

  if (!id) return res.status(400).json({ error: "Estimate ID is required" });

  // Validate required fields
  if (!estimate_number || !company_id || !customer_id || !estimate_date || (subtotal === undefined || subtotal === null) || isNaN(subtotal)) {
    return res.status(400).json({ error: "Required fields are missing or invalid" });
  }

  // Check if locked
  if (lockStore.isLocked('estimate', id)) {
    const lockUser = lockStore.getLock('estimate', id);
    // Simple blocking for now as discussed
    if (lockUser && lockUser.id !== req.userId && lockUser.id !== req.user?.id) {
      // return res.status(403).json({ error: "Estimate is currently being edited by another user." });
    }
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "At least one valid item is required" });
  }

  for (const item of items) {
    if (!item.product_id || item.product_id === 0) return res.status(400).json({ error: "Each item must have a valid product ID" });
    if (!item.description) return res.status(400).json({ error: "Each item must have a description" });
    if (!item.quantity || item.quantity <= 0) return res.status(400).json({ error: "Each item must have a valid quantity" });
    if ((item.unit_price === undefined || item.unit_price === null) || item.unit_price < 0) return res.status(400).json({ error: "Each item must have a valid unit price" });
    if (item.tax_rate < 0 || item.tax_amount < 0 || item.total_price < 0) {
      return res.status(400).json({ error: "Tax rate, tax amount, and total price must be valid" });
    }
  }

  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Update estimate
    const updateEstimateQuery = `
          UPDATE estimates SET
            estimate_number = ?, company_id = ?, customer_id = ?, employee_id = ?, estimate_date = ?, expiry_date = ?, head_note = ?,
            subtotal = ?, discount_type = ?, discount_amount = ?, shipping_cost = ?, tax_amount = ?, total_amount = ?, 
            status = ?, is_active = ?, notes = ?, terms = ?, shipping_address = ?, billing_address = ?, 
            ship_via = ?, shipping_date = ?, tracking_number = ?
          WHERE id = ?
        `;

    const updateValues = [
      estimate_number, company_id, customer_id, employee_id || null, estimate_date, expiry_date || null, head_note || null,
      subtotal, discount_type || 'fixed', discount_amount || 0, shipping_cost || 0, tax_amount || 0, total_amount || 0,
      status || 'pending', is_active !== undefined ? is_active : true, notes || null, terms || null,
      shipping_address || null, billing_address || null, ship_via || null, shipping_date || null, tracking_number || null,
      id
    ];

    const [updateResult] = await connection.query(updateEstimateQuery, updateValues);
    if (updateResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Estimate not found or failed to update" });
    }

    // Delete existing items
    await connection.query('DELETE FROM estimate_items WHERE estimate_id = ?', [id]);

    // Insert updated items
    const insertItemQuery = `
          INSERT INTO estimate_items
            (estimate_id, product_id, description, quantity, unit_price, actual_unit_price, tax_rate, tax_amount, total_price)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

    for (const item of items) {
      const itemValues = [
        id,
        item.product_id,
        item.description,
        item.quantity,
        item.unit_price,
        item.actual_unit_price || item.unit_price,
        item.tax_rate,
        item.tax_amount,
        item.total_price
      ];
      const [itemResult] = await connection.query(insertItemQuery, itemValues);
      if (itemResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).json({ error: "Failed to update estimate items" });
      }
    }

    await connection.commit();

    res.status(200).json({ message: "Estimate updated successfully", estimate_id: id });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error updating estimate:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: `Estimate number '${req.body.estimate_number}' already exists` });
    }
    res.status(500).json({ error: error.sqlMessage || "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

const deleteEstimate = async (req, res) => {
  try {
    const { estimateId } = req.params;

    if (!estimateId) {
      return res.status(400).json({ error: "Estimate ID is required" });
    }

    // Check if estimate exists
    const [estimate] = await db.query('SELECT * FROM estimates WHERE id = ? AND is_active = 1', [estimateId]);
    if (estimate.length === 0) {
      return res.status(404).json({ error: "Estimate not found" });
    }

    // Delete estimate items
    await db.query('DELETE FROM estimate_items WHERE estimate_id = ?', [estimateId]);

    // Delete estimate
    const [result] = await db.query('DELETE FROM estimates WHERE id = ?', [estimateId]);

    if (result.affectedRows === 0) {
      return res.status(400).json({ error: "Failed to delete estimate" });
    }

    res.status(200).json({ message: "Estimate deleted successfully" });
  } catch (error) {
    console.error("Error deleting estimate:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

const getEstimatesItems = async (req, res) => {
  try {
    const { estimateId } = req.params;

    if (!estimateId) {
      return res.status(400).json({ error: "Estimate ID is required" });
    }

    const query = `SELECT 
                            ei.id,
                            ei.estimate_id,
                            ei.product_id,
                            p.name AS product_name,
                            ei.description,
                            ei.quantity,
                            ei.unit_price,
                            ei.actual_unit_price,
                            ei.tax_rate,
                            ei.tax_amount,
                            ei.total_price
                        FROM 
                            estimate_items ei
                        JOIN 
                            products p ON ei.product_id = p.id
                        WHERE 
                            ei.estimate_id = ?;`;
    const [items] = await db.query(query, [estimateId]);
    res.json(items);
  } catch (error) {
    console.error("Error fetching estimate items:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

const convertEstimateToInvoice = async (req, res) => {
  const { companyId, estimateId } = req.params;

  if (!companyId || !estimateId) {
    return res.status(400).json({ error: "Company ID and Estimate ID are required" });
  }

  // Start transaction
  const connection = await db.getConnection();
  await connection.beginTransaction();

  try {
    // Fetch estimate details
    const [estimate] = await connection.query(
      `SELECT 
                  e.*,
                  c.name AS customer_name,
                  emp.name AS employee_name
               FROM estimates e
               JOIN customer c ON e.customer_id = c.id
               LEFT JOIN employees emp ON e.employee_id = emp.id
               WHERE e.id = ? AND e.company_id = ? AND e.is_active = 1`,
      [estimateId, companyId]
    );

    if (!estimate || estimate.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Estimate not found" });
    }

    const estimateData = estimate[0];

    // --- Generate Invoice Number (Standard Sequence) ---
    // Fetch company current invoice number FOR UPDATE
    const [companyData] = await connection.query(
      `SELECT invoice_prefix, current_invoice_number, invoice_separators FROM company WHERE company_id = ? FOR UPDATE`,
      [companyId]
    );

    if (companyData.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Company not found" });
    }

    const { invoice_prefix, current_invoice_number, invoice_separators } = companyData[0];
    const nextInvoiceNumber = (current_invoice_number || 0) + 1;

    // Use company prefix or default 'INV'
    const prefix = invoice_prefix || 'INV';

    // Generate YY format
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);

    // Check separator setting
    const useSeparator = (invoice_separators !== 0 && invoice_separators !== false);
    const sep = useSeparator ? '-' : '';

    // Standard Invoice Number: PREFIX[-]YY[-]INV[-]SEQ
    const invoiceNumber = `${prefix}${sep}${yy}${sep}INV${sep}${nextInvoiceNumber}`;
    console.log(`Converted Estimate to Invoice Number: ${invoiceNumber}`);

    // Create invoice
    const invoiceQuery = `
              INSERT INTO invoices (
                  company_id, customer_id, employee_id, estimate_id, invoice_number, head_note,
                  invoice_date, due_date, discount_type, discount_value, discount_amount,
                  notes, terms, shipping_address, shipping_cost, billing_address, ship_via, 
                  shipping_date, tracking_number, subtotal, tax_amount, total_amount,
                  status, reference
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    const invoiceValues = [
      companyId,
      estimateData.customer_id,
      estimateData.employee_id || null,
      estimateId,
      invoiceNumber,
      estimateData.head_note || null,
      new Date().toISOString().split('T')[0],
      estimateData.expiry_date || null,
      estimateData.discount_type || 'fixed',
      estimateData.discount_amount || 0.00,
      estimateData.discount_amount || 0.00,
      estimateData.notes || null,
      estimateData.terms || null,
      estimateData.shipping_address || null,
      estimateData.shipping_cost || 0.00,
      estimateData.billing_address || null,
      estimateData.ship_via || null,
      estimateData.shipping_date || null,
      estimateData.tracking_number || null,
      estimateData.subtotal || 0.00,
      estimateData.tax_amount || 0.00,
      estimateData.total_amount || 0.00,
      'draft', // Initial status
      estimateData.estimate_number // Reference
    ];

    const [invoiceResult] = await connection.query(invoiceQuery, invoiceValues);

    if (invoiceResult.affectedRows === 0) {
      await connection.rollback();
      return res.status(400).json({ error: "Failed to create invoice" });
    }

    // --- Update company current_invoice_number ---
    await connection.query(
      `UPDATE company SET current_invoice_number = ? WHERE company_id = ?`,
      [nextInvoiceNumber, companyId]
    );

    // Fetch estimate items
    const [estimateItems] = await connection.query(
      `SELECT ei.*, prod.name AS product_name
               FROM estimate_items ei
               JOIN products prod ON ei.product_id = prod.id
               WHERE ei.estimate_id = ?`,
      [estimateId]
    );

    // Insert invoice items
    const itemQuery = `
              INSERT INTO invoice_items (
                  invoice_id, product_id, product_name, description, quantity, unit_price, 
                  actual_unit_price, tax_rate, tax_amount, total_price
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

    for (const item of estimateItems) {
      const itemValues = [
        invoiceResult.insertId,
        item.product_id,
        item.product_name,
        item.description,
        item.quantity,
        item.unit_price,
        item.actual_unit_price,
        item.tax_rate,
        item.tax_amount,
        item.total_price
      ];
      const [itemResult] = await connection.query(itemQuery, itemValues);
      if (itemResult.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).json({ error: "Failed to create invoice items" });
      }
    }

    // Update estimate status to 'accepted' and set invoice_id
    // Changed status from 'converted' to 'accepted' so it doesn't vanish if 'converted' is hidden
    const updateEstimateQuery = `
              UPDATE estimates 
              SET status = 'accepted', invoice_id = ?
              WHERE id = ?
          `;
    await connection.query(updateEstimateQuery, [invoiceResult.insertId, estimateId]);

    // Commit transaction
    await connection.commit();

    res.status(200).json({
      message: "Estimate converted to invoice successfully",
      invoice_id: invoiceResult.insertId,
      invoice_number: invoiceNumber
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error("Error converting estimate to invoice:", error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: `Invoice number '${invoiceNumber}' already exists` });
    }
    res.status(500).json({ error: error.sqlMessage || "Internal server error" });
  } finally {
    if (connection) connection.release();
  }
};

const updateEstimateAfterInvoice = async (req, res) => {
  try {
    const { companyId, estimateId } = req.params;
    const { invoice_id } = req.body;

    if (!companyId || !estimateId || !invoice_id) {
      return res.status(400).json({ error: "Company ID, Estimate ID, and Invoice ID are required" });
    }

    const [estimate] = await db.query(
      `SELECT * FROM estimates WHERE id = ? AND company_id = ? AND is_active = 1`,
      [estimateId, companyId]
    );

    if (!estimate || estimate.length === 0) {
      return res.status(404).json({ error: "Estimate not found" });
    }

    if (estimate[0].status === 'converted' || estimate[0].invoice_id !== null) {
      return res.status(400).json({ error: "Estimate has already been converted to an invoice" });
    }

    await db.query(
      `UPDATE estimates 
         SET status = 'converted', invoice_id = ?
         WHERE id = ? AND company_id = ?`,
      [invoice_id, estimateId, companyId]
    );

    res.status(200).json({ message: "Estimate updated successfully" });
  } catch (error) {
    console.error("Error updating estimate after invoice creation:", error);
    res.status(500).json({ error: error.sqlMessage || "Internal server error" });
  }
};

module.exports = {
  getEstimates,
  createEstimate,
  deleteEstimate,
  editEstimate,
  getEstimatesItems,
  convertEstimateToInvoice,
  getEstimatesByCustomer,
  updateEstimateAfterInvoice
};