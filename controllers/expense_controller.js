const db = require('../DB/db');

const createExpense = async (req, res) => {
  const { company_id, expense_number, payment_account_id, payment_date, payment_method, payee_id, notes, total_amount, items } = req.body;

  console.log('Creating expense:', req.body);

  // Validate required fields
  if (!company_id || !expense_number || !payment_date || !total_amount || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Company ID, expense number, payment date, total amount, and at least one item are required.' });
  }

  let connection;
  try {
    // Start a transaction - use dedicated connection
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Insert expense
    const expenseQuery = `
      INSERT INTO expenses (company_id, expense_number, payment_account_id, payment_date, payment_method_id, payee_id, notes, amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [expenseResult] = await connection.execute(expenseQuery, [
      company_id,
      expense_number.trim(),
      payment_account_id || null,
      payment_date,
      payment_method || null,
      payee_id || null,
      notes || null,
      total_amount
    ]);

    const expenseId = expenseResult.insertId;

    // Insert expense items
    const itemQuery = `
      INSERT INTO expense_items (expense_id, category_id, description, amount)
      VALUES (?, ?, ?, ?)
    `;
    for (const item of items) {
      if (!item.category_id || item.category_id === 0 || !item.amount || item.amount <= 0) {
        throw new Error('Each item must have a valid category and amount greater than 0.');
      }
      await connection.execute(itemQuery, [
        expenseId,
        item.category_id,
        item.description || null,
        item.amount
      ]);
    }

    // Commit transaction
    await connection.commit();

    res.status(201).json({
      message: 'Expense created successfully.',
      expenseId,
      expense_number: expense_number.trim(),
      total_amount
    });
  } catch (error) {
    // Rollback transaction
    if (connection) await connection.rollback();
    console.error('Error creating expense:', error);
    res.status(500).json({ error: error.message || 'Failed to create expense.' });
  } finally {
    if (connection) connection.release();
  }
};

const getExpenses = async (req, res) => {
  const { company_id } = req.params;

  console.log('Fetching expenses for company ID:', company_id);

  if (!company_id) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  try {
    const expenseQuery = `
      SELECT e.*
      FROM expenses e
      WHERE e.company_id = ?
      ORDER BY e.payment_date DESC, e.id DESC
    `;
    const [expenses] = await db.execute(expenseQuery, [company_id]);

    const itemQuery = `
      SELECT ei.*
      FROM expense_items ei
      WHERE ei.expense_id = ?
    `;

    const expensesWithItems = await Promise.all(expenses.map(async (expense) => {
      const [items] = await db.execute(itemQuery, [expense.id]);
      return { ...expense, items };
    }));

    res.status(200).json(expensesWithItems);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ error: 'Failed to fetch expenses.' });
  }
};

const updateExpense = async (req, res) => {
  const { expense_id, company_id } = req.params;

  console.log('Updating expense:', { expense_id, company_id, body: req.body });

  try {
    const {
      expense_number,
      payment_account_id,
      payment_date,
      payment_method,
      payee_id,
      notes,
      total_amount,
      status,
      items
    } = req.body;

    // Validate required fields
    if (!company_id || !expense_id || !expense_number || !payment_date || !total_amount || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Company ID, expense ID, expense number, payment date, total amount, and at least one item are required.' });
    }

    const conn = await db.getConnection();
    await conn.beginTransaction();

    const updateExpenseQuery = `
      UPDATE expenses
      SET expense_number = ?, payment_account_id = ?, payment_date = ?, payment_method_id = ?, payee_id = ?, notes = ?, amount = ?, status = ?
      WHERE id = ? AND company_id = ?
    `;
    await conn.execute(updateExpenseQuery, [
      expense_number,
      payment_account_id || null,
      payment_date,
      payment_method || null,
      payee_id || null,
      notes || null,
      total_amount,
      status || null,
      expense_id,
      company_id
    ]);

    // Delete existing expense items
    const deleteItemsQuery = `
      DELETE FROM expense_items
      WHERE expense_id = ?
    `;
    await conn.execute(deleteItemsQuery, [expense_id]);

    // Insert updated expense items
    const insertItemQuery = `
      INSERT INTO expense_items (expense_id, category_id, description, amount)
      VALUES (?, ?, ?, ?)
    `;
    for (const item of items) {
      if (!item.category_id || item.category_id === 0 || !item.amount || item.amount <= 0) {
        throw new Error('Each item must have a valid category and amount greater than 0.');
      }
      await conn.execute(insertItemQuery, [
        expense_id,
        item.category_id,
        item.description || null,
        item.amount
      ]);
    }

    await conn.commit();
    res.status(200).json({ message: 'Expense updated successfully.' });
  } catch (error) {
    await conn.rollback();
    console.error('Error updating expense:', error);
    res.status(500).json({ error: 'Failed to update expense.' });
  } finally {
    conn.release();
  }
};

const deleteExpense = async (req, res) => {
  const { expense_id, company_id } = req.params;
  if (!company_id || !expense_id) {
    return res.status(400).json({ error: 'Company ID and Expense ID are required.' });
  }
  try {
    const deleteItemsQuery = 'DELETE FROM expense_items WHERE expense_id = ?';
    await db.execute(deleteItemsQuery, [expense_id]);
    const deleteExpenseQuery = 'DELETE FROM expenses WHERE id = ? AND company_id = ?';
    const [result] = await db.execute(deleteExpenseQuery, [expense_id, company_id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Expense not found or does not belong to the specified company.' });
    }
    res.status(200).json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ error: 'Failed to delete expense.' });
  }
};

const addPayee = async (req, res) => {
  const { name, company_id } = req.body;

  if (!name || name.trim() === '' || !company_id) {
    return res.status(400).json({ error: 'Payee name and company ID are required.' });
  }

  try {
    const query = 'INSERT INTO payees (name, company_id) VALUES (?, ?)';
    const [result] = await db.execute(query, [name.trim(), company_id]);

    res.status(201).json({
      message: 'Payee created successfully.',
      payeeId: result.insertId,
      name: name.trim()
    });
  } catch (error) {
    console.error('Error creating payee:', error);
    res.status(500).json({ error: 'Failed to create payee.' });
  }
};

const getPayees = async (req, res) => {
  const { company_id } = req.params;

  if (!company_id) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  try {
    const query = 'SELECT * FROM payees WHERE company_id = ?';
    const [payees] = await db.execute(query, [company_id]);

    res.status(200).json(payees);
  } catch (error) {
    console.error('Error fetching payees:', error);
    res.status(500).json({ error: 'Failed to fetch payees.' });
  }
};

const addCategory = async (req, res) => {
  const { company_id } = req.params;
  const { name } = req.body;
  console.log('Received data:', { name, company_id });

  if (!name || name.trim() === '' || !company_id) {
    return res.status(400).json({ error: 'Category name and company ID are required.' });
  }

  try {
    const query = 'INSERT INTO expense_categories (category_name, company_id) VALUES (?, ?)';
    const [result] = await db.execute(query, [name.trim(), company_id]);

    res.status(201).json({
      message: 'Category created successfully.',
      id: result.insertId,
      category_name: name.trim()
    });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Failed to create category.' });
  }
};

const getExpenseCategories = async (req, res) => {
  const { company_id } = req.params;

  console.log('Fetching categories for company ID:', company_id);

  if (!company_id) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  try {
    const query = 'SELECT * FROM expense_categories WHERE company_id = ?';
    const [categories] = await db.execute(query, [company_id]);

    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
};

const addPaymentAccount = async (req, res) => {
  const { company_id } = req.params;

  const { name, account_type, detail_type, description } = req.body;

  console.log('Received data:', req.body);

  // if (!name || name.trim() === '' || !company_id) {
  //   return res.status(400).json({ error: 'Payment account name and company ID are required.' });
  // }

  console.log('Creating payment account with:', { name, account_type, detail_type, company_id, description });

  try {
    const query = 'INSERT INTO payment_account (payment_account_name, account_type_id, detail_type_id, company_id, description) VALUES (?, ?, ?, ?, ?)';
    const [result] = await db.execute(query, [name, account_type, detail_type, company_id, description]);

    console.log('Insert result:', result);

    res.status(201).json({
      id: result.insertId,
      name: name?.trim(),
      message: "Payment account created successfully.",
    });
  } catch (error) {
    console.error('Error creating payment account:', error);
    res.status(500).json({ error: 'Failed to create payment account.' });
  }
};

const getPaymentAccounts = async (req, res) => {
  const { company_id } = req.params;

  if (!company_id) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  try {
    const query = 'SELECT * FROM payment_account WHERE company_id = ?';
    const [paymentAccounts] = await db.execute(query, [company_id]);

    res.status(200).json(paymentAccounts);
  } catch (error) {
    console.error('Error fetching payment accounts:', error);
    res.status(500).json({ error: 'Failed to fetch payment accounts.' });
  }
};

const addPaymentAccountType = async (req, res) => {
  const { company_id } = req.params;
  const { account_type, details } = req.body;

  console.log('Received data:', { company_id, account_type, details });

  if (!company_id || !account_type || !details || !Array.isArray(details) || details.length === 0) {
    return res.status(400).json({ error: 'Company ID, account type, and at least one detail are required.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Insert into account_type table
    const typeQuery = `
      INSERT INTO account_type (company_id, account_type_name) 
      VALUES (?, ?)
    `;
    const [typeResult] = await connection.execute(typeQuery, [company_id, account_type.trim()]);
    const accountTypeId = typeResult.insertId;

    // Insert details into detail_type table
    const detailQuery = `
      INSERT INTO detail_type (account_type_id, detail_type_name) 
      VALUES (?, ?)
    `;
    for (const detail of details) {
      if (!detail || detail.trim() === '') {
        throw new Error('Each detail must be a non-empty string.');
      }
      await connection.execute(detailQuery, [accountTypeId, detail.trim()]);
    }

    // ✅ Use query for transaction control
    await connection.commit();

    res.status(201).json({
      message: 'Payment account type and details created successfully.',
      accountTypeId,
      account_type: account_type.trim(),
      details
    });
  } catch (err) {
    // Rollback on error
    if (connection) await connection.rollback();
    console.error('Error creating payment account type:', err);
    res.status(500).json({ error: 'Failed to create payment account type.' });
  } finally {
    if (connection) connection.release();
  }
};

const getPaymentAccountTypes = async (req, res) => {
  const { company_id } = req.params;

  if (!company_id) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  try {
    const typeQuery = `
      SELECT * FROM account_type WHERE company_id = ?
    `;
    const [types] = await db.execute(typeQuery, [company_id]);

    if (types.length === 0) {
      return res.status(200).json([]);
    }

    return res.status(200).json(types);

  } catch (error) {
    console.error('Error fetching payment account types:', error);
    res.status(500).json({ error: 'Failed to fetch payment account types.' });
  }
};

const getDetailTypesByAccountTypeId = async (req, res) => {
  const { account_type_id } = req.params;

  if (!account_type_id) {
    return res.status(400).json({ error: 'Account Type ID is required.' });
  }

  try {
    const detailQuery = `
      SELECT * 
      FROM detail_type WHERE account_type_id = ?
    `;
    const [details] = await db.execute(detailQuery, [account_type_id]);

    return res.status(200).json(details);
  } catch (error) {
    console.error('Error fetching detail types:', error);
    res.status(500).json({ error: 'Failed to fetch detail types.' });
  }
};

module.exports = {
  createExpense,
  getExpenses,
  updateExpense,
  deleteExpense,
  addPayee,
  getPayees,
  addCategory,
  getExpenseCategories,
  addPaymentAccount,
  getPaymentAccounts,
  addPaymentAccountType,
  getPaymentAccountTypes,
  getDetailTypesByAccountTypeId
};