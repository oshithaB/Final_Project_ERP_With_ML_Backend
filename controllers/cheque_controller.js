const db = require('../DB/db');

const addCheque = async (req, res) => {
    const { company_id, cheque_number, bank_name, branch_name, cheque_date, payee_name, amount } = req.body;

    if (!company_id || !cheque_number || !amount) {
        return res.status(400).json({ error: 'Company ID, cheque number, and amount are required' });
    }

    try {
        const [result] = await db.execute(
            `INSERT INTO cheques (
                company_id, cheque_number, bank_name, branch_name, cheque_date, payee_name, amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [company_id, cheque_number, bank_name || null, branch_name || null, cheque_date || null, payee_name || null, amount]
        );

        return res.status(201).json({
            message: 'Cheque created successfully'
        });
    } catch (error) {
        console.error('Error creating cheque:', error);
        return res.status(500).json({ error: 'Failed to create cheque' });
    }
};

// get cheques by company_id
const getChequesByCompanyId = async (req, res) => {
    const { company_id } = req.params;

    if (!company_id) {
        return res.status(400).json({ error: 'Company ID is required' });
    }

    try {
        const [rows] = await db.execute(
            `SELECT * FROM cheques WHERE company_id = ? ORDER BY created_at DESC`,
            [company_id]
        );

        return res.status(200).json(rows);
    } catch (error) {
        console.error('Error fetching cheques:', error);
        return res.status(500).json({ error: 'Failed to fetch cheques' });
    }
}

// update cheque details
const updateCheque = async (req, res) => {
    const { cheque_id } = req.params;
    const { cheque_number, bank_name, branch_name, cheque_date, payee_name, amount, status } = req.body;

    if (!cheque_id) {
        return res.status(400).json({ error: 'Cheque ID is required' });
    }

    try {
        // First, check if the cheque exists
        const [existingCheque] = await db.execute(
            `SELECT * FROM cheques WHERE id = ?`,
            [cheque_id]
        );

        if (existingCheque.length === 0) {
            return res.status(404).json({ error: 'Cheque not found' });
        }

        // Build dynamic update query only for provided fields
        const updates = [];
        const values = [];

        if (cheque_number !== undefined) {
            updates.push('cheque_number = ?');
            values.push(cheque_number);
        }
        if (bank_name !== undefined) {
            updates.push('bank_name = ?');
            values.push(bank_name || null);
        }
        if (branch_name !== undefined) {
            updates.push('branch_name = ?');
            values.push(branch_name || null);
        }
        if (cheque_date !== undefined) {
            updates.push('cheque_date = ?');
            values.push(cheque_date || null);
        }
        if (payee_name !== undefined) {
            updates.push('payee_name = ?');
            values.push(payee_name || null);
        }
        if (amount !== undefined) {
            updates.push('amount = ?');
            values.push(amount);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            values.push(status);
        }

        // If no fields to update
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields provided to update' });
        }

        // Add cheque_id to values array
        values.push(cheque_id);

        // Execute update query
        const [result] = await db.execute(
            `UPDATE cheques SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // Fetch the updated cheque details
        const [updatedCheque] = await db.execute(
            `SELECT * FROM cheques WHERE id = ?`,
            [cheque_id]
        );

        return res.status(200).json({
            message: 'Cheque updated successfully',
            cheque: updatedCheque[0]
        });

    } catch (error) {
        console.error('Error updating cheque:', error);
        return res.status(500).json({ error: 'Failed to update cheque' });
    }
};

// delete cheque
const deleteCheque = async (req, res) => {
    const { cheque_id } = req.params;

    if (!cheque_id) {
        return res.status(400).json({ error: 'Cheque ID is required' });
    }

    try {
        const [result] = await db.execute(
            `DELETE FROM cheques WHERE id = ?`,
            [cheque_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cheque not found' });
        }

        return res.status(200).json({ message: 'Cheque deleted successfully' });
    } catch (error) {
        console.error('Error deleting cheque:', error);
        return res.status(500).json({ error: 'Failed to delete cheque' });
    }
}

// update status
const updateStatus = async (req, res) => {
    const { cheque_id } = req.params;
    const { status } = req.body;

    if (!cheque_id || !status) {
        return res.status(400).json({ error: 'Cheque ID and status are required' });
    }

    try {
        const [result] = await db.execute(
            `UPDATE cheques SET status = ? WHERE id = ?`,
            [status, cheque_id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Cheque not found' });
        }

        return res.status(200).json({ message: 'Cheque status updated successfully' });
    } catch (error) {
        console.error('Error updating cheque status:', error);
        return res.status(500).json({ error: 'Failed to update cheque status' });
    }
};

// get cheque by id
const getChequeByID = async (req, res) => {
    const { cheque_id, company_id } = req.params;
    if (!cheque_id || !company_id) {
        return res.status(400).json({ error: 'Cheque ID and Company ID are required' });
    }
    try {
        const [rows] = await db.execute(
            `SELECT * FROM cheques WHERE id = ? AND company_id = ?`,
            [cheque_id, company_id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Cheque not found' });
        }

        return res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error fetching cheque:', error);
        return res.status(500).json({ error: 'Failed to fetch cheque' });
    }
}

module.exports = {
    addCheque,
    getChequesByCompanyId,
    updateCheque,
    deleteCheque,
    updateStatus,
    getChequeByID
}