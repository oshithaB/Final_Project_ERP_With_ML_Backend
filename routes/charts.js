const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');
const {
    getTop10Products,
    getTop5Salespersons,
    getMonthlySalesTrend,
    getCustomerPurchaseFrequency,
    getCategorySalesDistribution,
    getPaymentMethodDistribution,
    getMonthlySalesTrendComparison,
} = require('../controllers/chart_controller');

// Route for top 10 products
router.get(
    '/top10Products/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'sale']),
    async (req, res, next) => {
        try {
            const companyId = req.params.company_id;
            const products = await getTop10Products(companyId);
            res.json({ success: true, data: products });
        } catch (error) {
            next(error); // Pass error to Express error handler
        }
    }
);

// Route for top 5 salespersons
router.get(
    '/top5Salespersons/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'sale']),
    async (req, res, next) => {
        try {
            const companyId = req.params.company_id;
            const salespersons = await getTop5Salespersons(companyId);
            res.json({ success: true, data: salespersons });
        } catch (error) {
            next(error);
        }
    }
);

// Route for monthly sales trend
router.get(
    '/monthlySalesTrend/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'sale']),
    async (req, res, next) => {
        try {
            const companyId = req.params.company_id;
            const salesTrend = await getMonthlySalesTrend(companyId);
            res.json({ success: true, data: salesTrend });
        } catch (error) {
            next(error);
        }
    }
);

// Route for customer purchase frequency
router.get(
    '/customerPurchaseFrequency/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'sale']),
    async (req, res, next) => {
        try {
            const companyId = req.params.company_id;
            const purchaseFrequency = await getCustomerPurchaseFrequency(companyId);
            res.json({ success: true, data: purchaseFrequency });
        } catch (error) {
            next(error);
        }
    }
);

// Route for category sales distribution
router.get(
    '/categorySalesDistribution/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'sale']),
    async (req, res, next) => {
        try {
            const companyId = req.params.company_id;
            const categoryDistribution = await getCategorySalesDistribution(companyId);
            res.json({ success: true, data: categoryDistribution });
        } catch (error) {
            next(error);
        }
    }
);

// Route for payment method distribution
router.get(
    '/paymentMethodDistribution/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'sale']),
    async (req, res, next) => {
        try {
            const companyId = req.params.company_id;
            const paymentDistribution = await getPaymentMethodDistribution(companyId);
            res.json({ success: true, data: paymentDistribution });
        } catch (error) {
            next(error);
        }
    }
);

// Route for monthly sales trend comparison
router.get(
    '/monthlySalesTrendComparison/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'staff', 'sale']),
    async (req, res, next) => {
        try {
            const companyId = req.params.company_id;
            const salesTrendComparison = await getMonthlySalesTrendComparison(companyId);
            res.json({ success: true, data: salesTrendComparison });
        } catch (error) {
            next(error);
        }
    }
);

module.exports = router;