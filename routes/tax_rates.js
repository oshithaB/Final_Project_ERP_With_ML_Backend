const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

const {
  getTaxRatesByCompanyId
} = require('../controllers/taxrates_controller');

router.get('/tax-rates/:companyId', verifyToken, getTaxRatesByCompanyId);

module.exports = router;