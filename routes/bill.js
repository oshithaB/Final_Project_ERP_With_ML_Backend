const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

const {
    createBill,
    getAllBills,
    getBillItemsById,
    updateBill,
    getBillsByVendor,
    recordPayment
} = require('../controllers/bill_controller');

router.post(
    '/createBill/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'store_keeper']),
    createBill
);

router.get(
    '/getAllBills/:company_id',
    verifyToken,
    authorizedRoles(['admin', 'store_keeper']),
    getAllBills
);

router.get(
    '/getBillItems/:company_id/:bill_id',
    verifyToken,
    authorizedRoles(['admin', 'store_keeper']),
    getBillItemsById
);

router.put(
    '/updateBill/:company_id/:bill_id',
    verifyToken,
    authorizedRoles(['admin', 'store_keeper']),
    updateBill
);

router.get('/getBillsByVendor/:company_id/:vendor_id',
    verifyToken,
    authorizedRoles(['admin', 'store_keeper']),
    getBillsByVendor
);

router.post(
    '/recordBillPayment/:company_id/:vendor_id',
    verifyToken,
    authorizedRoles(['admin', 'store_keeper']),
    recordPayment
);

module.exports = router;

