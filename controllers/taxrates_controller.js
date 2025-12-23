const db = require('../DB/db');

const getTaxRatesByCompanyId = async (req, res) => {
  const companyId = req.params.companyId;

  try {
    const taxRates = await db.query('SELECT * FROM tax_rates WHERE company_id = ?', [companyId]);
    res.status(200).json(taxRates);
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

module.exports = {
  getTaxRatesByCompanyId
};