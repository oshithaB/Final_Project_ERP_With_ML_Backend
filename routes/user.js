const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');

const { 
    getUserDetails,
    addUser,
    updateUser,
    updateUserById,
    softDeleteUser,
    // permanentlyDeleteUser
} = require('../controllers/user_controller');

router.get('/getUserDetails', verifyToken, getUserDetails);
router.post('/addUser', verifyToken, authorizedRoles('admin'), addUser);
router.put('/updateUser', verifyToken, updateUser);
router.put('/updateUser/:userId', verifyToken, authorizedRoles(['admin']), updateUserById);
router.put('/softDeleteUser/:userId', verifyToken, authorizedRoles('admin'), softDeleteUser);
// router.delete('/permanentlyDeleteUser/:userId', verifyToken, authorizedRoles('admin'), permanentlyDeleteUser);

module.exports = router;