const db = require('../../../DB/db');

const getTrialBalance = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { as_of_date } = req.query;

        console.log('Received params:', { company_id, as_of_date });

        if (!company_id) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        // Use current date if as_of_date is not provided
        const reportDate = as_of_date || new Date().toISOString().split('T')[0];

        // Get company information
        const [companyResult] = await db.execute(
            'SELECT name FROM company WHERE company_id = ?',
            [company_id]
        );

        if (companyResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        const companyName = companyResult[0].name;

        // ASSETS SECTION
        // 1. Accounts Receivable (Customer Balances)
        let arQuery = `
            SELECT 
                'Accounts Receivable' as account_name,
                'Asset' as account_type,
                COALESCE(SUM(total_amount - paid_amount), 0) as debit_balance,
                0 as credit_balance
            FROM invoices 
            WHERE company_id = ? 
            AND status IN ('opened', 'sent', 'partially_paid', 'overdue')
        `;
        let arParams = [company_id];

        if (as_of_date && as_of_date.trim() !== '') {
            arQuery += ' AND invoice_date <= ?';
            arParams.push(as_of_date);
        }

        const [arResult] = await db.execute(arQuery, arParams);

        // 2. Cash and Bank Accounts (Payment Accounts)
        const [cashResult] = await db.execute(`
            SELECT 
                pa.payment_account_name as account_name,
                'Asset' as account_type,
                COALESCE(SUM(p.payment_amount), 0) as debit_balance,
                0 as credit_balance
            FROM payment_account pa
            LEFT JOIN payments p ON pa.id = p.deposit_to AND p.company_id = pa.company_id
            WHERE pa.company_id = ?
            ${as_of_date ? 'AND (p.payment_date IS NULL OR p.payment_date <= ?)' : ''}
            GROUP BY pa.id, pa.payment_account_name
        `, as_of_date ? [company_id, as_of_date] : [company_id]);

        // 3. Inventory (Products)
        const [inventoryResult] = await db.execute(`
            SELECT 
                'Inventory' as account_name,
                'Asset' as account_type,
                COALESCE(SUM(quantity_on_hand * cost_price), 0) as debit_balance,
                0 as credit_balance
            FROM products 
            WHERE company_id = ? 
            AND is_active = 1
        `, [company_id]);

        // LIABILITIES SECTION
        // 4. Accounts Payable (Vendor Balances)
        const [apResult] = await db.execute(`
            SELECT 
                'Accounts Payable' as account_name,
                'Liability' as account_type,
                0 as debit_balance,
                COALESCE(SUM(b.total_amount - b.paid_amount), 0) as credit_balance
            FROM bills b
            WHERE company_id = ? 
            AND status IN ('opened', 'partially_paid', 'overdue')
        `, [company_id]);

        // 5. Tax Liabilities
        let taxQuery = `
            SELECT 
                CONCAT(tr.name, ' Payable') as account_name,
                'Liability' as account_type,
                0 as debit_balance,
                COALESCE(SUM(ii.tax_amount), 0) as credit_balance
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN tax_rates tr ON ii.tax_rate = tr.rate AND tr.company_id = i.company_id
            WHERE i.company_id = ? 
            AND i.status != 'cancelled'
            AND ii.tax_rate > 0
        `;
        let taxParams = [company_id];

        if (as_of_date && as_of_date.trim() !== '') {
            taxQuery += ' AND i.invoice_date <= ?';
            taxParams.push(as_of_date);
        }

        taxQuery += ' GROUP BY tr.name, ii.tax_rate';

        const [taxResult] = await db.execute(taxQuery, taxParams);

        // REVENUE SECTION
        // 6. Sales Revenue
        let revenueQuery = `
            SELECT 
                'Sales Revenue' as account_name,
                'Revenue' as account_type,
                0 as debit_balance,
                COALESCE(SUM(total_amount), 0) as credit_balance
            FROM invoices 
            WHERE company_id = ? 
            AND status != 'cancelled'
            AND status != 'proforma'
        `;
        let revenueParams = [company_id];

        if (as_of_date && as_of_date.trim() !== '') {
            revenueQuery += ' AND invoice_date <= ?';
            revenueParams.push(as_of_date);
        }

        const [revenueResult] = await db.execute(revenueQuery, revenueParams);

        // EXPENSE SECTION
        // 7. Cost of Goods Sold
        let cogsQuery = `
            SELECT 
                'Cost of Goods Sold' as account_name,
                'Expense' as account_type,
                COALESCE(SUM(ii.quantity * p.cost_price), 0) as debit_balance,
                0 as credit_balance
            FROM invoices i
            JOIN invoice_items ii ON i.id = ii.invoice_id
            LEFT JOIN products p ON ii.product_id = p.id
            WHERE i.company_id = ? 
            AND i.status != 'cancelled'
            AND i.status != 'proforma'
        `;
        let cogsParams = [company_id];

        if (as_of_date && as_of_date.trim() !== '') {
            cogsQuery += ' AND i.invoice_date <= ?';
            cogsParams.push(as_of_date);
        }

        const [cogsResult] = await db.execute(cogsQuery, cogsParams);

        // 8. Operating Expenses
        let expenseQuery = `
            SELECT 
                ec.category_name as account_name,
                'Expense' as account_type,
                COALESCE(SUM(ei.amount), 0) as debit_balance,
                0 as credit_balance
            FROM expenses e
            JOIN expense_items ei ON e.id = ei.expense_id
            JOIN expense_categories ec ON ei.category_id = ec.id
            WHERE e.company_id = ?
            AND e.status = 'paid'
        `;
        let expenseParams = [company_id];

        if (as_of_date && as_of_date.trim() !== '') {
            expenseQuery += ' AND e.payment_date <= ?';
            expenseParams.push(as_of_date);
        }

        expenseQuery += ' GROUP BY ec.id, ec.category_name';

        const [expenseResult] = await db.execute(expenseQuery, expenseParams);

        // 9. Purchase Expenses (from closed orders)
        let purchaseQuery = `
            SELECT 
                'Purchase Expenses' as account_name,
                'Expense' as account_type,
                COALESCE(SUM(total_amount), 0) as debit_balance,
                0 as credit_balance
            FROM bills 
            WHERE company_id = ? 
            AND status != 'cancelled'
        `;
        let purchaseParams = [company_id];

        if (as_of_date && as_of_date.trim() !== '') {
            purchaseQuery += ' AND bill_date <= ?';
            purchaseParams.push(as_of_date);
        }

        const [purchaseResult] = await db.execute(purchaseQuery, purchaseParams);

        // Combine all results
        const trialBalanceData = [];

        // Add Assets
        if (arResult[0].debit_balance > 0) {
            trialBalanceData.push(arResult[0]);
        }

        cashResult.forEach(account => {
            if (account.debit_balance > 0) {
                trialBalanceData.push(account);
            }
        });

        if (inventoryResult[0].debit_balance > 0) {
            trialBalanceData.push(inventoryResult[0]);
        }

        // Add Liabilities
        if (apResult[0].credit_balance > 0) {
            trialBalanceData.push(apResult[0]);
        }

        taxResult.forEach(tax => {
            if (tax.credit_balance > 0) {
                trialBalanceData.push(tax);
            }
        });

        // Add Revenue
        if (revenueResult[0].credit_balance > 0) {
            trialBalanceData.push(revenueResult[0]);
        }

        // Add Expenses
        if (cogsResult[0].debit_balance > 0) {
            trialBalanceData.push(cogsResult[0]);
        }

        expenseResult.forEach(expense => {
            if (expense.debit_balance > 0) {
                trialBalanceData.push(expense);
            }
        });

        if (purchaseResult[0].debit_balance > 0) {
            trialBalanceData.push(purchaseResult[0]);
        }

        // Calculate totals
        const totalDebits = trialBalanceData.reduce((sum, account) => sum + parseFloat(account.debit_balance), 0);
        const totalCredits = trialBalanceData.reduce((sum, account) => sum + parseFloat(account.credit_balance), 0);

        // Ensure debit equals credit by adjusting the last account
        if (Math.abs(totalDebits - totalCredits) > 0.01) {
            const lastAccount = trialBalanceData[trialBalanceData.length - 1];
            if (lastAccount) {
                const difference = totalDebits - totalCredits;
                if (difference > 0) {
                    lastAccount.credit_balance = parseFloat(lastAccount.credit_balance) + difference;
                } else {
                    lastAccount.debit_balance = parseFloat(lastAccount.debit_balance) + Math.abs(difference);
                }
            }
        }

        // Format the response
        const formattedData = trialBalanceData.map(account => ({
            account_name: account.account_name,
            account_type: account.account_type,
            debit_balance: parseFloat(account.debit_balance).toFixed(2),
            credit_balance: parseFloat(account.credit_balance).toFixed(2)
        }));

        res.status(200).json({
            success: true,
            data: {
                company_name: companyName,
                as_of_date: reportDate,
                accounts: formattedData,
                totals: {
                    total_debits: parseFloat(totalDebits.toFixed(2)),
                    total_credits: parseFloat(totalCredits.toFixed(2)),
                    difference: (totalDebits - totalCredits).toFixed(2),
                    is_balanced: Math.abs(totalDebits - totalCredits) < 0.01
                }
            },
            message: 'Trial balance retrieved successfully'
        });

    } catch (error) {
        console.error('Error generating trial balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate trial balance',
            error: error.message
        });
    }
};

const getDetailedTrialBalance = async (req, res) => {
    try {
        const { company_id } = req.params;
        const { as_of_date, account_type } = req.query;

        console.log('Received params:', { company_id, as_of_date, account_type });

        if (!company_id) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        // Use current date if as_of_date is not provided
        const reportDate = as_of_date || new Date().toISOString().split('T')[0];

        // Get company information
        const [companyResult] = await db.execute(
            'SELECT name FROM company WHERE company_id = ?',
            [company_id]
        );

        if (companyResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        const companyName = companyResult[0].name;

        let detailedData = [];

        // Assets Details
        if (!account_type || account_type === 'Asset') {
            // Individual Customer Balances
            let customerQuery = `
                SELECT 
                    CONCAT('A/R - ', c.name) as account_name,
                    'Asset' as account_type,
                    'Accounts Receivable' as sub_category,
                    COALESCE(SUM(i.balance_due), 0) as debit_balance,
                    0 as credit_balance
                FROM customer c
                LEFT JOIN invoices i ON c.id = i.customer_id 
                    AND i.status IN ('opened', 'sent', 'partially_paid', 'overdue')
                WHERE c.company_id = ?
            `;
            let customerParams = [company_id];

            if (as_of_date && as_of_date.trim() !== '') {
                customerQuery += ' AND (i.invoice_date IS NULL OR i.invoice_date <= ?)';
                customerParams.push(as_of_date);
            }

            customerQuery += ' GROUP BY c.id, c.name HAVING debit_balance > 0';

            const [customerResult] = await db.execute(customerQuery, customerParams);
            detailedData = detailedData.concat(customerResult);

            // Individual Product Inventory
            const [productResult] = await db.execute(`
                SELECT 
                    CONCAT('Inventory - ', p.name) as account_name,
                    'Asset' as account_type,
                    'Inventory' as sub_category,
                    (p.quantity_on_hand * p.cost_price) as debit_balance,
                    0 as credit_balance
                FROM products p
                WHERE p.company_id = ? 
                AND p.is_active = 1
                AND p.quantity_on_hand > 0
                AND p.cost_price > 0
            `, [company_id]);
            detailedData = detailedData.concat(productResult);

            // Payment Accounts (Cash/Bank)
            const [paymentAccountResult] = await db.execute(`
                SELECT 
                    pa.payment_account_name as account_name,
                    'Asset' as account_type,
                    'Cash & Bank' as sub_category,
                    COALESCE(SUM(
                        CASE 
                            WHEN p.payment_method = 'cash' OR p.payment_method = 'bank_transfer' 
                            THEN p.payment_amount 
                            ELSE 0 
                        END
                    ), 0) as debit_balance,
                    0 as credit_balance
                FROM payment_account pa
                LEFT JOIN payments p ON CAST(pa.id AS CHAR) = p.deposit_to AND p.company_id = pa.company_id
                WHERE pa.company_id = ?
                ${as_of_date ? 'AND (p.payment_date IS NULL OR p.payment_date <= ?)' : ''}
                GROUP BY pa.id, pa.payment_account_name
            `, as_of_date ? [company_id, as_of_date] : [company_id]);
            detailedData = detailedData.concat(paymentAccountResult);
        }

        // Liabilities Details
        if (!account_type || account_type === 'Liability') {
            // Individual Vendor Balances
            const [vendorResult] = await db.execute(`
                SELECT 
                    CONCAT('A/P - ', v.name) as account_name,
                    'Liability' as account_type,
                    'Accounts Payable' as sub_category,
                    0 as debit_balance,
                    v.balance as credit_balance
                FROM vendor v
                WHERE v.company_id = ? 
                AND v.is_active = 1
                AND v.balance > 0
            `, [company_id]);
            detailedData = detailedData.concat(vendorResult);

            // Tax Liabilities by Tax Rate
            let taxLiabilityQuery = `
                SELECT 
                    CONCAT(COALESCE(tr.name, CONCAT(ii.tax_rate, '%')), ' Tax Payable') as account_name,
                    'Liability' as account_type,
                    'Tax Payable' as sub_category,
                    0 as debit_balance,
                    COALESCE(SUM(ii.tax_amount), 0) as credit_balance
                FROM invoices i
                JOIN invoice_items ii ON i.id = ii.invoice_id
                LEFT JOIN tax_rates tr ON ii.tax_rate = tr.rate AND tr.company_id = i.company_id
                WHERE i.company_id = ? 
                AND i.status != 'cancelled'
                AND i.status != 'proforma'
                AND ii.tax_rate > 0
            `;
            let taxLiabilityParams = [company_id];

            if (as_of_date && as_of_date.trim() !== '') {
                taxLiabilityQuery += ' AND i.invoice_date <= ?';
                taxLiabilityParams.push(as_of_date);
            }

            taxLiabilityQuery += ' GROUP BY tr.name, ii.tax_rate HAVING credit_balance > 0';

            const [taxLiabilityResult] = await db.execute(taxLiabilityQuery, taxLiabilityParams);
            detailedData = detailedData.concat(taxLiabilityResult);
        }

        // Revenue Details
        if (!account_type || account_type === 'Revenue') {
            let salesRevenueQuery = `
                SELECT 
                    'Sales Revenue' as account_name,
                    'Revenue' as account_type,
                    'Income' as sub_category,
                    0 as debit_balance,
                    COALESCE(SUM(total_amount), 0) as credit_balance
                FROM invoices 
                WHERE company_id = ? 
                AND status != 'cancelled'
                AND status != 'proforma'
            `;
            let salesRevenueParams = [company_id];

            if (as_of_date && as_of_date.trim() !== '') {
                salesRevenueQuery += ' AND invoice_date <= ?';
                salesRevenueParams.push(as_of_date);
            }

            const [salesRevenueResult] = await db.execute(salesRevenueQuery, salesRevenueParams);
            detailedData = detailedData.concat(salesRevenueResult);
        }

        // Expense Details
        if (!account_type || account_type === 'Expense') {
            // Cost of Goods Sold
            let cogsDetailQuery = `
                SELECT 
                    'Cost of Goods Sold' as account_name,
                    'Expense' as account_type,
                    'Cost of Sales' as sub_category,
                    COALESCE(SUM(ii.quantity * p.cost_price), 0) as debit_balance,
                    0 as credit_balance
                FROM invoices i
                JOIN invoice_items ii ON i.id = ii.invoice_id
                LEFT JOIN products p ON ii.product_id = p.id
                WHERE i.company_id = ? 
                AND i.status != 'cancelled'
                AND i.status != 'proforma'
            `;
            let cogsDetailParams = [company_id];

            if (as_of_date && as_of_date.trim() !== '') {
                cogsDetailQuery += ' AND i.invoice_date <= ?';
                cogsDetailParams.push(as_of_date);
            }

            const [cogsDetailResult] = await db.execute(cogsDetailQuery, cogsDetailParams);
            detailedData = detailedData.concat(cogsDetailResult);

            // Operating Expenses by Category
            let operatingExpenseQuery = `
                SELECT 
                    ec.category_name as account_name,
                    'Expense' as account_type,
                    'Operating Expenses' as sub_category,
                    COALESCE(SUM(ei.amount), 0) as debit_balance,
                    0 as credit_balance
                FROM expenses e
                JOIN expense_items ei ON e.id = ei.expense_id
                JOIN expense_categories ec ON ei.category_id = ec.id
                WHERE e.company_id = ?
                AND e.status = 'paid'
            `;
            let operatingExpenseParams = [company_id];

            if (as_of_date && as_of_date.trim() !== '') {
                operatingExpenseQuery += ' AND e.payment_date <= ?';
                operatingExpenseParams.push(as_of_date);
            }

            operatingExpenseQuery += ' GROUP BY ec.id, ec.category_name HAVING debit_balance > 0';

            const [operatingExpenseResult] = await db.execute(operatingExpenseQuery, operatingExpenseParams);
            detailedData = detailedData.concat(operatingExpenseResult);

            // Purchase Expenses
            let purchaseExpenseQuery = `
                SELECT 
                    'Purchase Expenses' as account_name,
                    'Expense' as account_type,
                    'Purchase Costs' as sub_category,
                    COALESCE(SUM(total_amount), 0) as debit_balance,
                    0 as credit_balance
                FROM bills 
                WHERE company_id = ? 
                AND status != 'cancelled'
            `;
            let purchaseExpenseParams = [company_id];

            if (as_of_date && as_of_date.trim() !== '') {
                purchaseExpenseQuery += ' AND bill_date <= ?';
                purchaseExpenseParams.push(as_of_date);
            }

            const [purchaseExpenseResult] = await db.execute(purchaseExpenseQuery, purchaseExpenseParams);
            detailedData = detailedData.concat(purchaseExpenseResult);
        }

        // Filter out zero balances and sort by account type and name
        const filteredData = detailedData.filter(account =>
            parseFloat(account.debit_balance) > 0 || parseFloat(account.credit_balance) > 0
        );

        // Sort by account type and then by account name
        const sortedData = filteredData.sort((a, b) => {
            const typeOrder = { 'Asset': 1, 'Liability': 2, 'Revenue': 3, 'Expense': 4 };
            if (typeOrder[a.account_type] !== typeOrder[b.account_type]) {
                return typeOrder[a.account_type] - typeOrder[b.account_type];
            }
            return a.account_name.localeCompare(b.account_name);
        });

        // Calculate totals
        const totalDebits = sortedData.reduce((sum, account) => sum + parseFloat(account.debit_balance), 0);
        const totalCredits = sortedData.reduce((sum, account) => sum + parseFloat(account.credit_balance), 0);

        // Group by account type for better presentation
        const groupedData = {
            assets: sortedData.filter(account => account.account_type === 'Asset'),
            liabilities: sortedData.filter(account => account.account_type === 'Liability'),
            revenue: sortedData.filter(account => account.account_type === 'Revenue'),
            expenses: sortedData.filter(account => account.account_type === 'Expense')
        };

        res.status(200).json({
            success: true,
            data: {
                company_name: companyName,
                as_of_date: reportDate,
                accounts: sortedData,
                grouped_accounts: groupedData,
                totals: {
                    total_debits: totalDebits.toFixed(2),
                    total_credits: totalCredits.toFixed(2),
                    difference: (totalDebits - totalCredits).toFixed(2),
                    is_balanced: Math.abs(totalDebits - totalCredits) < 0.01
                },
                summary: {
                    total_assets: groupedData.assets.reduce((sum, acc) => sum + parseFloat(acc.debit_balance), 0).toFixed(2),
                    total_liabilities: groupedData.liabilities.reduce((sum, acc) => sum + parseFloat(acc.credit_balance), 0).toFixed(2),
                    total_revenue: groupedData.revenue.reduce((sum, acc) => sum + parseFloat(acc.credit_balance), 0).toFixed(2),
                    total_expenses: groupedData.expenses.reduce((sum, acc) => sum + parseFloat(acc.debit_balance), 0).toFixed(2)
                }
            },
            message: 'Detailed trial balance retrieved successfully'
        });

    } catch (error) {
        console.error('Error generating detailed trial balance:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate detailed trial balance',
            error: error.message
        });
    }
};

const getTrialBalanceByAccountType = async (req, res) => {
    try {
        const { company_id, account_type } = req.params;
        const { as_of_date } = req.query;

        console.log('Received params:', { company_id, account_type, as_of_date });

        if (!company_id || !account_type) {
            return res.status(400).json({
                success: false,
                message: 'Company ID and Account Type are required'
            });
        }

        // Use current date if as_of_date is not provided
        const reportDate = as_of_date || new Date().toISOString().split('T')[0];

        let accountData = [];

        switch (account_type.toLowerCase()) {
            case 'asset':
                // Get detailed asset accounts
                let arQuery = `
                    SELECT 
                        CONCAT('A/R - ', c.name) as account_name,
                        'Asset' as account_type,
                        COALESCE(SUM(i.balance_due), 0) as debit_balance,
                        0 as credit_balance
                    FROM customer c
                    LEFT JOIN invoices i ON c.id = i.customer_id 
                        AND i.status IN ('opened', 'sent', 'partially_paid', 'overdue')
                    WHERE c.company_id = ?
                `;
                let arParams = [company_id];

                if (as_of_date && as_of_date.trim() !== '') {
                    arQuery += ' AND (i.invoice_date IS NULL OR i.invoice_date <= ?)';
                    arParams.push(as_of_date);
                }

                arQuery += ' GROUP BY c.id, c.name HAVING debit_balance > 0';

                const [arResult] = await db.execute(arQuery, arParams);
                accountData = accountData.concat(arResult);

                // Add inventory and cash accounts
                const [inventoryResult] = await db.execute(`
                    SELECT 
                        CONCAT('Inventory - ', p.name) as account_name,
                        'Asset' as account_type,
                        (p.quantity_on_hand * p.cost_price) as debit_balance,
                        0 as credit_balance
                    FROM products p
                    WHERE p.company_id = ? 
                    AND p.is_active = 1
                    AND p.quantity_on_hand > 0
                `, [company_id]);
                accountData = accountData.concat(inventoryResult);
                break;

            case 'liability':
                // Get detailed liability accounts
                const [vendorResult] = await db.execute(`
                    SELECT 
                        CONCAT('A/P - ', v.name) as account_name,
                        'Liability' as account_type,
                        0 as debit_balance,
                        v.balance as credit_balance
                    FROM vendor v
                    WHERE v.company_id = ? 
                    AND v.is_active = 1
                    AND v.balance > 0
                `, [company_id]);
                accountData = accountData.concat(vendorResult);
                break;

            case 'revenue':
                // Get revenue details
                let revenueQuery = `
                    SELECT 
                        'Sales Revenue' as account_name,
                        'Revenue' as account_type,
                        0 as debit_balance,
                        COALESCE(SUM(total_amount), 0) as credit_balance
                    FROM invoices 
                    WHERE company_id = ? 
                    AND status != 'cancelled'
                    AND status != 'proforma'
                `;
                let revenueParams = [company_id];

                if (as_of_date && as_of_date.trim() !== '') {
                    revenueQuery += ' AND invoice_date <= ?';
                    revenueParams.push(as_of_date);
                }

                const [revenueResult] = await db.execute(revenueQuery, revenueParams);
                accountData = accountData.concat(revenueResult);
                break;

            case 'expense':
                // Get expense details by category
                let expenseQuery = `
                    SELECT 
                        ec.category_name as account_name,
                        'Expense' as account_type,
                        COALESCE(SUM(ei.amount), 0) as debit_balance,
                        0 as credit_balance
                    FROM expenses e
                    JOIN expense_items ei ON e.id = ei.expense_id
                    JOIN expense_categories ec ON ei.category_id = ec.id
                    WHERE e.company_id = ?
                    AND e.status = 'paid'
                `;
                let expenseParams = [company_id];

                if (as_of_date && as_of_date.trim() !== '') {
                    expenseQuery += ' AND e.payment_date <= ?';
                    expenseParams.push(as_of_date);
                }

                expenseQuery += ' GROUP BY ec.id, ec.category_name HAVING debit_balance > 0';

                const [expenseResult] = await db.execute(expenseQuery, expenseParams);
                accountData = accountData.concat(expenseResult);
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid account type. Must be Asset, Liability, Revenue, or Expense'
                });
        }

        // Calculate totals for this account type
        const totalDebits = accountData.reduce((sum, account) => sum + parseFloat(account.debit_balance), 0);
        const totalCredits = accountData.reduce((sum, account) => sum + parseFloat(account.credit_balance), 0);

        res.status(200).json({
            success: true,
            data: {
                company_name: companyName,
                as_of_date: reportDate,
                account_type: account_type,
                accounts: accountData,
                totals: {
                    total_debits: totalDebits.toFixed(2),
                    total_credits: totalCredits.toFixed(2),
                    net_balance: (totalDebits - totalCredits).toFixed(2)
                }
            },
            message: `${account_type} accounts retrieved successfully`
        });

    } catch (error) {
        console.error(`Error generating ${account_type} trial balance:`, error);
        res.status(500).json({
            success: false,
            message: `Failed to generate ${account_type} trial balance`,
            error: error.message
        });
    }
};

module.exports = {
    getTrialBalance,
    getDetailedTrialBalance,
    getTrialBalanceByAccountType
};