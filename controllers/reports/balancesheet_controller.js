// controller
const db = require('../../DB/db');

const getBalanceSheetData = async (req, res) => {
    const { company_id: companyId } = req.params;
    const { asOfDate } = req.query;

    // Validate companyId
    if (!companyId) {
        return res.status(400).json({
            success: false,
            message: 'Company ID is required'
        });
    }

    try {
        // Use current date if asOfDate is not provided
        const reportDate = asOfDate || new Date().toISOString().split('T')[0];

        // Get company information
        const [companyResult] = await db.execute(
            'SELECT name, opening_balance FROM company WHERE company_id = ?',
            [companyId]
        );

        if (companyResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        const companyName = companyResult[0].name;
        const companyOpeningBalance = parseFloat(companyResult[0].opening_balance) || 0;

        // Calculate Assets - Accounts Receivable
        let assetsQuery = `
            SELECT 
                COALESCE(SUM(balance_due), 0) as accounts_receivable
            FROM invoices 
            WHERE company_id = ? 
            AND status IN ('opened', 'sent', 'partially_paid', 'overdue')
        `;
        let assetsParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            assetsQuery += ' AND invoice_date <= ?';
            assetsParams.push(asOfDate);
        }

        const [arResult] = await db.execute(assetsQuery, assetsParams);
        const accountsReceivable = parseFloat(arResult[0].accounts_receivable) || 0;
        const arAdjustment = 0;

        // Calculate Cash
        let cashQuery = `
            SELECT COALESCE(SUM(payment_amount), 0) as cash
            FROM payments 
            WHERE company_id = ?
        `;
        let cashParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            cashQuery += ' AND payment_date <= ?';
            cashParams.push(asOfDate);
        }

        const [cashResult] = await db.execute(cashQuery, cashParams);
        const cash = (parseFloat(cashResult[0].cash) || 0) + companyOpeningBalance;

        // Calculate Inventory
        const [inventoryResult] = await db.execute(`
            SELECT 
                COALESCE(SUM(quantity_on_hand * cost_price), 0) as inventory_value,
                COALESCE(SUM(manual_count * cost_price), 0) as inventory_asset
            FROM products 
            WHERE company_id = ? 
            AND is_active = 1
        `, [companyId]);

        const inventory = parseFloat(inventoryResult[0].inventory_value) || 0;
        const inventoryAsset = parseFloat(inventoryResult[0].inventory_asset) || 0;

        const longTermAssets = 0;
        const totalCurrentAssets = accountsReceivable + cash + inventory + inventoryAsset;
        const totalAssets = totalCurrentAssets + longTermAssets;

        // Calculate Liabilities - Accounts Payable
        const [apResult] = await db.execute(`
            SELECT COALESCE(SUM(balance), 0) as accounts_payable
            FROM vendor 
            WHERE company_id = ? 
            AND is_active = 1
            AND balance > 0
        `, [companyId]);

        const accountsPayable = parseFloat(apResult[0].accounts_payable) || 0;

        // Calculate Tax Liabilities (Reverse Calculation)
        let taxQuery = `
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_gross,
                COALESCE(SUM(tax_amount), 0) as total_vat
            FROM invoices 
            WHERE company_id = ? 
            AND status != 'cancelled'
        `;
        let taxParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            taxQuery += ' AND invoice_date <= ?';
            taxParams.push(asOfDate);
        }

        const [taxResult] = await db.execute(taxQuery, taxParams);
        const totalGrossRevenue = parseFloat(taxResult[0].total_gross) || 0;
        const totalVAT = parseFloat(taxResult[0].total_vat) || 0;

        const vatExclusiveAmount = totalGrossRevenue - totalVAT;
        const totalSSCL = vatExclusiveAmount * (2.5 / 102.5);

        const ssclPayable = totalSSCL;
        const vatPayable = totalVAT;
        const totalCurrentLiabilities = accountsPayable + ssclPayable + vatPayable;
        const nonCurrentLiabilities = 0;
        const totalLiabilities = totalCurrentLiabilities + nonCurrentLiabilities;

        // Calculate Equity - Revenue (Net Revenue)
        // Net Revenue = VAT Exclusive - SSCL
        const totalRevenue = vatExclusiveAmount - totalSSCL;

        // Calculate Expenses (Operating Expenses + Bills)
        let expensesQuery = `
            SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses 
            WHERE company_id = ? 
        `;
        let expenseParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            expensesQuery += ' AND payment_date <= ?';
            expenseParams.push(asOfDate);
        }

        const [expensesResult] = await db.execute(expensesQuery, expenseParams);
        const operatingExpenses = parseFloat(expensesResult[0].total_expenses) || 0;

        let billsQuery = `
            SELECT COALESCE(SUM(total_amount), 0) as total_bills
            FROM bills 
            WHERE company_id = ? 
            AND status != 'cancelled'
        `;
        let billsParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            billsQuery += ' AND bill_date <= ?';
            billsParams.push(asOfDate);
        }

        const [billsResult] = await db.execute(billsQuery, billsParams);
        const billExpenses = parseFloat(billsResult[0].total_bills) || 0;

        const totalExpenses = operatingExpenses + billExpenses;

        const netIncome = totalRevenue - totalExpenses;
        const openingBalance = companyOpeningBalance;
        const retainedEarnings = 0;
        const totalEquity = openingBalance + retainedEarnings + netIncome;

        // Prepare balance sheet data
        const balanceSheet = {
            companyName,
            asOfDate: reportDate,
            assets: {
                currentAssets: {
                    accountsReceivable: {
                        accountsReceivableAR: accountsReceivable,
                        totalAccountsReceivable: accountsReceivable,
                        adjustment: arAdjustment
                    },
                    cashAndCashEquivalents: cash,
                    inventory,
                    inventoryAsset,
                    totalCurrentAssets
                },
                longTermAssets,
                totalAssets
            },
            liabilities: {
                currentLiabilities: {
                    accountsPayable: {
                        accountsPayableAP: accountsPayable,
                        totalAccountsPayable: accountsPayable
                    },
                    ssclPayable,
                    vatPayable,
                    totalCurrentLiabilities
                },
                nonCurrentLiabilities,
                totalLiabilities
            },
            equity: {
                openingBalanceEquity: openingBalance,
                retainedEarnings,
                netIncome,
                totalEquity
            },
            totalLiabilitiesAndEquity: totalLiabilities + totalEquity
        };

        res.status(200).json({
            success: true,
            data: balanceSheet,
            message: 'Balance sheet data retrieved successfully'
        });
    } catch (error) {
        console.error('Error generating balance sheet:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate balance sheet',
            error: error.message
        });
    }
};

const getFormattedBalanceSheet = async (req, res) => {
    const { company_id: companyId } = req.params;
    const { asOfDate } = req.query;

    // Validate companyId
    if (!companyId) {
        return res.status(400).json({
            success: false,
            message: 'Company ID is required'
        });
    }

    try {
        // Use current date if asOfDate is not provided
        const reportDate = asOfDate || new Date().toISOString().split('T')[0];

        // Get company information
        const [companyResult] = await db.execute(
            'SELECT name, opening_balance FROM company WHERE company_id = ?',
            [companyId]
        );

        if (companyResult.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Company not found'
            });
        }

        const companyName = companyResult[0].name;
        const companyOpeningBalance = parseFloat(companyResult[0].opening_balance) || 0;

        // Calculate Assets - Accounts Receivable
        let assetsQuery = `
            SELECT 
                COALESCE(SUM(balance_due), 0) as accounts_receivable
            FROM invoices 
            WHERE company_id = ? 
            AND status IN ('opened', 'sent', 'partially_paid', 'overdue')
        `;
        let assetsParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            assetsQuery += ' AND invoice_date <= ?';
            assetsParams.push(asOfDate);
        }

        const [arResult] = await db.execute(assetsQuery, assetsParams);
        const accountsReceivable = parseFloat(arResult[0].accounts_receivable) || 0;
        const arAdjustment = 0;

        // Calculate Cash
        let cashQuery = `
            SELECT COALESCE(SUM(payment_amount), 0) as cash
            FROM payments 
            WHERE company_id = ?
        `;
        let cashParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            cashQuery += ' AND payment_date <= ?';
            cashParams.push(asOfDate);
        }

        const [cashResult] = await db.execute(cashQuery, cashParams);
        const cash = (parseFloat(cashResult[0].cash) || 0) + companyOpeningBalance;

        // Calculate Inventory
        const [inventoryResult] = await db.execute(`
            SELECT 
                COALESCE(SUM(quantity_on_hand * cost_price), 0) as inventory_value,
                COALESCE(SUM(manual_count * cost_price), 0) as inventory_asset
            FROM products 
            WHERE company_id = ? 
            AND is_active = 1
        `, [companyId]);

        const inventory = parseFloat(inventoryResult[0].inventory_value) || 0;
        const inventoryAsset = parseFloat(inventoryResult[0].inventory_asset) || 0;

        const longTermAssets = 0;
        const totalCurrentAssets = accountsReceivable + cash + inventory + inventoryAsset;
        const totalAssets = totalCurrentAssets + longTermAssets;

        // Calculate Liabilities - Accounts Payable
        const [apResult] = await db.execute(`
            SELECT COALESCE(SUM(balance), 0) as accounts_payable
            FROM vendor 
            WHERE company_id = ? 
            AND is_active = 1
            AND balance > 0
        `, [companyId]);

        const accountsPayable = parseFloat(apResult[0].accounts_payable) || 0;

        // Calculate Tax Liabilities (Reverse Calculation)
        let taxQuery = `
            SELECT 
                COALESCE(SUM(total_amount), 0) as total_gross,
                COALESCE(SUM(tax_amount), 0) as total_vat
            FROM invoices 
            WHERE company_id = ? 
            AND status != 'cancelled'
        `;
        let taxParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            taxQuery += ' AND invoice_date <= ?';
            taxParams.push(asOfDate);
        }

        const [taxResult] = await db.execute(taxQuery, taxParams);
        const totalGrossRevenue = parseFloat(taxResult[0].total_gross) || 0;
        const totalVAT = parseFloat(taxResult[0].total_vat) || 0;

        const vatExclusiveAmount = totalGrossRevenue - totalVAT;
        const totalSSCL = vatExclusiveAmount * (2.5 / 102.5);

        const ssclPayable = totalSSCL;
        const vatPayable = totalVAT;
        const totalCurrentLiabilities = accountsPayable + ssclPayable + vatPayable;
        const nonCurrentLiabilities = 0;
        const totalLiabilities = totalCurrentLiabilities + nonCurrentLiabilities;

        // Calculate Equity - Revenue (Net Revenue)
        // Net Revenue = VAT Exclusive - SSCL
        const totalRevenue = vatExclusiveAmount - totalSSCL;

        // Calculate Expenses (Operating Expenses + Bills)
        let expensesQuery = `
            SELECT COALESCE(SUM(amount), 0) as total_expenses
            FROM expenses 
            WHERE company_id = ? 
        `;
        let expenseParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            expensesQuery += ' AND payment_date <= ?';
            expenseParams.push(asOfDate);
        }

        const [expensesResult] = await db.execute(expensesQuery, expenseParams);
        const operatingExpenses = parseFloat(expensesResult[0].total_expenses) || 0;

        let billsQuery = `
            SELECT COALESCE(SUM(total_amount), 0) as total_bills
            FROM bills 
            WHERE company_id = ? 
            AND status != 'cancelled'
        `;
        let billsParams = [companyId];

        if (asOfDate && asOfDate.trim() !== '') {
            billsQuery += ' AND bill_date <= ?';
            billsParams.push(asOfDate);
        }

        const [billsResult] = await db.execute(billsQuery, billsParams);
        const billExpenses = parseFloat(billsResult[0].total_bills) || 0;

        const totalExpenses = operatingExpenses + billExpenses;

        const netIncome = totalRevenue - totalExpenses;
        const openingBalance = companyOpeningBalance;
        const retainedEarnings = 0;
        const totalEquity = openingBalance + retainedEarnings + netIncome;

        // Prepare balance sheet data
        const balanceSheet = {
            companyName,
            asOfDate: reportDate,
            assets: {
                currentAssets: {
                    accountsReceivable: {
                        accountsReceivableAR: accountsReceivable,
                        totalAccountsReceivable: accountsReceivable,
                        adjustment: arAdjustment
                    },
                    cashAndCashEquivalents: cash,
                    inventory,
                    inventoryAsset,
                    totalCurrentAssets
                },
                longTermAssets,
                totalAssets
            },
            liabilities: {
                currentLiabilities: {
                    accountsPayable: {
                        accountsPayableAP: accountsPayable,
                        totalAccountsPayable: accountsPayable
                    },
                    ssclPayable,
                    vatPayable,
                    totalCurrentLiabilities
                },
                nonCurrentLiabilities,
                totalLiabilities
            },
            equity: {
                openingBalanceEquity: openingBalance,
                retainedEarnings,
                netIncome,
                totalEquity
            },
            totalLiabilitiesAndEquity: totalLiabilities + totalEquity
        };

        // Format currency values
        const formatCurrency = (amount, currency = 'LKR') => {
            const formattedAmount = Math.abs(amount).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            return amount < 0 ? `-${currency}${formattedAmount}` : `${currency}${formattedAmount}`;
        };

        res.status(200).json({
            success: true,
            data: {
                ...balanceSheet,
                formattedAssets: {
                    currentAssets: {
                        accountsReceivable: {
                            accountsReceivableAR: formatCurrency(balanceSheet.assets.currentAssets.accountsReceivable.accountsReceivableAR),
                            totalAccountsReceivable: formatCurrency(balanceSheet.assets.currentAssets.accountsReceivable.totalAccountsReceivable),
                            adjustment: formatCurrency(balanceSheet.assets.currentAssets.accountsReceivable.adjustment)
                        },
                        cashAndCashEquivalents: formatCurrency(balanceSheet.assets.currentAssets.cashAndCashEquivalents),
                        inventory: formatCurrency(balanceSheet.assets.currentAssets.inventory),
                        inventoryAsset: formatCurrency(balanceSheet.assets.currentAssets.inventoryAsset),
                        totalCurrentAssets: formatCurrency(balanceSheet.assets.currentAssets.totalCurrentAssets)
                    },
                    longTermAssets: formatCurrency(balanceSheet.assets.longTermAssets),
                    totalAssets: formatCurrency(balanceSheet.assets.totalAssets)
                },
                formattedLiabilities: {
                    currentLiabilities: {
                        accountsPayable: {
                            accountsPayableAP: formatCurrency(balanceSheet.liabilities.currentLiabilities.accountsPayable.accountsPayableAP),
                            totalAccountsPayable: formatCurrency(balanceSheet.liabilities.currentLiabilities.accountsPayable.totalAccountsPayable)
                        },
                        ssclPayable: formatCurrency(balanceSheet.liabilities.currentLiabilities.ssclPayable),
                        vatPayable: formatCurrency(balanceSheet.liabilities.currentLiabilities.vatPayable),
                        totalCurrentLiabilities: formatCurrency(balanceSheet.liabilities.currentLiabilities.totalCurrentLiabilities)
                    },
                    nonCurrentLiabilities: formatCurrency(balanceSheet.liabilities.nonCurrentLiabilities),
                    totalLiabilities: formatCurrency(balanceSheet.liabilities.totalLiabilities)
                },
                formattedEquity: {
                    openingBalanceEquity: formatCurrency(balanceSheet.equity.openingBalanceEquity),
                    retainedEarnings: formatCurrency(balanceSheet.equity.retainedEarnings),
                    netIncome: formatCurrency(balanceSheet.equity.netIncome),
                    totalEquity: formatCurrency(balanceSheet.equity.totalEquity)
                },
                formattedTotalLiabilitiesAndEquity: formatCurrency(balanceSheet.totalLiabilitiesAndEquity)
            },
            message: 'Formatted balance sheet retrieved successfully'
        });
    } catch (error) {
        console.error('Error generating formatted balance sheet:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate formatted balance sheet',
            error: error.message
        });
    }
};

module.exports = {
    getBalanceSheetData,
    getFormattedBalanceSheet
};