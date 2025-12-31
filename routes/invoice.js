const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const authorizedRoles = require('../middleware/authorized-roles');
const multer = require('multer');
const path = require('path');

const {
  getInvoices,
  createInvoice,
  updateInvoice,
  getInvoiceItems,
  deleteInvoice,
  getInvoiceById,
  getSalesPageDate,
  getInvoicesByCustomer,
  recordPayment,
  checkCustomerEligibility,
  cancelInvoice,
  processRefund,
  getInvoiceRefunds,
  getInvoicePayments,
  updatePayment
} = require('../controllers/invoice_controller');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/invoices/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx|jpg|jpeg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, JPEG, and PNG are allowed.'));
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Routes
router.get(
  '/getInvoice/:company_id',
  verifyToken,
  authorizedRoles(['admin', 'sale', 'staff']),
  getInvoices
);

router.get(
  '/getInvoiceById/:company_id/:invoiceId',
  verifyToken,
  authorizedRoles(['admin', 'sale', 'staff']),
  getInvoiceById
)

router.post(
  '/createInvoice/:company_id',
  verifyToken,
  authorizedRoles(['admin', 'staff']), // Removed 'sale'
  upload.single('attachment'),
  createInvoice
);

router.put(
  '/updateInvoice/:company_id/:invoiceId',
  verifyToken,
  authorizedRoles(['admin', 'staff']), // Removed 'sale'
  upload.single('attachment'),
  updateInvoice
);

router.delete(
  '/deleteInvoice/:company_id/:invoiceId',
  verifyToken,
  authorizedRoles(['admin', 'staff']), // Removed 'sale'
  deleteInvoice
)

router.get(
  '/getInvoiceItems/:company_id/:invoiceId',
  verifyToken,
  authorizedRoles(['admin', 'sale', 'staff']),
  getInvoiceItems
)

router.get(
  '/getInvoicesByCustomer/:company_id/:customerId',
  verifyToken,
  authorizedRoles(['admin', 'sale', 'staff']),
  getInvoicesByCustomer
);

router.post(
  '/recordInvoicePayment/:company_id/:customerId',
  verifyToken,
  authorizedRoles(['admin', 'staff']), // Removed 'sale'
  recordPayment
);

router.post(
  '/checkCustomerEligibility',
  verifyToken,
  checkCustomerEligibility
);

router.get(
  '/getSalesPageData/:company_id',
  verifyToken,
  authorizedRoles(['admin', 'sale', 'staff']),
  getSalesPageDate
);

router.post(
  '/cancelInvoice/:company_id',
  verifyToken,
  authorizedRoles(['admin']),
  cancelInvoice
);

// Frontend Compatibility Route
router.post(
  '/invoice/cancelInvoice/:company_id',
  verifyToken,
  authorizedRoles(['admin']),
  cancelInvoice
);

router.post(
  '/processRefund/:company_id',
  verifyToken,
  authorizedRoles(['admin', 'sale', 'staff']),
  processRefund
);

router.get(
  '/getInvoiceRefunds/:company_id/:invoice_id',
  verifyToken,
  authorizedRoles(['admin', 'sale', 'staff']),
  getInvoiceRefunds
);

router.get(
  '/getInvoicePayments/:company_id/:invoiceId',
  verifyToken,
  authorizedRoles(['admin', 'sale', 'staff']),
  getInvoicePayments
);

router.put(
  '/updatePayment/:company_id/:paymentId',
  verifyToken,
  authorizedRoles(['admin', 'staff']), // Limit update to admin/staff
  updatePayment
);

module.exports = router;