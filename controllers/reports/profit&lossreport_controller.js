const db = require('../../DB/db');

class ReportController {

    static async getProfitAndLossData(req, res) {
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

            // 1. INCOME CALCULATIONS

            // Sales of Product Income - Total revenue from products
            const [productIncomeResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(ii.quantity * ii.actual_unit_price), 0) as product_income
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                WHERE i.company_id = ? 
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, ...dateParams]);

            // Discounts Given - Total discounts provided (shown as negative)
            const [discountsResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.discount_amount), 0) as discounts_given
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, ...dateParams]);

            // Tax Income - Total tax collected
            const [taxIncomeResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.tax_amount), 0) as tax_income
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, ...dateParams]);

            // 2. COST OF SALES CALCULATIONS

            // Cost of Sales - Based on product cost prices
            const [costOfSalesResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(ii.quantity * CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END), 0) as cost_of_sales
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                LEFT JOIN products p ON ii.product_id = p.id
                WHERE i.company_id = ? 
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, ...dateParams]);

            // Inventory Shrinkage - Calculate based on adjustment table (negative adjustments)
            const [inventoryShrinkageResult] = await db.execute(`
                SELECT 
                    COALESCE(ABS(SUM(ia.adjustment_quantity * p.cost_price)), 0) as inventory_shrinkage
                FROM inventory_adjustments ia
                JOIN products p ON ia.product_id = p.id
                WHERE ia.company_id = ?
                AND ia.adjustment_quantity < 0
                AND ia.reason != 'Manual Adjustment' 
                AND DATE(ia.created_at) BETWEEN ? AND ?
            `, [company_id, ...dateParams]);

            // 3. OTHER INCOME AND EXPENSES (placeholders for future implementation)

            // Other Income - From non-product sources
            const [otherIncomeResult] = await db.execute(`
                SELECT 0 as other_income
            `);

            // Expenses - Operating expenses from 'expenses' table
            const [expensesResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(amount), 0) as expenses
                FROM expenses
                WHERE company_id = ?
                AND payment_date BETWEEN ? AND ?
            `, [company_id, ...dateParams]);

            // Other Expenses - From 'bills' table (excluding cancelled)
            const [otherExpensesResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(total_amount), 0) as other_expenses
                FROM bills
                WHERE company_id = ?
                AND status != 'cancelled'
                AND bill_date BETWEEN ? AND ?
            `, [company_id, ...dateParams]);

            // 4. ADDITIONAL METRICS

            // Total Paid Amount - Actual cash received
            const [totalPaidResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.paid_amount), 0) as total_paid
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, ...dateParams]);

            // Outstanding Balance - Amount still owed
            const [outstandingResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.balance_due), 0) as outstanding_balance
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.balance_due > 0
                ${dateCondition}
            `, [company_id, ...dateParams]);

            // Extract values
            const productIncome = parseFloat(productIncomeResult[0]?.product_income || 0);
            const discountsGiven = parseFloat(discountsResult[0]?.discounts_given || 0);
            const taxIncome = parseFloat(taxIncomeResult[0]?.tax_income || 0);
            const costOfSales = parseFloat(costOfSalesResult[0]?.cost_of_sales || 0);
            const inventoryShrinkage = parseFloat(inventoryShrinkageResult[0]?.inventory_shrinkage || 0);
            const otherIncome = parseFloat(otherIncomeResult[0]?.other_income || 0);
            const expenses = parseFloat(expensesResult[0]?.expenses || 0);
            const otherExpenses = parseFloat(otherExpensesResult[0]?.other_expenses || 0);
            const totalPaid = parseFloat(totalPaidResult[0]?.total_paid || 0);
            const outstandingBalance = parseFloat(outstandingResult[0]?.outstanding_balance || 0);

            // 5. CALCULATE TOTALS AND DERIVED METRICS

            // Total Income (before discounts)
            const totalIncome = productIncome + taxIncome;

            // Net Income (after discounts)
            const netIncome = totalIncome - discountsGiven;

            // Total Cost of Sales
            const totalCostOfSales = costOfSales + inventoryShrinkage;

            // Gross Profit
            const grossProfit = netIncome - totalCostOfSales;

            // Net Earnings (Final profit/loss)
            const netEarnings = grossProfit + otherIncome - expenses - otherExpenses;

            // Profit Margins
            const grossProfitMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
            const netProfitMargin = totalIncome > 0 ? (netEarnings / totalIncome) * 100 : 0;

            // 6. GET COMPANY DETAILS
            const [companyResult] = await db.execute(`
                SELECT name, address, email_address, contact_number
                FROM company
                WHERE company_id = ?
            `, [company_id]);

            const companyInfo = companyResult[0] || {};

            // 7. PREPARE RESPONSE DATA
            const profitAndLossData = {
                company: {
                    id: company_id,
                    name: companyInfo.name || 'Company Name',
                    address: companyInfo.address,
                    email: companyInfo.email_address,
                    phone: companyInfo.contact_number
                },
                period: {
                    start_date: startOfYear,
                    end_date: today,
                    generated_at: new Date().toISOString()
                },
                income: {
                    sales_of_product_income: productIncome,
                    tax_income: taxIncome,
                    discounts_given: -discountsGiven,
                    other_income: otherIncome,
                    total_income: totalIncome,
                    net_income: netIncome
                },
                cost_of_sales: {
                    cost_of_sales: costOfSales,
                    inventory_shrinkage: inventoryShrinkage,
                    total_cost_of_sales: totalCostOfSales
                },
                expenses: {
                    operating_expenses: expenses,
                    other_expenses: otherExpenses,
                    total_expenses: expenses + otherExpenses
                },
                profitability: {
                    gross_profit: grossProfit,
                    net_earnings: netEarnings,
                    gross_profit_margin: parseFloat(grossProfitMargin.toFixed(2)),
                    net_profit_margin: parseFloat(netProfitMargin.toFixed(2))
                },
                cash_flow: {
                    total_invoiced: totalIncome,
                    total_paid: totalPaid,
                    outstanding_balance: outstandingBalance,
                    collection_rate: totalIncome > 0 ? parseFloat(((totalPaid / totalIncome) * 100).toFixed(2)) : 0
                },
                summary: {
                    total_revenue: totalIncome,
                    total_costs: totalCostOfSales + expenses + otherExpenses,
                    net_profit_loss: netEarnings,
                    is_profitable: netEarnings > 0
                }
            };

            return res.status(200).json({
                success: true,
                message: 'Profit and Loss data retrieved successfully',
                data: profitAndLossData
            });

        } catch (error) {
            console.error('Error in getProfitAndLossData:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    }

    /**
     * Get Monthly Profit and Loss Comparison
     * Provides month-by-month breakdown for trend analysis
     */
    static async getMonthlyProfitAndLoss(req, res) {
        try {
            const { company_id, year } = req.params;

            if (!company_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID is required'
                });
            }

            const selectedYear = year ? parseInt(year) : new Date().getFullYear();
            const currentDate = new Date();
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-based

            // Define month names
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];

            // Determine which months to include
            let monthsToInclude = 12;
            if (selectedYear === currentYear) {
                monthsToInclude = currentMonth; // Only show up to current month for current year
            }

            const monthlyBreakdown = [];
            let totalInventoryShrinkage = 0;

            // Loop through each month
            for (let month = 1; month <= monthsToInclude; month++) {
                // Create date range for the month
                const startDate = new Date(selectedYear, month - 1, 1);
                const endDate = new Date(selectedYear, month, 0); // Last day of the month

                const startDateStr = startDate.toISOString().split('T')[0];
                const endDateStr = endDate.toISOString().split('T')[0];

                // 1. INCOME CALCULATIONS FOR THE MONTH
                // Product Income
                const [productIncomeResult] = await db.execute(`
                    SELECT 
                        COALESCE(SUM(ii.quantity * ii.actual_unit_price), 0) as product_income
                    FROM invoices i
                    INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                    WHERE i.company_id = ? 
                    AND i.status != 'proforma'
                    AND i.invoice_date BETWEEN ? AND ?
                `, [company_id, startDateStr, endDateStr]);

                // Tax Income
                const [taxIncomeResult] = await db.execute(`
                    SELECT 
                        COALESCE(SUM(i.tax_amount), 0) as tax_income
                    FROM invoices i
                    WHERE i.company_id = ? 
                    AND i.status != 'proforma'
                    AND i.invoice_date BETWEEN ? AND ?
                `, [company_id, startDateStr, endDateStr]);

                // Discounts Given
                const [discountsResult] = await db.execute(`
                    SELECT 
                        COALESCE(SUM(i.discount_amount), 0) as discounts_given
                    FROM invoices i
                    WHERE i.company_id = ? 
                    AND i.status != 'proforma'
                    AND i.invoice_date BETWEEN ? AND ?
                `, [company_id, startDateStr, endDateStr]);

                // 2. COST OF SALES CALCULATIONS FOR THE MONTH
                // Cost of Sales
                const [costOfSalesResult] = await db.execute(`
                    SELECT 
                        COALESCE(SUM(ii.quantity * CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END), 0) as cost_of_sales
                    FROM invoices i
                    INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                    LEFT JOIN products p ON ii.product_id = p.id
                    WHERE i.company_id = ? 
                    AND i.status != 'proforma'
                    AND i.invoice_date BETWEEN ? AND ?
                `, [company_id, startDateStr, endDateStr]);

                // Inventory Shrinkage - Calculate from adjustments for this specific month range
                const [inventoryShrinkageResult] = await db.execute(`
                    SELECT 
                        COALESCE(ABS(SUM(ia.adjustment_quantity * p.cost_price)), 0) as inventory_shrinkage
                    FROM inventory_adjustments ia
                    JOIN products p ON ia.product_id = p.id
                    WHERE ia.company_id = ?
                    AND ia.adjustment_quantity < 0
                    AND ia.reason != 'Manual Adjustment'
                    AND DATE(ia.created_at) BETWEEN ? AND ?
                `, [company_id, startDateStr, endDateStr]);

                // Invoice Count for the month
                const [invoiceCountResult] = await db.execute(`
                    SELECT 
                        COUNT(*) as invoice_count
                    FROM invoices i
                    WHERE i.company_id = ? 
                    AND i.status != 'proforma'
                    AND i.invoice_date BETWEEN ? AND ?
                `, [company_id, startDateStr, endDateStr]);

                // Extract values
                const productIncome = parseFloat(productIncomeResult[0]?.product_income || 0);
                const taxIncome = parseFloat(taxIncomeResult[0]?.tax_income || 0);
                const discountsGiven = parseFloat(discountsResult[0]?.discounts_given || 0);
                const costOfSales = parseFloat(costOfSalesResult[0]?.cost_of_sales || 0);
                const inventoryShrinkage = parseFloat(inventoryShrinkageResult[0]?.inventory_shrinkage || 0);
                const invoiceCount = parseInt(invoiceCountResult[0]?.invoice_count || 0);

                // Calculate totals for the month
                const totalIncome = productIncome + taxIncome;
                const netIncome = totalIncome - discountsGiven;
                const totalCostOfSales = costOfSales + inventoryShrinkage;
                const grossProfit = netIncome - totalCostOfSales;
                const grossProfitMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;

                // Add to total inventory shrinkage
                totalInventoryShrinkage += inventoryShrinkage;

                // Add month data to breakdown
                monthlyBreakdown.push({
                    month: month,
                    month_name: monthNames[month - 1],
                    income: {
                        product_income: productIncome,
                        tax_income: taxIncome,
                        discounts_given: discountsGiven,
                        total_income: totalIncome,
                        net_income: netIncome
                    },
                    cost_of_sales: {
                        cost_of_sales: costOfSales,
                        inventory_shrinkage: inventoryShrinkage,
                        total_cost_of_sales: totalCostOfSales
                    },
                    profitability: {
                        gross_profit: grossProfit,
                        gross_profit_margin: parseFloat(grossProfitMargin.toFixed(2))
                    },
                    invoice_count: invoiceCount
                });
            }

            // Get company information
            const [companyResult] = await db.execute(`
                SELECT name, address, email_address, contact_number, company_logo
                FROM company
                WHERE company_id = ?
            `, [company_id]);

            const companyInfo = companyResult[0] || {};

            // Prepare response data
            const profitAndLossData = {
                year: selectedYear,
                company_id: company_id,
                company: {
                    name: companyInfo.name || 'Company Name',
                    address: companyInfo.address,
                    email: companyInfo.email_address,
                    phone: companyInfo.contact_number,
                    logo: companyInfo.company_logo
                },
                monthly_breakdown: monthlyBreakdown,
                summary: {
                    total_inventory_shrinkage: totalInventoryShrinkage,
                    months_included: monthsToInclude,
                    generated_at: new Date().toISOString()
                }
            };

            return res.status(200).json({
                success: true,
                message: 'Monthly Profit and Loss data retrieved successfully',
                data: profitAndLossData
            });

        } catch (error) {
            console.error('Error in getMonthlyProfitAndLoss:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    }


    static async getProfitAndLossByEmployeeId(req, res) {
        try {
            const { company_id, employee_id } = req.params;
            const { start_date, end_date } = req.query;

            if (!company_id || !employee_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID and Employee ID are required'
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

            // 1. INCOME CALCULATIONS
            // Sales of Product Income - Total revenue from products
            const [productIncomeResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(ii.quantity * ii.actual_unit_price), 0) as product_income
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                WHERE i.company_id = ? 
                AND i.employee_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, employee_id, ...dateParams]);

            // Discounts Given - Total discounts provided
            const [discountsResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.discount_amount), 0) as discounts_given
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.employee_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, employee_id, ...dateParams]);

            // Tax Income - Total tax collected
            const [taxIncomeResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.tax_amount), 0) as tax_income
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.employee_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, employee_id, ...dateParams]);

            // 2. COST OF SALES CALCULATIONS
            // Cost of Sales - Based on product cost prices
            const [costOfSalesResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(ii.quantity * CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END), 0) as cost_of_sales
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                LEFT JOIN products p ON ii.product_id = p.id
                WHERE i.company_id = ? 
                AND i.employee_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, employee_id, ...dateParams]);

            // 3. OTHER INCOME AND EXPENSES
            const [otherIncomeResult] = await db.execute(`SELECT 0 as other_income`);
            const [expensesResult] = await db.execute(`SELECT 0 as expenses`);
            const [otherExpensesResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(total_amount), 0) as other_expenses
                FROM bills
                WHERE company_id = ?
                AND employee_id = ?
                AND status != 'cancelled'
                AND bill_date BETWEEN ? AND ?
            `, [company_id, employee_id, ...dateParams]);

            // 4. ADDITIONAL METRICS
            // Total Paid Amount - Actual cash received
            const [totalPaidResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.paid_amount), 0) as total_paid
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.employee_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, employee_id, ...dateParams]);

            // Outstanding Balance - Amount still owed
            const [outstandingResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.balance_due), 0) as outstanding_balance
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.employee_id = ?
                AND i.balance_due > 0
                ${dateCondition}
            `, [company_id, employee_id, ...dateParams]);

            // 5. GET COMPANY AND EMPLOYEE DETAILS
            const [companyResult] = await db.execute(`
                SELECT name, address, email_address, contact_number
                FROM company
                WHERE company_id = ?
            `, [company_id]);

            const [employeeResult] = await db.execute(`
                SELECT name, email, phone
                FROM employees
                WHERE id = ?
            `, [employee_id]);

            // Extract values
            const productIncome = parseFloat(productIncomeResult[0]?.product_income || 0);
            const discountsGiven = parseFloat(discountsResult[0]?.discounts_given || 0);
            const taxIncome = parseFloat(taxIncomeResult[0]?.tax_income || 0);
            const costOfSales = parseFloat(costOfSalesResult[0]?.cost_of_sales || 0);
            const otherIncome = parseFloat(otherIncomeResult[0]?.other_income || 0);
            const expenses = parseFloat(expensesResult[0]?.expenses || 0);
            const otherExpenses = parseFloat(otherExpensesResult[0]?.other_expenses || 0);
            const totalPaid = parseFloat(totalPaidResult[0]?.total_paid || 0);
            const outstandingBalance = parseFloat(outstandingResult[0]?.outstanding_balance || 0);
            const companyInfo = companyResult[0] || {};
            const employeeInfo = employeeResult[0] || {};

            // 6. CALCULATE TOTALS AND DERIVED METRICS
            const totalIncome = productIncome + taxIncome;
            const netIncome = totalIncome - discountsGiven;
            const totalCostOfSales = costOfSales;
            const grossProfit = netIncome - totalCostOfSales;
            const netEarnings = grossProfit + otherIncome - expenses - otherExpenses;
            const grossProfitMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
            const netProfitMargin = totalIncome > 0 ? (netEarnings / totalIncome) * 100 : 0;

            // 7. PREPARE RESPONSE DATA
            const profitAndLossData = {
                company: {
                    id: company_id,
                    name: companyInfo.name || 'Company Name',
                    address: companyInfo.address,
                    email: companyInfo.email_address,
                    phone: companyInfo.contact_number
                },
                employee: {
                    id: employee_id,
                    name: employeeInfo.name || 'Employee Name',
                    email: employeeInfo.email,
                    phone: employeeInfo.phone
                },
                period: {
                    start_date: startOfYear,
                    end_date: today,
                    generated_at: new Date().toISOString()
                },
                income: {
                    sales_of_product_income: productIncome,
                    tax_income: taxIncome,
                    discounts_given: -discountsGiven,
                    other_income: otherIncome,
                    total_income: totalIncome,
                    net_income: netIncome
                },
                cost_of_sales: {
                    cost_of_sales: costOfSales,
                    total_cost_of_sales: totalCostOfSales
                },
                expenses: {
                    operating_expenses: expenses,
                    other_expenses: otherExpenses,
                    total_expenses: expenses + otherExpenses
                },
                profitability: {
                    gross_profit: grossProfit,
                    net_earnings: netEarnings,
                    gross_profit_margin: parseFloat(grossProfitMargin.toFixed(2)),
                    net_profit_margin: parseFloat(netProfitMargin.toFixed(2))
                },
                cash_flow: {
                    total_invoiced: totalIncome,
                    total_paid: totalPaid,
                    outstanding_balance: outstandingBalance,
                    collection_rate: totalIncome > 0 ? parseFloat(((totalPaid / totalIncome) * 100).toFixed(2)) : 0
                },
                summary: {
                    total_revenue: totalIncome,
                    total_costs: totalCostOfSales + expenses + otherExpenses,
                    net_profit_loss: netEarnings,
                    is_profitable: netEarnings > 0
                }
            };

            return res.status(200).json({
                success: true,
                message: 'Profit and Loss data by Employee retrieved successfully',
                data: profitAndLossData
            });

        } catch (error) {
            console.error('Error in getProfitAndLossByEmployeeId:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    }

    static async getInvoicesByEmployeeId(req, res) {
        const { employee_id: employeeId, company_id: companyId } = req.params;
        const { start_date, end_date } = req.query;
        try {
            let sumExpression = 'COALESCE(SUM(i.total_amount), 0)';
            let paramsTotal = [companyId, employeeId];
            if (start_date && end_date) {
                sumExpression = 'COALESCE(SUM(CASE WHEN i.invoice_date >= ? AND i.invoice_date <= ? THEN i.total_amount ELSE 0 END), 0)';
                paramsTotal = [companyId, start_date, end_date, employeeId];
            }

            // Query to calculate total sales amount for a specific employee within a company (only paid/partially_paid)
            const totalSalesQuery = `
                SELECT
                    e.id AS employee_id,
                    e.name AS employee_name,
                    e.email AS employee_email,
                    ${sumExpression} AS total_sales_amount
                FROM
                    employees e
                LEFT JOIN
                    invoices i ON e.id = i.employee_id AND i.company_id = ? AND i.status IN ('paid', 'partially_paid', 'opened')
                WHERE
                    e.is_active = TRUE AND e.id = ?
                GROUP BY
                    e.id, e.name, e.email
            `;

            let whereDate = '';
            let paramsInvoices = [companyId, employeeId, companyId];
            if (start_date && end_date) {
                whereDate = ' AND i.invoice_date >= ? AND i.invoice_date <= ?';
                paramsInvoices = [companyId, employeeId, companyId, start_date, end_date];
            }

            // Query to fetch invoice details for the employee within a specific company (only paid/partially_paid)
            const invoicesQuery = `
                SELECT
                    i.id AS invoice_id,
                    i.invoice_number,
                    i.invoice_date,
                    i.customer_id,
                    i.company_id,
                    i.total_amount,
                    i.discount_amount,
                    i.status,
                    co.name AS company_name,
                    c.name AS customer_name
                FROM
                    employees e
                LEFT JOIN
                    invoices i ON e.id = i.employee_id AND i.company_id = ?
                LEFT JOIN
                    customer c ON i.customer_id = c.id
                LEFT JOIN
                    company co ON i.company_id = co.company_id
                WHERE
                    e.is_active = TRUE AND e.id = ? AND i.company_id = ? AND i.id IS NOT NULL 
                    AND i.status IN ('paid', 'partially_paid', 'opened', 'overdue')${whereDate}
                ORDER BY
                    i.invoice_date DESC
            `;

            // Execute the queries
            const [totalSalesResults] = await db.execute(totalSalesQuery, paramsTotal);
            const [invoicesResults] = await db.execute(invoicesQuery, paramsInvoices);

            if (totalSalesResults.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Employee not found or no sales data available for this company'
                });
            }

            const row = totalSalesResults[0];
            const salesReport = {
                employeeId: row.employee_id,
                employeeName: row.employee_name,
                employeeEmail: row.employee_email,
                totalSalesAmount: parseFloat(row.total_sales_amount).toFixed(2),
                invoices: invoicesResults.map(invoice => ({
                    invoiceId: invoice.invoice_id,
                    companyId: invoice.company_id,
                    companyName: invoice.company_name,
                    invoiceNumber: invoice.invoice_number,
                    invoiceDate: invoice.invoice_date,
                    discountAmount: parseFloat(invoice.discount_amount).toFixed(2),
                    totalAmount: parseFloat(invoice.total_amount).toFixed(2),
                    status: invoice.status,
                    customerId: invoice.customer_id,
                    customerName: invoice.customer_name
                }))
            };

            // Send the response
            res.status(200).json({
                success: true,
                data: salesReport,
                message: 'Sales report for the employee retrieved successfully'
            });
        } catch (error) {
            console.error('Error generating sales report for the employee:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate sales report for the employee',
                error: error.message
            });
        }
    };

    static async getProfitAndLossForAllEmployees(req, res) {
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

            // 1. INCOME CALCULATIONS PER EMPLOYEE
            const [productIncomeResult] = await db.execute(`
                SELECT 
                    e.id AS employee_id,
                    e.name AS employee_name,
                    COALESCE(SUM(ii.quantity * ii.actual_unit_price), 0) as product_income
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                INNER JOIN employees e ON i.employee_id = e.id
                WHERE i.company_id = ?
                AND e.is_active = TRUE
                AND i.status != 'proforma'
                ${dateCondition}
                GROUP BY e.id, e.name
            `, [company_id, ...dateParams]);

            const [discountsResult] = await db.execute(`
                SELECT 
                    e.id AS employee_id,
                    e.name AS employee_name,
                    COALESCE(SUM(i.discount_amount), 0) as discounts_given
                FROM invoices i
                INNER JOIN employees e ON i.employee_id = e.id
                WHERE i.company_id = ?
                AND e.is_active = TRUE
                AND i.status != 'proforma'
                ${dateCondition}
                GROUP BY e.id, e.name
            `, [company_id, ...dateParams]);

            const [taxIncomeResult] = await db.execute(`
                SELECT 
                    e.id AS employee_id,
                    e.name AS employee_name,
                    COALESCE(SUM(i.tax_amount), 0) as tax_income
                FROM invoices i
                INNER JOIN employees e ON i.employee_id = e.id
                WHERE i.company_id = ?
                AND e.is_active = TRUE
                AND i.status != 'proforma'
                ${dateCondition}
                GROUP BY e.id, e.name
            `, [company_id, ...dateParams]);

            // 2. COST OF SALES CALCULATIONS PER EMPLOYEE
            const [costOfSalesResult] = await db.execute(`
                SELECT 
                    e.id AS employee_id,
                    e.name AS employee_name,
                    COALESCE(SUM(ii.quantity * CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END), 0) as cost_of_sales
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                LEFT JOIN products p ON ii.product_id = p.id
                INNER JOIN employees e ON i.employee_id = e.id
                WHERE i.company_id = ?
                AND e.is_active = TRUE
                AND i.status != 'proforma'
                ${dateCondition}
                GROUP BY e.id, e.name
            `, [company_id, ...dateParams]);

            // 3. ADDITIONAL METRICS PER EMPLOYEE
            const [totalPaidResult] = await db.execute(`
                SELECT 
                    e.id AS employee_id,
                    e.name AS employee_name,
                    COALESCE(SUM(i.paid_amount), 0) as total_paid
                FROM invoices i
                INNER JOIN employees e ON i.employee_id = e.id
                WHERE i.company_id = ?
                AND e.is_active = TRUE
                AND i.status IN ('paid', 'partially_paid')
                ${dateCondition}
                GROUP BY e.id, e.name
            `, [company_id, ...dateParams]);

            const [outstandingResult] = await db.execute(`
                SELECT 
                    e.id AS employee_id,
                    e.name AS employee_name,
                    COALESCE(SUM(i.balance_due), 0) as outstanding_balance
                FROM invoices i
                INNER JOIN employees e ON i.employee_id = e.id
                WHERE i.company_id = ?
                AND e.is_active = TRUE
                AND i.balance_due > 0
                ${dateCondition}
                GROUP BY e.id, e.name
            `, [company_id, ...dateParams]);

            // 4. GET COMPANY DETAILS
            const [companyResult] = await db.execute(`
                SELECT name, address, email_address, contact_number
                FROM company
                WHERE company_id = ?
            `, [company_id]);

            // Prepare data for all employees
            const employeeData = {};
            const resultsMap = {
                productIncome: productIncomeResult,
                discounts: discountsResult,
                taxIncome: taxIncomeResult,
                costOfSales: costOfSalesResult,
                totalPaid: totalPaidResult,
                outstanding: outstandingResult
            };

            for (const [key, result] of Object.entries(resultsMap)) {
                result.forEach(row => {
                    if (!employeeData[row.employee_id]) {
                        employeeData[row.employee_id] = {
                            id: row.employee_id,
                            name: row.employee_name,
                            email: '',
                            phone: ''
                        };
                    }
                    if (key === 'productIncome') employeeData[row.employee_id].productIncome = parseFloat(row.product_income || 0);
                    if (key === 'discounts') employeeData[row.employee_id].discountsGiven = parseFloat(row.discounts_given || 0);
                    if (key === 'taxIncome') employeeData[row.employee_id].taxIncome = parseFloat(row.tax_income || 0);
                    if (key === 'costOfSales') employeeData[row.employee_id].costOfSales = parseFloat(row.cost_of_sales || 0);
                    if (key === 'totalPaid') employeeData[row.employee_id].totalPaid = parseFloat(row.total_paid || 0);
                    if (key === 'outstanding') employeeData[row.employee_id].outstandingBalance = parseFloat(row.outstanding_balance || 0);
                });
            }

            const employees = Object.values(employeeData).map(emp => {
                const totalIncome = emp.productIncome + emp.taxIncome;
                const netIncome = totalIncome - emp.discountsGiven;
                const grossProfit = netIncome - emp.costOfSales;
                const netEarnings = grossProfit;
                const grossProfitMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
                const netProfitMargin = totalIncome > 0 ? (netEarnings / totalIncome) * 100 : 0;

                return {
                    employee: {
                        id: emp.id,
                        name: emp.name,
                        email: emp.email,
                        phone: emp.phone
                    },
                    income: {
                        sales_of_product_income: emp.productIncome,
                        tax_income: emp.taxIncome,
                        discounts_given: -emp.discountsGiven,
                        total_income: totalIncome,
                        net_income: netIncome
                    },
                    cost_of_sales: {
                        cost_of_sales: emp.costOfSales,
                        total_cost_of_sales: emp.costOfSales
                    },
                    profitability: {
                        gross_profit: grossProfit,
                        net_earnings: netEarnings,
                        gross_profit_margin: parseFloat(grossProfitMargin.toFixed(2)),
                        net_profit_margin: parseFloat(netProfitMargin.toFixed(2))
                    },
                    cash_flow: {
                        total_invoiced: totalIncome,
                        total_paid: emp.totalPaid,
                        outstanding_balance: emp.outstandingBalance,
                        collection_rate: totalIncome > 0 ? parseFloat(((emp.totalPaid / totalIncome) * 100).toFixed(2)) : 0
                    }
                };
            });

            const companyInfo = companyResult[0] || {};

            return res.status(200).json({
                success: true,
                message: 'Profit and Loss data for all employees retrieved successfully',
                data: {
                    company: {
                        id: company_id,
                        name: companyInfo.name || 'Company Name',
                        address: companyInfo.address,
                        email: companyInfo.email_address,
                        phone: companyInfo.contact_number
                    },
                    period: {
                        start_date: startOfYear,
                        end_date: today,
                        generated_at: new Date().toISOString()
                    },
                    employees: employees
                }
            });

        } catch (error) {
            console.error('Error in getProfitAndLossForAllEmployees:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    };

    static async getInventoryShrinkageByCompanyId(req, res) {
        try {
            const { company_id } = req.params;

            if (!company_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID is required'
                });
            }

            const [inventoryShrinkageResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(
                        CASE 
                            WHEN p.quantity_on_hand > p.manual_count 
                            THEN (p.quantity_on_hand - p.manual_count) * p.cost_price 
                            ELSE 0 
                        END
                    ), 0) as inventory_shrinkage
                FROM products p
                WHERE p.company_id = ?
                AND p.is_active = TRUE
            `, [company_id]);

            const inventoryShrinkage = parseFloat(inventoryShrinkageResult[0]?.inventory_shrinkage || 0);

            return res.status(200).json({
                success: true,
                message: 'Inventory Shrinkage data retrieved successfully',
                data: {
                    company_id: company_id,
                    inventory_shrinkage: inventoryShrinkage
                }
            });

        } catch (error) {
            console.error('Error in getInventoryShrinkageByCompanyId:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    };

    static async getProfitAndLossForAllCustomers(req, res) {
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

            // 1. INCOME CALCULATIONS PER CUSTOMER
            const [productIncomeResult] = await db.execute(`
                SELECT 
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    COALESCE(SUM(ii.quantity * ii.actual_unit_price), 0) as product_income
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                INNER JOIN customer c ON i.customer_id = c.id
                WHERE i.company_id = ?
                AND c.is_active = TRUE
                AND i.status != 'proforma'
                ${dateCondition}
                GROUP BY c.id, c.name, c.email, c.phone
            `, [company_id, ...dateParams]);

            const [discountsResult] = await db.execute(`
                SELECT 
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    COALESCE(SUM(i.discount_amount), 0) as discounts_given
                FROM invoices i
                INNER JOIN customer c ON i.customer_id = c.id
                WHERE i.company_id = ?
                AND c.is_active = TRUE
                AND i.status != 'proforma'
                ${dateCondition}
                GROUP BY c.id, c.name, c.email, c.phone
            `, [company_id, ...dateParams]);

            const [taxIncomeResult] = await db.execute(`
                SELECT 
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    COALESCE(SUM(i.tax_amount), 0) as tax_income
                FROM invoices i
                INNER JOIN customer c ON i.customer_id = c.id
                WHERE i.company_id = ?
                AND c.is_active = TRUE
                AND i.status != 'proforma'
                ${dateCondition}
                GROUP BY c.id, c.name, c.email, c.phone
            `, [company_id, ...dateParams]);

            // 2. COST OF SALES CALCULATIONS PER CUSTOMER
            const [costOfSalesResult] = await db.execute(`
                SELECT 
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    COALESCE(SUM(ii.quantity * CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END), 0) as cost_of_sales
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                LEFT JOIN products p ON ii.product_id = p.id
                INNER JOIN customer c ON i.customer_id = c.id
                WHERE i.company_id = ?
                AND c.is_active = TRUE
                AND i.status != 'proforma'
                ${dateCondition}
                GROUP BY c.id, c.name, c.email, c.phone
            `, [company_id, ...dateParams]);

            // 3. ADDITIONAL METRICS PER CUSTOMER
            const [totalPaidResult] = await db.execute(`
                SELECT 
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    COALESCE(SUM(i.paid_amount), 0) as total_paid
                FROM invoices i
                INNER JOIN customer c ON i.customer_id = c.id
                WHERE i.company_id = ?
                AND c.is_active = TRUE
                AND i.status IN ('paid', 'partially_paid')
                ${dateCondition}
                GROUP BY c.id, c.name, c.email, c.phone
            `, [company_id, ...dateParams]);

            const [outstandingResult] = await db.execute(`
                SELECT 
                    c.id AS customer_id,
                    c.name AS customer_name,
                    c.email AS customer_email,
                    c.phone AS customer_phone,
                    COALESCE(SUM(i.balance_due), 0) as outstanding_balance
                FROM invoices i
                INNER JOIN customer c ON i.customer_id = c.id
                WHERE i.company_id = ?
                AND c.is_active = TRUE
                AND i.balance_due > 0
                ${dateCondition}
                GROUP BY c.id, c.name, c.email, c.phone
            `, [company_id, ...dateParams]);

            // 4. GET COMPANY DETAILS
            const [companyResult] = await db.execute(`
                SELECT name, address, email_address, contact_number
                FROM company
                WHERE company_id = ?
            `, [company_id]);

            // Prepare data for all customers
            const customerData = {};
            const resultsMap = {
                productIncome: productIncomeResult,
                discounts: discountsResult,
                taxIncome: taxIncomeResult,
                costOfSales: costOfSalesResult,
                totalPaid: totalPaidResult,
                outstanding: outstandingResult
            };

            for (const [key, result] of Object.entries(resultsMap)) {
                result.forEach(row => {
                    if (!customerData[row.customer_id]) {
                        customerData[row.customer_id] = {
                            id: row.customer_id,
                            name: row.customer_name,
                            email: row.customer_email || '',
                            phone: row.customer_phone || ''
                        };
                    }
                    if (key === 'productIncome') customerData[row.customer_id].productIncome = parseFloat(row.product_income || 0);
                    if (key === 'discounts') customerData[row.customer_id].discountsGiven = parseFloat(row.discounts_given || 0);
                    if (key === 'taxIncome') customerData[row.customer_id].taxIncome = parseFloat(row.tax_income || 0);
                    if (key === 'costOfSales') customerData[row.customer_id].costOfSales = parseFloat(row.cost_of_sales || 0);
                    if (key === 'totalPaid') customerData[row.customer_id].totalPaid = parseFloat(row.total_paid || 0);
                    if (key === 'outstanding') customerData[row.customer_id].outstandingBalance = parseFloat(row.outstanding_balance || 0);
                });
            }

            const customers = Object.values(customerData).map(customer => {
                const totalIncome = customer.productIncome + customer.taxIncome;
                const netIncome = totalIncome - customer.discountsGiven;
                const grossProfit = netIncome - customer.costOfSales;
                const netEarnings = grossProfit;
                const grossProfitMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
                const netProfitMargin = totalIncome > 0 ? (netEarnings / totalIncome) * 100 : 0;

                return {
                    customer: {
                        id: customer.id,
                        name: customer.name,
                        email: customer.email,
                        phone: customer.phone
                    },
                    income: {
                        sales_of_product_income: customer.productIncome,
                        tax_income: customer.taxIncome,
                        discounts_given: -customer.discountsGiven,
                        total_income: totalIncome,
                        net_income: netIncome
                    },
                    cost_of_sales: {
                        cost_of_sales: customer.costOfSales,
                        total_cost_of_sales: customer.costOfSales
                    },
                    profitability: {
                        gross_profit: grossProfit,
                        net_earnings: netEarnings,
                        gross_profit_margin: parseFloat(grossProfitMargin.toFixed(2)),
                        net_profit_margin: parseFloat(netProfitMargin.toFixed(2))
                    },
                    cash_flow: {
                        total_invoiced: totalIncome,
                        total_paid: customer.totalPaid,
                        outstanding_balance: customer.outstandingBalance,
                        collection_rate: totalIncome > 0 ? parseFloat(((customer.totalPaid / totalIncome) * 100).toFixed(2)) : 0
                    }
                };
            });

            const companyInfo = companyResult[0] || {};

            return res.status(200).json({
                success: true,
                message: 'Profit and Loss data for all customers retrieved successfully',
                data: {
                    company: {
                        id: company_id,
                        name: companyInfo.name || 'Company Name',
                        address: companyInfo.address,
                        email: companyInfo.email_address,
                        phone: companyInfo.contact_number
                    },
                    period: {
                        start_date: dateParams[0],
                        end_date: dateParams[dateParams.length - 1],
                        generated_at: new Date().toISOString()
                    },
                    customers: customers
                }
            });

        } catch (error) {
            console.error('Error in getProfitAndLossForAllCustomers:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    };


    static async getProfitAndLossByCustomerId(req, res) {
        try {
            const { company_id, customer_id } = req.params;
            const { start_date, end_date } = req.query;

            if (!company_id || !customer_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Company ID and Customer ID are required'
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

            // 1. INCOME CALCULATIONS
            // Sales of Product Income - Total revenue from products
            const [productIncomeResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(ii.quantity * ii.actual_unit_price), 0) as product_income
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                WHERE i.company_id = ? 
                AND i.customer_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, customer_id, ...dateParams]);

            // Discounts Given - Total discounts provided
            const [discountsResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.discount_amount), 0) as discounts_given
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.customer_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, customer_id, ...dateParams]);

            // Tax Income - Total tax collected
            const [taxIncomeResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.tax_amount), 0) as tax_income
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.customer_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, customer_id, ...dateParams]);

            // 2. COST OF SALES CALCULATIONS
            // Cost of Sales - Based on product cost prices
            const [costOfSalesResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(ii.quantity * CASE WHEN ii.cost_price > 0 THEN ii.cost_price ELSE p.cost_price END), 0) as cost_of_sales
                FROM invoices i
                INNER JOIN invoice_items ii ON i.id = ii.invoice_id
                LEFT JOIN products p ON ii.product_id = p.id
                WHERE i.company_id = ? 
                AND i.customer_id = ?
                AND i.status != 'proforma'
                ${dateCondition}
            `, [company_id, customer_id, ...dateParams]);

            // 3. OTHER INCOME AND EXPENSES
            const [otherIncomeResult] = await db.execute(`SELECT 0 as other_income`);
            const [expensesResult] = await db.execute(`SELECT 0 as expenses`);
            // Note: bills do not directly have customer_id.
            const [otherExpensesResult] = await db.execute(`SELECT 0 as other_expenses`);

            // 4. ADDITIONAL METRICS
            // Total Paid Amount - Actual cash received
            const [totalPaidResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.paid_amount), 0) as total_paid
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.customer_id = ?
                AND i.status IN ('paid', 'partially_paid')
                ${dateCondition}
            `, [company_id, customer_id, ...dateParams]);

            // Outstanding Balance - Amount still owed
            const [outstandingResult] = await db.execute(`
                SELECT 
                    COALESCE(SUM(i.balance_due), 0) as outstanding_balance
                FROM invoices i
                WHERE i.company_id = ? 
                AND i.customer_id = ?
                AND i.balance_due > 0
                ${dateCondition}
            `, [company_id, customer_id, ...dateParams]);

            // 5. GET COMPANY AND CUSTOMER DETAILS
            const [companyResult] = await db.execute(`
                SELECT name, address, email_address, contact_number
                FROM company
                WHERE company_id = ?
            `, [company_id]);

            const [customerResult] = await db.execute(`
                SELECT name, email, phone
                FROM customer
                WHERE id = ? AND company_id = ?
            `, [customer_id, company_id]);

            // Extract values
            const productIncome = parseFloat(productIncomeResult[0]?.product_income || 0);
            const discountsGiven = parseFloat(discountsResult[0]?.discounts_given || 0);
            const taxIncome = parseFloat(taxIncomeResult[0]?.tax_income || 0);
            const costOfSales = parseFloat(costOfSalesResult[0]?.cost_of_sales || 0);
            const otherIncome = parseFloat(otherIncomeResult[0]?.other_income || 0);
            const expenses = parseFloat(expensesResult[0]?.expenses || 0);
            const otherExpenses = parseFloat(otherExpensesResult[0]?.other_expenses || 0);
            const totalPaid = parseFloat(totalPaidResult[0]?.total_paid || 0);
            const outstandingBalance = parseFloat(outstandingResult[0]?.outstanding_balance || 0);
            const companyInfo = companyResult[0] || {};
            const customerInfo = customerResult[0] || {};

            // 6. CALCULATE TOTALS AND DERIVED METRICS
            const totalIncome = productIncome + taxIncome;
            const netIncome = totalIncome - discountsGiven;
            const totalCostOfSales = costOfSales;
            const grossProfit = netIncome - totalCostOfSales;
            const netEarnings = grossProfit + otherIncome - expenses - otherExpenses;
            const grossProfitMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
            const netProfitMargin = totalIncome > 0 ? (netEarnings / totalIncome) * 100 : 0;

            // 7. PREPARE RESPONSE DATA
            const profitAndLossData = {
                company: {
                    id: company_id,
                    name: companyInfo.name || 'Company Name',
                    address: companyInfo.address,
                    email: companyInfo.email_address,
                    phone: companyInfo.contact_number
                },
                customer: {
                    id: customer_id,
                    name: customerInfo.name || 'Customer Name',
                    email: customerInfo.email,
                    phone: customerInfo.phone
                },
                period: {
                    start_date: startOfYear,
                    end_date: today,
                    generated_at: new Date().toISOString()
                },
                income: {
                    sales_of_product_income: productIncome,
                    tax_income: taxIncome,
                    discounts_given: -discountsGiven,
                    other_income: otherIncome,
                    total_income: totalIncome,
                    net_income: netIncome
                },
                cost_of_sales: {
                    cost_of_sales: costOfSales,
                    total_cost_of_sales: totalCostOfSales
                },
                expenses: {
                    operating_expenses: expenses,
                    other_expenses: otherExpenses,
                    total_expenses: expenses + otherExpenses
                },
                profitability: {
                    gross_profit: grossProfit,
                    net_earnings: netEarnings,
                    gross_profit_margin: parseFloat(grossProfitMargin.toFixed(2)),
                    net_profit_margin: parseFloat(netProfitMargin.toFixed(2))
                },
                cash_flow: {
                    total_invoiced: totalIncome,
                    total_paid: totalPaid,
                    outstanding_balance: outstandingBalance,
                    collection_rate: totalIncome > 0 ? parseFloat(((totalPaid / totalIncome) * 100).toFixed(2)) : 0
                },
                summary: {
                    total_revenue: totalIncome,
                    total_costs: totalCostOfSales + expenses + otherExpenses,
                    net_profit_loss: netEarnings,
                    is_profitable: netEarnings > 0
                }
            };

            return res.status(200).json({
                success: true,
                message: 'Profit and Loss data by Customer retrieved successfully',
                data: profitAndLossData
            });

        } catch (error) {
            console.error('Error in getProfitAndLossByCustomerId:', error);
            return res.status(500).json({
                success: false,
                message: 'Internal server error',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
            });
        }
    }

}

module.exports = ReportController;