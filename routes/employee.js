const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');
const { 
    createEmployee,
    getEmployees,
    updateEmployee,
    deleteEmployee,
    getRoles,
    getUserByEmployeeId
} = require('../controllers/employee_controller');

router.get(
    '/roles',
    verifyToken,
    authorizedRoles(['admin']),
    getRoles
);

router.post(
    '/employees',
    verifyToken,
    authorizedRoles(['admin']),
    createEmployee
);

router.get(
    '/employees',
    verifyToken,
    getEmployees
);

router.put(
    '/employees/:id',
    verifyToken,
    authorizedRoles(['admin']),
    updateEmployee
);

router.delete(
    '/employees/:id',
    verifyToken,
    authorizedRoles(['admin']),
    deleteEmployee
);

router.get(
    '/users/by-employee/:id',
    verifyToken,
    getUserByEmployeeId
);

module.exports = router;