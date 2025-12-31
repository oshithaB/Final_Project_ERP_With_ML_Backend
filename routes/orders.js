const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order_controller');
const vendorController = require('../controllers/vendor_controller');
const employeeController = require('../controllers/employee_controller');
const customerController = require('../controllers/customer_controller');
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

// Order routes
// Order routes - Purchase Orders are for Admin and Store Keeper
router.get('/orders/count/:companyId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.getOrderCount);
router.get('/getOrders/:companyId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.getOrders);
router.get('/orders/:companyId/:orderId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.getOrder);
router.post('/orders/:companyId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.createOrder);
router.put('/orders/:companyId/:orderId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.updateOrder);
router.delete('/orders/:companyId/:orderId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.deleteOrder);
router.get('/order-items/:companyId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.getOrderItems);
router.get('/order-items/:companyId/:orderId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.getOrderItemsByOrder);
router.post('/order-items/:companyId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.createOrderItem);
router.delete('/order-items/:companyId/:orderId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.deleteOrderItems);
router.get('/stats/:companyId', verifyToken, authorizedRoles(['admin', 'store_keeper']), orderController.getPurchaseStats);

// Vendor routes
router.get('/vendors/:companyId', vendorController.getVendors);

// Employee routes
router.get('/employees', employeeController.getEmployees);

// Customer routes
router.get('/customers/:companyId', customerController.getCustomers);

module.exports = router;