const db = require("../DB/db");
const jwt = require('jsonwebtoken');

const createCompany = async (req, res) => {
    try {
        const {
            companyName,
            isTaxable,
            taxNumber,
            companyAddress,
            companyPhone,
            companyEmail,
            companyRegistrationNumber,
            notes,
            termsAndConditions,
            taxRates,
            openingBalance
        } = req.body;
        const companyLogo = req.file ? `/uploads/${req.file.filename}` : null;

        console.log('Create company request received:', req.body);
        console.log('File received:', req.file);

        // Validate required fields
        if (!companyName || !companyRegistrationNumber) {
            return res.status(400).json({
                success: false,
                message: 'Company name and registration number are required'
            });
        }

        // Check if company already exists
        const [existingCompany] = await db.query(
            'SELECT * FROM company WHERE registration_number = ?',
            [companyRegistrationNumber]
        );

        if (existingCompany.length > 0) {
            return res.status(400).json({ success: false, message: 'Company with this registration number already exists.' });
        }

        let connection;
        try {
            // Start transaction
            connection = await db.getConnection();
            await connection.beginTransaction();

            // Insert new company
            const [result] = await connection.query(
                'INSERT INTO company (name, is_taxable, tax_number, company_logo, address, contact_number, email_address, registration_number, terms_and_conditions, notes, opening_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    companyName,
                    isTaxable === 'Taxable' ? 1 : 0,
                    isTaxable === 'Taxable' ? taxNumber : null,
                    companyLogo,
                    companyAddress || '',
                    companyPhone || '',
                    companyEmail || null,
                    companyRegistrationNumber,
                    termsAndConditions || null,
                    notes || null,
                    openingBalance || 0
                ]
            );

            if (result.affectedRows === 0) {
                throw new Error('Failed to create company');
            }

            const companyId = result.insertId;

            // Insert tax rates if company is taxable
            if (isTaxable === 'Taxable' && taxRates) {
                let parsedTaxRates;
                try {
                    parsedTaxRates = JSON.parse(taxRates);
                } catch (parseError) {
                    console.error('Error parsing tax rates:', parseError);
                    parsedTaxRates = [];
                }

                for (const taxRate of parsedTaxRates) {
                    if (taxRate.name && taxRate.rate > 0) {
                        await connection.query(
                            'INSERT INTO tax_rates (company_id, name, rate, is_default) VALUES (?, ?, ?, ?)',
                            [companyId, taxRate.name, taxRate.rate, taxRate.is_default || false]
                        );
                    }
                }
            }

            // Commit transaction
            await connection.commit();

            console.log('New company created:', result);

            // Return company data along with token
            const companyData = {
                id: companyId,
                name: companyName,
                is_taxable: isTaxable === 'Taxable' ? 1 : 0,
                tax_number: isTaxable === 'Taxable' ? taxNumber : null,
                logo: companyLogo,
                address: companyAddress || '',
                phone: companyPhone || '',
                email: companyEmail || null,
                registration_number: companyRegistrationNumber,
                terms_and_conditions: termsAndConditions || null,
                notes: notes || null,
                opening_balance: openingBalance || 0
            };

            return res.status(201).json({
                success: true,
                message: 'Company created successfully',
                company: companyData
            });

        } catch (error) {
            // Rollback transaction on error
            if (connection) await connection.rollback();
            console.error('Transaction error:', error);
            throw error;
        } finally {
            if (connection) connection.release();
        }

    } catch (error) {
        console.error('Error creating company:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

const getCompanies = async (req, res) => {
    try {
        console.log('Get companies request received');

        // Use req.userId from verifyToken middleware
        const userId = req.userId;

        // Check if user is fixed to a company
        const [user] = await db.query('SELECT is_fixed_to_company, fixed_company_id FROM user WHERE user_id = ?', [userId]);

        let companies;
        if (user.length > 0 && user[0].is_fixed_to_company) {
            // If user is fixed, only return that company
            console.log(`User ${userId} is fixed to company ${user[0].fixed_company_id}`);
            [companies] = await db.query('SELECT * FROM company WHERE company_id = ?', [user[0].fixed_company_id]);
        } else {
            // Otherwise return all companies
            [companies] = await db.query('SELECT * FROM company');
        }

        console.log('Companies fetched:', companies);
        return res.status(200).json(companies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getDashboardData = async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log('Get dashboard data for companyId:', companyId);

        // Get basic metrics
        const [cheques] = await db.query(`SELECT COUNT(*) as count FROM cheques WHERE company_id = ? AND status = "pending" AND (cheque_date < CURDATE() OR cheque_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 3 DAY))`, [companyId]);
        const [products] = await db.query('SELECT COUNT(*) as count FROM products WHERE company_id = ? AND quantity_on_hand <= reorder_level', [companyId]);
        const [overdue] = await db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = ? AND status = "overdue"', [companyId]);
        const [revenue] = await db.query('SELECT COALESCE(SUM(total_amount), 0) as total FROM invoices WHERE company_id = ? AND status != "proforma"', [companyId]);

        // Get recent invoices
        const [recentInvoices] = await db.query(`
            SELECT 
                i.id,
                i.invoice_number,
                i.total_amount,
                i.created_at,
                c.name as customer_name
            FROM invoices i
            LEFT JOIN customer c ON i.customer_id = c.id
            WHERE i.company_id = ?
            ORDER BY i.created_at DESC
            LIMIT 5
        `, [companyId]);

        const dashboardData = {
            metrics: {
                nearDueCheques: cheques[0]?.count || 0,
                products: products[0]?.count || 0,
                overdue: overdue[0]?.total || 0,
                totalRevenue: revenue[0]?.total || 0
            },
            recentInvoices: recentInvoices || []
        };

        console.log('Dashboard data:', dashboardData);
        return res.status(200).json(dashboardData);

    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Return empty data instead of error to prevent dashboard from breaking
        return res.status(200).json({
            metrics: {
                cheques: 0,
                products: 0,
                invoices: 0,
                totalRevenue: 0
            },
            recentInvoices: []
        });
    }
};

const selectCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log('Select company request received for companyId:', companyId);

        const [company] = await db.query(
            'SELECT * FROM company WHERE company_id = ?',
            [companyId]
        );

        if (company.length === 0) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        return res.status(200).json({ success: true, message: 'Company selected successfully' });
    } catch (error) {
        console.error('Error selecting company:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getCompanyById = async (req, res) => {
    try {
        const { companyId } = req.params;
        const [company] = await db.query('SELECT * FROM company WHERE company_id = ?', [companyId]);

        if (company.length === 0) {
            return res.status(404).json({ message: 'Company not found' });
        }

        return res.status(200).json(company[0]);
    } catch (error) {
        console.error('Error getting company by ID:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const updateCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const updates = req.body;
        const companyLogo = req.file ? `/uploads/${req.file.filename}` : null;

        console.log('Update company request received for companyId:', companyId, 'with updates:', updates);

        if (Object.keys(updates).length === 0 && !companyLogo) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const allowedFields = [
            'name', 'is_taxable', 'tax_number', 'company_logo',
            'address', 'contact_number', 'email_address',
            'registration_number', 'terms_and_conditions', 'notes', 'opening_balance',
            'invoice_prefix', 'current_invoice_number', 'current_estimate_number',
            'invoice_separators'
        ];

        const fieldsToUpdate = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                fieldsToUpdate[key] = updates[key];
            }
        }

        if (companyLogo) {
            fieldsToUpdate.company_logo = companyLogo;
        }

        // Check if company exists
        const [existingCompanyData] = await db.query(
            'SELECT * FROM company WHERE company_id = ?',
            [companyId]
        );

        if (existingCompanyData.length === 0) {
            return res.status(404).json({ success: false, message: 'Company not found for update' });
        }

        let connection;
        try {
            // Start transaction
            connection = await db.getConnection();
            await connection.beginTransaction();

            // Handle taxable status
            if (fieldsToUpdate.is_taxable) {
                fieldsToUpdate.is_taxable = fieldsToUpdate.is_taxable === 'Taxable' ? 1 : 0;

                // If changing to non-taxable, clear tax number and delete existing tax rates
                if (fieldsToUpdate.is_taxable === 0) {
                    fieldsToUpdate.tax_number = null;
                    await connection.query('DELETE FROM tax_rates WHERE company_id = ?', [companyId]);
                    console.log(`Deleted tax rates for company: ${companyId}`);
                } else if (fieldsToUpdate.is_taxable === 1 && updates.tax_rates) {
                    // If changing to taxable and tax rates are provided, insert them
                    let parsedTaxRates = [];
                    try {
                        parsedTaxRates = Array.isArray(updates.tax_rates)
                            ? updates.tax_rates
                            : JSON.parse(updates.tax_rates);
                    } catch (err) {
                        console.error('Failed to parse tax rates:', err);
                    }

                    // Delete existing tax rates before inserting new ones
                    await connection.query('DELETE FROM tax_rates WHERE company_id = ?', [companyId]);
                    console.log(`Cleared existing tax rates for company: ${companyId}`);

                    for (const taxRate of parsedTaxRates) {
                        if (taxRate.name && taxRate.rate > 0) {
                            await connection.query(
                                'INSERT INTO tax_rates (company_id, name, rate, is_default) VALUES (?, ?, ?, ?)',
                                [companyId, taxRate.name, taxRate.rate, taxRate.is_default || false]
                            );
                        }
                    }
                    console.log(`Inserted ${parsedTaxRates.length} tax rates for company: ${companyId}`);
                }
            }

            // Check for registration number conflicts
            if (fieldsToUpdate.registration_number) {
                const [conflict] = await connection.query(
                    'SELECT * FROM company WHERE registration_number = ? AND company_id != ?',
                    [fieldsToUpdate.registration_number, companyId]
                );

                if (conflict.length > 0) {
                    await connection.rollback();
                    return res.status(400).json({ success: false, message: 'Company with this registration number already exists' });
                }
            }

            const setClauses = [];
            const values = [];

            for (const key in fieldsToUpdate) {
                setClauses.push(`${key} = ?`);
                values.push(fieldsToUpdate[key]);
            }

            if (setClauses.length === 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'No valid fields to update' });
            }

            values.push(companyId);

            const updateQuery = `UPDATE company SET ${setClauses.join(', ')} WHERE company_id = ?`;
            const [result] = await connection.query(updateQuery, values);

            if (result.affectedRows === 0) {
                await connection.rollback();
                return res.status(400).json({ success: false, message: 'No changes made to the company' });
            }

            // Commit transaction
            await connection.commit();

            return res.status(200).json({
                success: true,
                message: 'Company updated successfully'
            });

        } catch (error) {
            // Rollback transaction on error
            if (connection) await connection.rollback();
            console.error('Transaction error during company update:', error);
            throw error;
        } finally {
            if (connection) connection.release();
        }

    } catch (error) {
        console.error('Error updating company:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        console.log('Delete company request received for companyId:', companyId);

        // Check if company exists
        const [existingCompany] = await db.query(
            'SELECT * FROM company WHERE company_id = ?',
            [companyId]
        );

        if (existingCompany.length === 0) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        let connection;
        try {
            // Start transaction
            connection = await db.getConnection();
            await connection.beginTransaction();

            // Delete related records in the correct order to avoid foreign key constraint errors

            // Delete tax rates first
            await connection.query('DELETE FROM tax_rates WHERE company_id = ?', [companyId]);
            console.log('Deleted tax rates for company:', companyId);

            // Delete customers (note: table name is 'customer' not 'customers')
            await connection.query('DELETE FROM customer WHERE company_id = ?', [companyId]);
            console.log('Deleted customers for company:', companyId);

            // Delete vendors
            await connection.query('DELETE FROM vendor WHERE company_id = ?', [companyId]);
            console.log('Deleted vendors for company:', companyId);

            // Delete the company
            const [result] = await connection.query('DELETE FROM company WHERE company_id = ?', [companyId]);

            if (result.affectedRows === 0) {
                throw new Error('Failed to delete company');
            }

            // Commit transaction
            await connection.commit();

            console.log('Company deleted:', companyId);
            return res.status(200).json({
                success: true,
                message: 'Company deleted successfully'
            });

        } catch (error) {
            // Rollback transaction on error
            if (connection) await connection.rollback();
            console.error('Transaction error during company deletion:', error);
            throw error;
        } finally {
            if (connection) connection.release();
        }

    } catch (error) {
        console.error('Error deleting company:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const getMoneyInDrawerByCompany = async (req, res) => {
    try {
        console.log('Get money in drawer by company request received');

        const { company_id } = req.params;
        const { start_date, end_date } = req.query;

        // Default to today if no dates provided
        const today = new Date().toISOString().split('T')[0];
        const startDate = start_date || today;
        const endDate = end_date || today;

        // Query to get total money received in date range from payments for specific company (cash only)
        const [paymentsResult] = await db.query(`
            SELECT COALESCE(SUM(payment_amount), 0) as total_received
            FROM payments
            WHERE DATE(payment_date) >= ? AND DATE(payment_date) <= ? 
            AND company_id = ? 
            AND LOWER(payment_method) = 'cash'
        `, [startDate, endDate, company_id]);

        // Query to get total money spent in date range from expenses for specific company (cash only)
        const [expensesResult] = await db.query(`
            SELECT COALESCE(SUM(e.amount), 0) as total_spent_expenses
            FROM expenses e
            JOIN payment_methods pm ON e.payment_method_id = pm.id
            WHERE DATE(e.updated_at) >= ? AND DATE(e.updated_at) <= ? 
            AND e.company_id = ? 
            AND e.status = 'paid'
            AND LOWER(pm.name) = 'cash'
        `, [startDate, endDate, company_id]);

        // Query to get total money spent in date range from bill payments for specific company (cash only)
        const [billPaymentsResult] = await db.query(`
            SELECT COALESCE(SUM(payment_amount), 0) as total_spent_bills
            FROM bill_payments
            WHERE DATE(payment_date) >= ? AND DATE(payment_date) <= ? 
            AND company_id = ?
            AND LOWER(payment_method) = 'cash'
        `, [startDate, endDate, company_id]);

        const totalReceived = parseFloat(paymentsResult[0].total_received) || 0;
        const totalSpentExpenses = parseFloat(expensesResult[0].total_spent_expenses) || 0;
        const totalSpentBillPayments = parseFloat(billPaymentsResult[0].total_spent_bills) || 0;
        const totalSpent = totalSpentExpenses + totalSpentBillPayments;
        const netAmount = totalReceived - totalSpent;

        const result = {
            company_id: company_id,
            start_date: startDate,
            end_date: endDate,
            total_received: totalReceived,
            total_spent: totalSpent,
            total_spent_expenses: totalSpentExpenses,
            total_spent_bill_payments: totalSpentBillPayments,
            net_amount: netAmount,
            money_in_drawer: netAmount,
            payment_method_filter: 'cash'
        };

        console.log('Money in drawer calculated for company (cash only):', result);

        return res.status(200).json({
            success: true,
            data: result
        });

    } catch (error) {
        console.error('Error calculating money in drawer by company:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getNextNumbers = async (req, res) => {
    try {
        const { companyId } = req.params;
        const [company] = await db.query(
            'SELECT invoice_prefix, current_invoice_number, current_estimate_number, invoice_separators FROM company WHERE company_id = ?',
            [companyId]
        );

        if (company.length === 0) {
            return res.status(404).json({ success: false, message: 'Company not found' });
        }

        const { invoice_prefix, current_invoice_number, current_estimate_number, invoice_separators } = company[0];

        // Format Logic
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const prefix = invoice_prefix || 'INV';
        const useSeparator = (invoice_separators !== 0 && invoice_separators !== false);
        const sep = useSeparator ? '-' : '';

        // Next Invoice
        const nextInvSeq = (current_invoice_number || 0) + 1;
        const nextInvoiceNumber = `${prefix}${sep}${yy}${sep}INV${sep}${nextInvSeq}`;

        // Next Estimate
        const nextEstSeq = (current_estimate_number || 0) + 1;
        // User requested sequence padded to 4 digits for estimate (0001)
        const nextEstSeqStr = String(nextEstSeq).padStart(4, '0');
        const nextEstimateNumber = `${prefix}${sep}${yy}${sep}EST${sep}${nextEstSeqStr}`;

        return res.status(200).json({
            success: true,
            invoice_prefix: prefix,
            next_invoice_number: nextInvoiceNumber,
            next_estimate_number: nextEstimateNumber,
            invoice_separators: useSeparator
        });

    } catch (error) {
        console.error('Error getting next numbers:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    createCompany,
    selectCompany,
    getCompanies,
    getDashboardData,
    updateCompany,
    deleteCompany,
    getMoneyInDrawerByCompany,
    getCompanyById,
    getNextNumbers
};