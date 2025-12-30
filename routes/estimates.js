const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

const {
    getEstimates,
    createEstimate,
    deleteEstimate,
    editEstimate,
    getEstimatesItems,
    convertEstimateToInvoice,
    getEstimatesByCustomer,
    updateEstimateAfterInvoice
} = require('../controllers/estimate_controller');

router.get(
    '/getEstimates/:companyId',
    verifyToken,
    getEstimates
);

router.post(
    '/createEstimates/:companyId',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    createEstimate
);

router.put(
    '/editEstimate/:company_id/:estimateId',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    editEstimate
);


router.delete(
    '/deleteEstimate/:company_id/:estimateId',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    deleteEstimate
);

router.get(
    '/estimatesItems/:companyId/:estimateId',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    getEstimatesItems
);

router.get(
    '/getEstimatesByCustomer/:companyId/:customerId',
    verifyToken,
    authorizedRoles(['admin', 'sale', 'staff']),
    getEstimatesByCustomer
);

router.post(
    '/convertEstimateToInvoice/:companyId/:estimateId',
    verifyToken,
    authorizedRoles(['admin', 'staff']), // Removed 'sale'
    convertEstimateToInvoice
);

router.post(
    '/updateEstimateAfterInvoice/:companyId/:estimateId',
    verifyToken,
    authorizedRoles(['admin', 'staff']), // Removed 'sale'
    updateEstimateAfterInvoice
);

module.exports = router;