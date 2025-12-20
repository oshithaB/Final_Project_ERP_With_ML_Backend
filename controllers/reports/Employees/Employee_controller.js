const db = require('../../../DB/db');

// Get employee contact details
const getEmployeeContacts = async (req, res) => {
    const { company_id } = req.params;
    try {
      const [rows] = await db.query(
        `SELECT 
            id,
            name,
            email,
            phone,
            address
         FROM employees
         WHERE is_active = TRUE`,
        [company_id]
      );
  
      if (rows.length === 0) {
        return res.status(404).json({
          status: 'error',
          message: 'Employee not found',
        });
      }
  
      res.status(200).json({
        status: 'success',
        data: rows,
      });
    } catch (error) {
      console.error('Error fetching employee contacts:', error);
      res.status(500).json({
        status: 'error',
        message: 'Internal server error',
      });
    }
};

module.exports = {
    getEmployeeContacts,
};