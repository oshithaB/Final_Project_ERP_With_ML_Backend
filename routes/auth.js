const express = require('express');
const router = express.Router();

const {
    authenticateUser,
    verifyUser,
    verifyOTP,
    resendOTP,
    resetPassword
} = require("../controllers/auth_controller");

router.post('/login', authenticateUser);

router.post('/userVerification', verifyUser);

router.post('/OTPVerification', verifyOTP);

router.post('/resendOTP', resendOTP);

router.post('/resetPassword', resetPassword);

module.exports = router;
