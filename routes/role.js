const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

const {
    getAllRoles,
    addRole,
    updateRole
} = require('../controllers/role_controller');

router.get('/getAllRoles', verifyToken, authorizedRoles(['admin']), getAllRoles);
router.post('/addRole', verifyToken, authorizedRoles(['admin']), addRole);
router.put('/updateRole/:roleId', verifyToken, authorizedRoles(['admin']), updateRole);

module.exports = router;
