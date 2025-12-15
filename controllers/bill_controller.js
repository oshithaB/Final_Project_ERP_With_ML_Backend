const db = require('../DB/db');

const createBill = async (req, res) => {
  const { company_id } = req.params;
  const {
    bill_number,
    order_id,
    vendor_id,
    bill_date,
    payment_method, // This is expected to be payment_method_id
    employee_id,
    due_date,
    terms,
    notes,
    items,
    mark_as_paid // New flag
  } = req.body;

  console.log("Received createBill request for company_id:", company_id);
  console.log("Creating bill with data:", req.body);

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // Validate required fields - Only vendor_id and items are strictly required
    if (!vendor_id) {
      throw new Error('Vendor is required');
    }
    if (!items || items.length === 0) {
      throw new Error('Items are required');
    }

    // New Logic: If mark_as_paid is true, payment_method is required
    if (mark_as_paid && !payment_method) {
      throw new Error('Payment method is required when marking as paid');
    }

    // Auto-generate bill_number if not provided
    let finalBillNumber = bill_number;
    if (!finalBillNumber) {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 1000);
      finalBillNumber = `BILL-${timestamp}-${random}`;
      console.log('Auto-generated bill number:', finalBillNumber);
    }

    // Check if order_id is provided and already has a bill
    if (order_id) {
      const [orderCheck] = await conn.execute(
        'SELECT bill_id FROM orders WHERE id = ? AND company_id = ?',
        [order_id, company_id]
      );
      if (orderCheck.length > 0 && orderCheck[0].bill_id !== null) {
        throw new Error('This order has already been converted to a bill');
      }
    }

    // Recalculate total_price for each item using the correct field names from frontend
    // UPDATED LOGIC: Input Price is Tax Exclusive (Forward Calculation)
    const recalculatedItems = items.map(item => {
      const quantity = Number(item.quantity) || 0;
      const costPrice = Number(item.cost_price) || Number(item.unit_price) || 0; // Using cost_price from frontend
      const taxRate = Number(item.tax_rate) || 0;

      // New Logic: costPrice IS the actual unit price (before tax)
      const actualUnitPrice = Number(costPrice.toFixed(4));

      const subtotal = actualUnitPrice * quantity;
      const taxAmount = Number((subtotal * (taxRate / 100)).toFixed(2));
      const totalPrice = Number((subtotal + taxAmount).toFixed(2));

      return {
        ...item,
        actual_unit_price: actualUnitPrice, // Store as actual unit price
        unit_price: actualUnitPrice,        // Store as unit price (cost price)
        cost_price: actualUnitPrice,        // Normalize field
        tax_amount: taxAmount,
        total_price: totalPrice
      };
    });

    const calculatedTotal = Number(recalculatedItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0).toFixed(2));

    console.log("Inserting bill with calculated total:", calculatedTotal);

    // Determine Status and Payment Values based on mark_as_paid
    const status = mark_as_paid ? 'paid' : 'opened';
    const paidAmount = mark_as_paid ? calculatedTotal : 0;
    const balanceDue = mark_as_paid ? 0 : calculatedTotal;

    // Ensure all parameters are properly handled (convert undefined to null)
    // payment_method can now be null if not marking as paid
    const insertParams = [
      company_id,
      finalBillNumber,  // Use auto-generated or provided bill number
      order_id || null,
      vendor_id || null,
      employee_id || null,
      bill_date || null,  // Allow null if not provided
      due_date || null,
      payment_method || null,
      notes || null,
      calculatedTotal,
      status,       // Insert Status
      paidAmount,   // Insert Paid Amount
      balanceDue    // Insert Balance Due
    ];

    console.log("Insert parameters:", insertParams);

    const [result] = await conn.execute(
      `INSERT INTO bills 
        (company_id, bill_number, order_id, vendor_id, employee_id, bill_date, due_date, payment_method_id, notes, total_amount, status, paid_amount, balance_due)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      insertParams
    );

    const billId = result.insertId;

    // Update the orders table with the bill_id if order_id is provided
    if (order_id) {
      await conn.execute(
        'UPDATE orders SET bill_id = ? WHERE id = ? AND company_id = ?',
        [billId, order_id, company_id]
      );
    }

    // Insert bill items
    for (const item of recalculatedItems) {
      const itemParams = [
        billId,
        item.product_id || null,
        item.product_name || '',
        item.description || '',
        Number(item.quantity) || 0,
        Number(item.actual_unit_price) || 0, // Using actual_unit_price (tax exclusive)
        Number(item.total_price) || 0,
      ];

      await conn.execute(
        `INSERT INTO bill_items 
          (bill_id, product_id, product_name, description, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        itemParams
      );
    }

    // --- LOGIC FOR BILL PAYMENTS (EXPENSE CREATION) ---
    // Only if marked as paid
    if (mark_as_paid) {
      // Use current date if bill_date is not provided for payment
      const paymentDate = bill_date || new Date().toISOString().split('T')[0];

      // Create Payment Record (Expense)
      let paymentMethodName = 'Unknown';
      if (payment_method) {
        const [pmRows] = await conn.query('SELECT name FROM payment_methods WHERE id = ?', [payment_method]);
        if (pmRows.length > 0) paymentMethodName = pmRows[0].name;
      }

      await conn.execute(
        `INSERT INTO bill_payments (bill_id, vendor_id, company_id, payment_amount, payment_date, payment_method, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [billId, vendor_id, company_id, calculatedTotal, paymentDate, paymentMethodName, 'Auto-paid on Bill Creation']
      );

      // Increase Vendor Balance (Liability) then Decrease (Payment)
      await conn.execute('UPDATE vendor SET balance = balance + ? WHERE vendor_id = ?', [calculatedTotal, vendor_id]);
      await conn.execute('UPDATE vendor SET balance = balance - ? WHERE vendor_id = ?', [calculatedTotal, vendor_id]);

      // Effect: Balance unchanged.
    } else {
      // If OPEN bill, only Increase Vendor Balance
      await conn.execute('UPDATE vendor SET balance = balance + ? WHERE vendor_id = ?', [calculatedTotal, vendor_id]);
    }

    // --- STOCK UPDATE LOGIC (Moved from Order to Bill) ---
    // 1. Update Product Inventory
    for (const item of recalculatedItems) {
      if (item.product_id) {
        // NEW LOGIC: Calculate Cost Price WITH Tax
        // total_price includes tax. quantity is the number of items.
        // cost_price = total_price / quantity
        const qty = Number(item.quantity) || 1; // Avoid division by zero
        const costPriceWithTax = Number((Number(item.total_price) / qty).toFixed(4));

        await conn.execute(
          'UPDATE products SET quantity_on_hand = quantity_on_hand + ?, cost_price = ? WHERE id = ? AND company_id = ?',
          [Number(item.quantity) || 0, costPriceWithTax, item.product_id, company_id]
        );
      }
    }

    // 2. Create System Order for FIFO Tracking
    const stockOrderNo = `BILL-STK-${billId}-${Date.now()}`;
    const orderDate = bill_date || new Date().toISOString().split('T')[0]; // Use current date if bill_date not provided
    const [stockOrderResult] = await conn.execute(
      `INSERT INTO orders (
            company_id, vendor_id, order_no, order_date, total_amount, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        company_id,
        vendor_id || null, // Associate with vendor if available
        stockOrderNo,
        orderDate,
        calculatedTotal,
        'closed' // Automatically closed as stock is received
      ]
    );
    const stockOrderId = stockOrderResult.insertId;

    // 3. Create Order Items for FIFO
    for (const item of recalculatedItems) {
      if (item.product_id) {
        const qty = Number(item.quantity) || 0;
        const rate = Number(item.actual_unit_price) || 0;

        await conn.execute(
          `INSERT INTO order_items (
                    order_id, product_id, name, sku, description, qty, rate, amount, 
                    received, closed, remaining_qty, stock_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            stockOrderId,
            item.product_id,
            item.product_name || '',
            '', // sku not always available in bill item, strictly not needed for FIFO id
            `Stock from Bill #${finalBillNumber}`,
            qty,
            rate,
            Number(item.total_price) || 0,
            true, // received
            true, // closed
            qty, // remaining_qty starts at full qty
            'in_stock' // This enables FIFO usage
          ]
        );
      }
    }

    await conn.commit();
    res.status(201).json({ message: "Bill created successfully", billId, billNumber: finalBillNumber });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("Error creating bill:", error);
    res.status(500).json({ error: error.message || "Failed to create bill" });
  } finally {
    if (conn) conn.release();
  }
};

const getAllBills = async (req, res) => {
  const { company_id } = req.params;

  try {
    const [bills] = await db.query(
      `SELECT b.*,
            pm.name AS payment_method,
            v.name AS vendor_name,
            o.order_no AS order_number,
            emp.name AS employee_name
            FROM bills b
            LEFT JOIN payment_methods pm ON b.payment_method_id = pm.id
            LEFT JOIN vendor v ON b.vendor_id = v.vendor_id
            LEFT JOIN orders o ON b.order_id = o.id
            LEFT JOIN employees emp ON b.employee_id = emp.id
            WHERE b.company_id = ?
            ORDER BY b.created_at DESC`,
      [company_id]
    );

    // Format dates to prevent timezone issues
    const formattedBills = bills.map(bill => ({
      ...bill,
      bill_date: bill.bill_date ? bill.bill_date : null,
      due_date: bill.due_date ? bill.due_date : null,
      created_at: bill.created_at
    }));

    console.log(`Formatted bills for company_id ${company_id}:`, formattedBills);

    res.json(formattedBills);
  } catch (error) {
    console.error('Error fetching bills:', error);
    res.status(500).json({ error: "Failed to fetch bills" });
  }
};

const getBillItemsById = async (req, res) => {
  const { company_id, bill_id } = req.params;

  try {
    const [bill] = await db.query(
      `SELECT * FROM bills WHERE company_id = ? AND id = ?`,
      [company_id, bill_id]
    );

    if (bill.length === 0) {
      return res.status(404).json({ error: "Bill not found" });
    }

    const [items] = await db.query(
      `SELECT * FROM bill_items WHERE bill_id = ?`,
      [bill_id]
    );

    console.log(`Fetched items for bill_id ${bill_id} of company_id ${company_id}:`, items);

    res.json(items);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch bill" });
  }
}

const updateBill = async (req, res) => {
  const { company_id, bill_id } = req.params;

  console.log("Received updateBill request for company_id:", company_id, "bill_id:", bill_id);
  console.log("Updating bill with data:", req.body);

  const {
    vendor_id,
    order_id,
    payment_method_id,
    employee_id,
    due_date,
    notes,
    items,
  } = req.body;

  const conn = await db.getConnection();
  await conn.beginTransaction();

  try {
    // 1. Fetch Existing Bill & Items
    const [existingBill] = await conn.query(
      `SELECT * FROM bills WHERE id = ? AND company_id = ?`,
      [bill_id, company_id]
    );

    if (existingBill.length === 0) {
      throw new Error("Bill not found");
    }

    const currentBill = existingBill[0];
    const [existingItems] = await conn.query(
      `SELECT * FROM bill_items WHERE bill_id = ?`,
      [bill_id]
    );

    // 2. Revert Stock for Existing Items (Decrease Stock)
    for (const item of existingItems) {
      if (item.product_id) {
        await conn.execute(
          'UPDATE products SET quantity_on_hand = quantity_on_hand - ? WHERE id = ? AND company_id = ?',
          [Number(item.quantity) || 0, item.product_id, company_id]
        );
      }
    }

    // 3. Recalculate New Totals from Incoming Items
    const recalculatedItems = items.map(item => {
      const quantity = Number(item.quantity) || 0;
      const costPrice = Number(item.cost_price) || Number(item.unit_price) || 0;
      const taxRate = Number(item.tax_rate) || 0;

      const actualUnitPrice = Number(costPrice.toFixed(4));
      const subtotal = actualUnitPrice * quantity;
      const taxAmount = Number((subtotal * (taxRate / 100)).toFixed(2));
      const totalPrice = Number((subtotal + taxAmount).toFixed(2));

      return {
        ...item,
        actual_unit_price: actualUnitPrice,
        unit_price: actualUnitPrice,
        tax_amount: taxAmount,
        total_price: totalPrice
      };
    });

    const calculatedTotal = Number(recalculatedItems.reduce((sum, item) => sum + Number(item.total_price || 0), 0).toFixed(2));

    // 4. Calculate New Balance Due
    const existingPaidAmount = Number(currentBill.paid_amount) || 0;
    const newBalanceDue = Number((calculatedTotal - existingPaidAmount).toFixed(2));

    // Determine status based on new totals
    let newStatus = currentBill.status;
    if (newStatus !== 'proforma' && newStatus !== 'cancelled') {
      if (newBalanceDue <= 0 && calculatedTotal > 0) {
        newStatus = 'paid';
      } else if (existingPaidAmount > 0 && existingPaidAmount < calculatedTotal) {
        newStatus = 'partially_paid';
      } else {
        newStatus = 'opened';
      }
    }

    // 5. Update Bill Record
    const updateParams = [
      order_id || null,
      vendor_id || null,
      employee_id || null,
      due_date || null,
      payment_method_id || null,
      notes || null,
      calculatedTotal,
      newBalanceDue,
      newStatus,
      bill_id,
      company_id,
    ];

    await conn.execute(
      `UPDATE bills 
       SET order_id=?, vendor_id=?, employee_id=?, due_date=?, payment_method_id=?, notes=?, total_amount=?, balance_due=?, status=?
       WHERE id=? AND company_id=?`,
      updateParams
    );

    // 6. Replace Items (Delete Old -> Insert New)
    await conn.execute(`DELETE FROM bill_items WHERE bill_id=?`, [bill_id]);

    for (const item of recalculatedItems) {
      const itemParams = [
        bill_id,
        item.product_id || null,
        item.product_name || '',
        item.description || '',
        Number(item.quantity) || 0,
        Number(item.actual_unit_price) || 0,
        Number(item.total_price) || 0,
      ];

      await conn.execute(
        `INSERT INTO bill_items 
          (bill_id, product_id, product_name, description, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        itemParams
      );
    }

    // 7. Apply Stock for New Items (Increase Stock) & Update Cost Price
    for (const item of recalculatedItems) {
      if (item.product_id) {
        // NEW LOGIC: Calculate Cost Price WITH Tax
        // total_price includes tax. quantity is the number of items.
        // cost_price = total_price / quantity
        const qty = Number(item.quantity) || 1; // Avoid division by zero
        const costPriceWithTax = Number((Number(item.total_price) / qty).toFixed(4));

        await conn.execute(
          'UPDATE products SET quantity_on_hand = quantity_on_hand + ?, cost_price = ? WHERE id = ? AND company_id = ?',
          [Number(item.quantity) || 0, costPriceWithTax, item.product_id, company_id]
        );
      }
    }

    // 8. Update Stock Order (FIFO Tracking)
    const [stockOrders] = await conn.query(
      `SELECT id FROM orders WHERE order_no LIKE ? AND company_id = ?`,
      [`BILL-STK-${bill_id}-%`, company_id]
    );

    if (stockOrders.length > 0) {
      const stockOrderId = stockOrders[0].id;

      await conn.execute(
        `UPDATE orders SET total_amount = ? WHERE id = ?`,
        [calculatedTotal, stockOrderId]
      );

      await conn.execute(`DELETE FROM order_items WHERE order_id=?`, [stockOrderId]);

      for (const item of recalculatedItems) {
        if (item.product_id) {
          const qty = Number(item.quantity) || 0;
          const rate = Number(item.actual_unit_price) || 0;

          await conn.execute(
            `INSERT INTO order_items (
                            order_id, product_id, name, sku, description, qty, rate, amount, 
                            received, closed, remaining_qty, stock_status
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              stockOrderId,
              item.product_id,
              item.product_name || '',
              '',
              `Stock from Bill #${currentBill.bill_number} (Edited)`,
              qty,
              rate,
              Number(item.total_price) || 0,
              true, // received
              true, // closed
              qty,
              'in_stock'
            ]
          );
        }
      }
    }

    await conn.commit();
    res.json({ message: "Bill updated successfully" });
  } catch (error) {
    if (conn) await conn.rollback();
    console.error("Error updating bill:", error);
    res.status(500).json({ error: "Failed to update bill" });
  } finally {
    if (conn) conn.release();
  }
};

const getBillsByVendor = async (req, res) => {
  const { vendor_id, company_id } = req.params;

  if (!vendor_id || !company_id) {
    return res.status(400).json({ error: "Vendor ID and Company ID are required" });
  }

  try {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const query = `SELECT b.* 
            FROM bills b
            WHERE b.vendor_id = ? AND b.company_id = ?
            ORDER BY b.created_at DESC`;

      const [bills] = await connection.query(query, [vendor_id, company_id]);

      if (bills.length === 0) {
        await connection.commit();
        return res.status(404).json({ message: "No bills found for this vendor" });
      }

      const currentDate = new Date();
      for (const bill of bills) {
        // Only process overdue check if due_date exists
        if (bill.due_date) {
          const dueDate = new Date(bill.due_date);

          // Only update status to overdue if NOT proforma
          if (
            bill.status !== 'proforma' &&
            dueDate < currentDate &&
            bill.status !== 'paid' &&
            bill.status !== 'cancelled' &&
            bill.balance_due > 0
          ) {
            await connection.query(
              `UPDATE bills 
              SET status = 'overdue', updated_at = ?
              WHERE id = ? AND company_id = ?`,
              [new Date(), bill.id, company_id]
            );
            bill.status = 'overdue';
          }
        }

        const [items] = await connection.query(
          `SELECT * FROM bill_items WHERE bill_id = ?`,
          [bill.id]
        );
        bill.items = items;
      }

      await connection.commit();
      res.status(200).json(bills);
    } catch (error) {
      await connection.rollback();
      console.error('Error processing bills by vendor:', error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching bills by vendor:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const recordPayment = async (req, res) => {
  const { vendor_id, company_id } = req.params;
  const { payment_amount, payment_date, payment_method, deposit_to, notes, bill_payments } = req.body;

  if (!vendor_id || !company_id) {
    return res.status(400).json({ error: "Vendor ID and Company ID are required" });
  }

  if (!payment_amount || payment_amount <= 0) {
    return res.status(400).json({ error: "Valid payment amount is required" });
  }

  if (!payment_date) {
    return res.status(400).json({ error: "Payment date is required" });
  }

  if (!payment_method) {
    return res.status(400).json({ error: "Payment method is required" });
  }

  if (!bill_payments || !Array.isArray(bill_payments) || bill_payments.length === 0) {
    return res.status(400).json({ error: "Bill payment distribution is required" });
  }

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const totalBillPayments = bill_payments.reduce((sum, { payment_amount }) => sum + Number(payment_amount), 0);
    if (Math.abs(totalBillPayments - payment_amount) > 0.01) {
      await connection.rollback();
      return res.status(400).json({ error: "Sum of bill payments does not match total payment amount" });
    }

    const currentDate = new Date();

    for (const billPayment of bill_payments) {
      const { bill_id, payment_amount: billPaymentAmount } = billPayment;

      if (!bill_id || billPaymentAmount <= 0) {
        await connection.rollback();
        return res.status(400).json({ error: "Invalid bill ID or payment amount" });
      }

      const [bill] = await connection.query(
        `SELECT total_amount, paid_amount, due_date, status 
          FROM bills 
          WHERE id = ? AND company_id = ? AND vendor_id = ?`,
        [bill_id, company_id, vendor_id]
      );

      if (bill.length === 0) {
        await connection.rollback();
        return res.status(404).json({ error: `Bill ${bill_id} not found` });
      }

      const newPaidAmount = (Number(bill[0].paid_amount) || 0) + Number(billPaymentAmount);
      const totalAmount = Number(bill[0].total_amount) || 0;
      const balanceDue = totalAmount - newPaidAmount;
      let status = bill[0].status;

      // Only update status if the invoice is NOT proforma
      if (status !== 'proforma') {
        status = 'opened';

        if (newPaidAmount >= totalAmount) {
          status = 'paid';
        } else if (newPaidAmount > 0) {
          status = 'partially_paid';
        }

        // Check overdue status only if due_date exists
        if (bill[0].due_date) {
          const dueDate = new Date(bill[0].due_date);
          if (
            status !== 'paid' &&
            dueDate < currentDate &&
            balanceDue > 0 &&
            status !== 'cancelled'
          ) {
            status = 'overdue';
          }
        }
      }

      // Insert payment
      await connection.query(
        `INSERT INTO bill_payments (bill_id, vendor_id, company_id, payment_amount, payment_date, payment_method, deposit_to, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [bill_id, vendor_id, company_id, billPaymentAmount, payment_date, payment_method, deposit_to, notes || null]
      );

      // Update vendor balance
      await connection.query(
        `UPDATE vendor
          SET balance = balance - ?
          WHERE vendor_id = ? AND company_id = ?`,
        [billPaymentAmount, vendor_id, company_id]
      );

      // Update bill
      await connection.query(
        `UPDATE bills
          SET paid_amount = ?, 
              balance_due = ?, 
              status = ?, 
              updated_at = ?
          WHERE id = ? AND company_id = ?`,
        [newPaidAmount, balanceDue, status, new Date(), bill_id, company_id]
      );
    }

    await connection.commit();
    res.status(200).json({ message: 'Bill Payment recorded successfully' });
  } catch (error) {
    await connection.rollback();
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
};

module.exports = {
  createBill,
  getAllBills,
  getBillItemsById,
  updateBill,
  getBillsByVendor,
  recordPayment
};