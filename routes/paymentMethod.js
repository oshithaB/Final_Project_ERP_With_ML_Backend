const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

const {
    createPaymentMethod,
    getPaymentMethods,
    createDepositPurposes,
    getDepositPurposes
} = require('../controllers/paymentMethod_controller');

router.post(
    '/createPaymentMethod',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    createPaymentMethod
);

router.get(
    '/getPaymentMethods',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    getPaymentMethods
);

router.post(
    '/createDepositPurposes',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    createDepositPurposes
);

router.get(
    '/getDepositPurposes',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    getDepositPurposes
)

module.exports = router;