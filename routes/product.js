const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

const {
    getProducts,
    createProduct,
    updateProduct,
    deleteProduct,
    getCategories,
    getVendors,
    getEmployees,
    adjustStock
} = require('../controllers/product_controller');

// Everyone (including store_keeper) needs access to view products
router.get('/getProducts/:company_id', verifyToken, authorizedRoles(['admin', 'sale', 'staff', 'store_keeper']), getProducts);

// Staff can CREATE but NOT EDIT or DELETE
router.post('/products/:company_id', verifyToken, authorizedRoles(['admin', 'staff']), createProduct);
router.put('/products/:company_id/:product_id', verifyToken, authorizedRoles(['admin']), updateProduct);
router.put('/adjust-stock/:company_id/:product_id', verifyToken, authorizedRoles(['admin']), adjustStock);
router.delete('/products/:company_id/:product_id', verifyToken, authorizedRoles(['admin']), deleteProduct);

router.get('/products/:company_id/categories', verifyToken, getCategories);
router.get('/products/:company_id/vendors', verifyToken, getVendors);
router.get('/products/employees', verifyToken, getEmployees);

module.exports = router;