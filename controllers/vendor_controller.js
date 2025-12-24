const db = require("../DB/db");

const getVendors = async (req, res) => {
  try {
    const { company_id } = req.params;

    if (!company_id) {
      return res.status(400).json({ success: false, message: "Company ID is required" });
    }

    const [vendors] = await db.query(
      "SELECT * FROM vendor WHERE company_id = ? AND is_active = 1 ORDER BY created_at DESC",
      [company_id]
    );

    return res.status(200).json(vendors);
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const createVendor = async (req, res) => {
  try {
    const { company_id } = req.params;
    const {
      name,
      company_name,
      email,
      phone,
      address,
      city,
      state,
      zip_code,
      country,
      tax_number,
      fax_number,
      website,
      taxes, // this is actually default_expense_category
      expense_rates,
      terms,
      account_number,
      balance,
      asOfDate, // mapped to as_of_date
      vehicle_number
    } = req.body;

    console.log("Creating vendor with data:", req.body);

    if (!company_id) {
      return res.status(400).json({ success: false, message: 'Company ID is required' });
    }

    if (!name || name.trim() === '') {
      return res.status(400).json({ success: false, message: 'Vendor name is required' });
    }

    // Validate numeric fields
    const parsedBalance = parseFloat(balance);
    const parsedRate = parseFloat(expense_rates);

    if (isNaN(parsedBalance) || isNaN(parsedRate)) {
      return res.status(400).json({ success: false, message: 'Invalid balance or billing rate' });
    }

    // Check for duplicate email
    if (email) {
      const [existingVendor] = await db.query(
        'SELECT * FROM vendor WHERE company_id = ? AND email = ? AND is_active = 1',
        [company_id, email]
      );

      if (existingVendor.length > 0) {
        return res.status(400).json({ success: false, message: 'Vendor with this email already exists' });
      }
    }

    // Insert vendor
    const [result] = await db.query(
      `INSERT INTO vendor (
        company_id, name, vendor_company_name, email, phone, address, 
        city, state, zip_code, country, tax_number, fax_number, 
        website, terms, account_number, balance, as_of_date, vehicle_number,
        billing_rate, default_expense_category, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        company_id, name, company_name || null, email || null, phone || null,
        address || null, city || null, state || null, zip_code || null,
        country || null, tax_number || null, fax_number || null,
        website || null, terms || null, account_number || null,
        parsedBalance || 0, asOfDate || null, vehicle_number || null,
        parsedRate || 0, taxes || null, true
      ]
    );

    const vendorData = {
      vendor_id: result.insertId,
      company_id: parseInt(company_id),
      name,
      vendor_company_name: company_name || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      city: city || null,
      state: state || null,
      zip_code: zip_code || null,
      country: country || null,
      tax_number: tax_number || null,
      fax_number: fax_number || null,
      website: website || null,
      terms: terms || null,
      account_number: account_number || null,
      balance: parsedBalance || 0,
      as_of_date: asOfDate || null,
      vehicle_number: vehicle_number || null,
      billing_rate: parsedRate || 0,
      default_expense_category: taxes || null,
      is_active: true,
      created_at: new Date()
    };

    return res.status(201).json({
      success: true,
      message: 'Vendor created successfully',
      vendor: vendorData
    });

  } catch (error) {
    console.error('Error creating vendor:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


const updateVendor = async (req, res) => {
  try {
    const { company_id, vendor_id } = req.params;
    const updates = req.body;

    if (!company_id || !vendor_id) {
      return res.status(400).json({ success: false, message: 'Company ID and Vendor ID are required' });
    }

    // Check if vendor exists
    const [existingVendor] = await db.query(
      'SELECT * FROM vendor WHERE vendor_id = ? AND company_id = ? AND is_active = 1',
      [vendor_id, company_id]
    );

    if (existingVendor.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // Check for email conflicts
    if (updates.email) {
      const [emailConflict] = await db.query(
        'SELECT * FROM vendor WHERE company_id = ? AND email = ? AND vendor_id != ?',
        [company_id, updates.email, vendor_id]
      );

      if (emailConflict.length > 0) {
        return res.status(400).json({ success: false, message: 'Email already in use by another vendor' });
      }
    }

    const allowedFields = [
      'name', 'vendor_company_name', 'email', 'phone', 'address', 'city', 'state',
      'zip_code', 'country', 'tax_number', 'fax_number', 'website', 'terms',
      'account_number', 'balance', 'as_of_date', 'billing_rate',
      'default_expense_category', 'is_active'
    ];

    const fieldsToUpdate = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        if (key === 'company_name') {
          fieldsToUpdate['vendor_company_name'] = updates[key];
        } else if (key === 'expense_rates') {
          fieldsToUpdate['billing_rate'] = parseFloat(updates[key]) || 0;
        } else if (key === 'taxes') {
          fieldsToUpdate['default_expense_category'] = updates[key];
        } else if (key === 'asOfDate') {
          fieldsToUpdate['as_of_date'] = updates[key];
        } else {
          fieldsToUpdate[key] = updates[key];
        }
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    const setClauses = [];
    const values = [];

    for (const key in fieldsToUpdate) {
      setClauses.push(`${key} = ?`);
      values.push(fieldsToUpdate[key]);
    }

    values.push(vendor_id, company_id);

    const updateQuery = `UPDATE vendor SET ${setClauses.join(', ')} WHERE vendor_id = ? AND company_id = ?`;
    const [result] = await db.query(updateQuery, values);

    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'No changes made to the vendor' });
    }

    return res.status(200).json({
      success: true,
      message: 'Vendor updated successfully'
    });

  } catch (error) {
    console.error('Error updating vendor:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const deleteVendor = async (req, res) => {
  try {
    const { company_id, vendor_id } = req.params;

    if (!company_id || !vendor_id) {
      return res.status(400).json({ success: false, message: 'Company ID and Vendor ID are required' });
    }

    // Check if vendor exists
    const [existingVendor] = await db.query(
      'SELECT * FROM vendor WHERE vendor_id = ? AND company_id = ? AND is_active = 1',
      [vendor_id, company_id]
    );

    if (existingVendor.length === 0) {
      return res.status(404).json({ success: false, message: 'Vendor not found' });
    }

    // // Check if vendor has any expenses
    // const [expenseCount] = await db.query(
    //   'SELECT COUNT(*) as count FROM expenses WHERE vendor_id = ?',
    //   [vendor_id]
    // );

    // if (expenseCount[0]?.count > 0) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'Cannot delete vendor with existing expenses'
    //   });
    // }

    const [result] = await db.query(
      'UPDATE vendor SET is_active = 0 WHERE vendor_id = ? AND company_id = ?',
      [vendor_id, company_id]
    );

    if (result.affectedRows === 0) {
      return res.status(400).json({ success: false, message: 'Failed to delete vendor' });
    }

    return res.status(200).json({
      success: true,
      message: 'Vendor deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting vendor:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getVendors,
  createVendor,
  updateVendor,
  deleteVendor
};