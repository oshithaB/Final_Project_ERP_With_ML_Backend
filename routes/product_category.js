const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

const {
    createCategory,
    getCategories,
    updateCategory,
    deleteCategory
} = require('../controllers/product_category_controller');

// Category routes
router.post(
    '/createCategory/:company_id',
    verifyToken,
    authorizedRoles(['admin']),
    createCategory
);

router.get(
    '/getCategories/:company_id',
    verifyToken,
    getCategories
);

router.put(
    '/updateCategory/:company_id/:id',
    verifyToken,
    authorizedRoles(['admin']),
    updateCategory
);

router.put(
    '/deleteCategories/softDelete/:company_id/:id',
    verifyToken,
    authorizedRoles(['admin']),
    deleteCategory
);

// router.delete(
//     '/categories/:company_id/:id',
//     verifyToken,
//     authorizedRoles(['admin']),
//     permanentDeleteCategory
// );

module.exports = router;