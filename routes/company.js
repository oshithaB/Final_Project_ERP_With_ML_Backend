const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');
const upload = require('../middleware/upload');

const {
  createCompany,
  selectCompany,
  getCompanies,
  getDashboardData,
  updateCompany,
  deleteCompany,
  getMoneyInDrawerByCompany,
  getCompanyById,
  getNextNumbers
} = require('../controllers/company_controller');

// Upload single image with field name 'logo'
router.post(
  '/createCompany',
  verifyToken,
  authorizedRoles(['admin']), // Ensure only admin can create company
  upload.single('logo'),  // Changed from 'companyLogo' to 'logo'
  createCompany
);

router.get(
  '/selectCompany/:companyId',
  verifyToken,
  selectCompany
);

router.get(
  '/companies',
  verifyToken,
  getCompanies
);

router.get(
  '/dashboard/:companyId',
  verifyToken,
  getDashboardData
);

router.put(
  '/companies/:companyId',
  verifyToken,
  authorizedRoles(['admin']),
  upload.single('logo'),
  updateCompany
);

// Frontend Compatibility Route: Update Company
router.put(
  '/company/update/:companyId',
  verifyToken,
  authorizedRoles(['admin']),
  upload.single('logo'),
  updateCompany
);

// Frontend Compatibility Route: Get Company By ID
router.get(
  '/company/:companyId',
  verifyToken,
  getCompanyById
);

// Frontend Compatibility Route: Get Next Numbers
router.get(
  '/company/next-numbers/:companyId',
  verifyToken,
  getNextNumbers
);

router.delete(
  '/companies/:companyId',
  verifyToken,
  authorizedRoles(['admin']),
  deleteCompany
);

router.get(
  '/moneyInDrawer/:company_id',
  getMoneyInDrawerByCompany
);

module.exports = router;