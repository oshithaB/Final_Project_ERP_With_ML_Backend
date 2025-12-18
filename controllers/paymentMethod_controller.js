const db = require('../DB/db');

const createPaymentMethod = async (req, res) => {
  const { name } = req.body;

  // Check if name is provided
  if (!name || name.trim() === "") {
    return res.status(400).json({ error: 'Payment method name is required.' });
  }

  try {
    const query = 'INSERT INTO payment_methods (name) VALUES (?)';
    const [result] = await db.execute(query, [name.trim()]);
    
    res.status(201).json({ 
      message: 'Payment method created successfully.',
      paymentMethodId: result.insertId,
      name: name.trim()
    });
  } catch (error) {
    console.error('Error creating payment method:', error);
    res.status(500).json({ error: 'Failed to create payment method.' });
  }
};

const getPaymentMethods = async (req, res) => {
    try {
        const query = 'SELECT * FROM payment_methods';
        const [paymentMethods] = await db.execute(query);
        
        res.status(200).json(paymentMethods);
    } catch (error) {
        console.error('Error fetching payment methods:', error);
        res.status(500).json({ error: 'Failed to fetch payment methods.' });
    }
}

const createDepositPurposes = async (req, res) => {
    const { name } = req.body;

    // Check if name is provided
    if (!name || name.trim() === "") {
        return res.status(400).json({ error: 'Deposit purpose name is required.' });
    }

    try {
        const query = 'INSERT INTO deposit_to (name) VALUES (?)';
        const [result] = await db.execute(query, [name.trim()]);
        
        res.status(201).json({ 
            message: 'Deposit purpose created successfully.',
            depositPurposeId: result.insertId,
            name: name.trim()
        });
    } catch (error) {
        console.error('Error creating deposit purpose:', error);
        res.status(500).json({ error: 'Failed to create deposit purpose.' });
    }
}

const getDepositPurposes = async (req, res) => {
    try {
        const query = 'SELECT * FROM deposit_to';
        const [depositPurposes] = await db.execute(query);
        
        res.status(200).json(depositPurposes);
    } catch (error) {
        console.error('Error fetching deposit purposes:', error);
        res.status(500).json({ error: 'Failed to fetch deposit purposes.' });
    }
}

module.exports = {
    createPaymentMethod,
    getPaymentMethods,
    createDepositPurposes,
    getDepositPurposes
};
