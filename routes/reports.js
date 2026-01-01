const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reports/profit&lossreport_controller');
const commissionReportController = require('../controllers/reports/commissionreport_controller');
const salesReportController = require('../controllers/reports/salesreport_controller');
const aragingReportController = require('../controllers/reports/ar_aging_controller');
const balanceSheetController = require('../controllers/reports/balancesheet_controller');
const salesAndCustomerController = require('../controllers/reports/Sales&Customers/sales$customers_controller');
const employeeController = require('../controllers/reports/Employees/Employee_controller');
const salesTaxController = require('../controllers/reports/SalesTax/sales_tax_controller');
const expensesAndSuppliersController = require('../controllers/reports/Expenses&Suppliers/expenses_and_suppliers');
const whoOwesYouController = require('../controllers/reports/WhoOwesYou/whoOwesYou_controller');
const whatYouOweController = require('../controllers/reports/WhatYouOwe/whatYouOwe_controller');
const forMyAccountController = require('../controllers/reports/ForMyAccount/forMyAccount_controller');
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

// Importing profit and loss report controller functions
const {
    getProfitAndLossData,
    getMonthlyProfitAndLoss,
    getProfitAndLossByEmployeeId,
    getProfitAndLossByCustomerId,
    getProfitAndLossForAllEmployees,
    getInventoryShrinkageByCompanyId,
    getInvoicesByEmployeeId,
    getProfitAndLossForAllCustomers,
} = reportController;

// Importing commission report controller functions
const {
    getCommissionReport,
    getCommissionReportByEmployeeId
} = commissionReportController;

// Importing sales report controller functions
const {
    getSalesReport,
    getSalesReportByEmployeeId
} = salesReportController;

// Importing A/R Aging report controller functions
const {
    getARAgingSummary,
    getCustomerInvoices,
    getARAgingSummaryInDetails,
} = aragingReportController;

// Importing balance sheet report controller functions
const {
    getBalanceSheetData,
    getFormattedBalanceSheet,
} = balanceSheetController;

// Import who owes you controller functions
const {
    getOpenInvoices,
    getCollectionReport,
    getCustomerBalanceSummary,
    getCustomerBalanceDetail,
    getInvoiceList,
    getTermsList,
    getStatementList,
    getUnbilledCharges,
    getUnbilledTime,
} = whoOwesYouController

// Import what you owe controller functions
const {
    getSupplierBalanceSummary,
    getSupplierBalanceDetail,
    getAPAgingSummary,
    getAPAgingSummaryInDetails,
    billAndAppliedPayments,
    unpaidBills,
} = whatYouOweController


// Importing customer contact controller functions
const {
    getCustomerContacts,
    getSalesByEmployeeSummary,
    getSalesByCustomerSummary,
    getSalesByCustomerDetail,
    getSalesByEmployeeDetail,
    getDepositDetail,
    getEstimatesByCustomer,
    getInventoryValuationSummary,
    getInventoryValuationDetail,
    getPaymentMethodList,
    getStockTakeWorksheet,
    updateProductManualCount,
    getTimeActivitiesByCustomerDetail,
    getTransactionListByCustomer,
    getProductServiceList,
    getSalesByProductServiceSummary,
    getSalesByProductServiceDetail,
    getIncomeByCustomerSummary,
    getCustomerPhoneList,
    getSalesByCustomerIDDetail,
    getInventoryValuationSummaryExcel,
    getProductServiceListExcel,
    getStockTakeWorksheetExcel
} = salesAndCustomerController;

// Importing expenses and suppliers controller functions
const {
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
} = expensesAndSuppliersController;

// Importing sales tax controller functions
const {
    SSCL100percentTaxDetail,
    VAT18percentTaxDetail,
    SSCL100percentTaxException,
    VAT18percentTaxException,
    SSCL100percentTaxSummary,
    VAT18percentTaxSummary,
    taxLiabilityReport,
    transactionDetailByTaxCode
} = salesTaxController;


// Importing employee report controller functions
const {
    getEmployeeContacts,
} = employeeController;

// Importing for my account controller functions
const {
    getTrialBalance,
    getTrialBalanceByAccountType,
    getDetailedTrialBalance,
} = forMyAccountController;

//====================================================================================================================

// Profit and Loss Report Routes
router.get(
    '/profit-and-loss/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getProfitAndLossData
);

router.get(
    '/monthly-profit-and-loss/:company_id/:year',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getMonthlyProfitAndLoss
);

router.get(
    '/profit-and-loss-by-emp/:company_id/:employee_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getProfitAndLossByEmployeeId
);

router.get(
    '/invoices-by-employee/:company_id/:employee_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getInvoicesByEmployeeId
);

router.get(
    '/profit-and-loss-by-cust/:company_id/:customer_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getProfitAndLossByCustomerId
);

router.get(
    '/profit-and-loss-all-employees/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getProfitAndLossForAllEmployees
);

router.get(
    '/inventory-shrinkage/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getInventoryShrinkageByCompanyId
);

router.get(
    '/profit-and-loss-all-customers/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getProfitAndLossForAllCustomers
);

// Commission Report Route ================================================================================================
router.get(
    '/commission-report',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getCommissionReport
);

router.get(
    '/commission-report/:employeeId',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getCommissionReportByEmployeeId
);

// Sales Report Route ====================================================================================================
router.get(
    '/sales-report',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesReport
);

router.get(
    '/sales-report/:employeeId',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesReportByEmployeeId
);

// Balance Sheet Report Route ========================================================================================
router.get(
    '/balance-sheet/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getBalanceSheetData
);

router.get(
    '/formatted-balance-sheet/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getFormattedBalanceSheet
);

// Who Owes you routes ===============================================================================================
router.get(
    '/ar-aging-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getARAgingSummary
);

router.get(
    '/customer-invoices/:company_id/:customer_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getCustomerInvoices
);

router.get(
    '/ar-aging-summary-details/:customer_id/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getARAgingSummaryInDetails
);

router.get(
    '/open-invoices/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getOpenInvoices
);

router.get(
    '/invoice-list/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getInvoiceList
);

router.get(
    '/customer-balance-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getCustomerBalanceSummary
);

router.get(
    '/customer-balance-detail/:company_id/:customer_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getCustomerBalanceDetail
);

// What owe you routes ========================================================================================
router.get(
    '/supplier-balance-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSupplierBalanceSummary
);

router.get(
    '/supplier-balance-detail/:company_id/:vendor_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSupplierBalanceDetail
);

router.get(
    '/ap-aging-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getAPAgingSummary
);

router.get(
    '/bill-and-applied-payments/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    billAndAppliedPayments
);

router.get(
    '/ap-aging-summary-details/:vendor_id/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getAPAgingSummaryInDetails
);

router.get(
    '/unpaid-bills/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    unpaidBills
);


// Expenses and Suppliers routes ========================================================================================
router.get(
    '/vendor-contacts/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getVendorsContactDetails
);

router.get(
    '/cheque-details/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getChequeDetails
);

router.get(
    '/purchases-by-product-service-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getPurchasesByProductServiceSummary
);

router.get(
    '/purchases-by-class-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getPurchasesByClassDetail
);

router.get(
    '/open-purchase-orders-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getOpenPurchaseOrdersDetail
);

router.get(
    '/purchase-list/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getPurchaseList
);

router.get(
    '/purchases-by-supplier-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getPurchasesBySupplierSummary
);

router.get(
    '/open-purchase-orders-list/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getOpenPurchaseOrdersList
);

router.get(
    '/expense-by-supplier-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getExpenseBySupplierSummary
);

router.get(
    '/expense-by-supplier-detail/:company_id/:payee_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getExpenseBySupplierDetail
);


// Sales and Customer routes =======================================================================================
router.get(
    '/customer-contacts/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getCustomerContacts
);

router.get(
    '/sales-by-employee-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesByEmployeeSummary
);

router.get(
    '/sales-by-customer-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesByCustomerSummary
);

router.get(
    '/sales-by-customer-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesByCustomerDetail
);

router.get(
    '/sales-by-employee-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesByEmployeeDetail
);

router.get(
    '/deposit-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getDepositDetail
);

router.get(
    '/estimates-by-customer/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getEstimatesByCustomer
);

router.get(
    '/inventory-valuation-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getInventoryValuationSummary
);

router.get(
    '/inventory-valuation-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getInventoryValuationDetail
);

router.get(
    '/payment-methods/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getPaymentMethodList
);

router.get(
    '/stock-take-worksheet/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getStockTakeWorksheet
);

router.put(
    '/update-product-manual-count/:company_id/:product_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    updateProductManualCount
);

router.get(
    '/time-activities-by-customer-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getTimeActivitiesByCustomerDetail
);

router.get(
    '/transaction-list-by-customer/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getTransactionListByCustomer
);

router.get(
    '/product-service-list/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getProductServiceList
);

router.get(
    '/sales-by-product-service-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesByProductServiceSummary
);

router.get(
    '/sales-by-product-service-detail/:company_id/:product_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesByProductServiceDetail
);

router.get(
    '/income-by-customer-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getIncomeByCustomerSummary
);

router.get(
    '/customer-phone-list/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getCustomerPhoneList
);

router.get(
    '/sales-by-customerid-detail/:company_id/:customer_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getSalesByCustomerIDDetail
);

router.get(
    '/inventory-valuation-summary-excel/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getInventoryValuationSummaryExcel
);

router.get(
    '/product-service-list-excel/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getProductServiceListExcel
);

router.get(
    '/stock-take-worksheet-excel/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getStockTakeWorksheetExcel
);

// Sales Tax routes ===========================================================================================================
router.get(
    '/sscl-100percent-tax-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    SSCL100percentTaxDetail
);

router.get(
    '/vat-18percent-tax-detail/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    VAT18percentTaxDetail
);

router.get(
    '/sscl-100percent-tax-exception/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    SSCL100percentTaxException
);

router.get(
    '/vat-18percent-tax-exception/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    VAT18percentTaxException
);

router.get(
    '/sscl-100percent-tax-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    SSCL100percentTaxSummary
);

router.get(
    '/vat-18percent-tax-summary/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    VAT18percentTaxSummary
);

router.get(
    '/tax-liability-report/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    taxLiabilityReport
);

router.get(
    '/transaction-detail-by-tax-code/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    transactionDetailByTaxCode
);

// Employee routes ==========================================================================================================
router.get(
    '/employee-contacts',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getEmployeeContacts
);

module.exports = router;

// For My Account routes ==========================================================================================
router.get(
    '/trial-balance/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getTrialBalance
);

router.get(
    '/trial-balance-by-account-type/:company_id/:account_type',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getTrialBalanceByAccountType
);

router.get(
    '/detailed-trial-balance/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'accountant']),
    getDetailedTrialBalance
);
