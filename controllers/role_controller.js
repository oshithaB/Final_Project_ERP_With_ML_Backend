const db = require("../DB/db");

// This function retrieves all roles from the database and returns them in JSON format.
const getAllRoles = async (req, res) => {
    try {
        const [roles] = await db.query('SELECT * FROM role');
        console.log('Roles retrieved:', roles);
        return res.status(200).json({ success: true, data: roles });
    } catch (error) {
        console.error('Error retrieving roles:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// This function adds a new role to the database.
// It checks for existing roles with the same name, converts the name to lowercase,
// and inserts the new role into the database.
// If the role already exists, it returns an error message.
const addRole = async (req, res) => {
    try {
        const {name} = req.body;
        console.log('Add role request received:', req.body);

        const name_lowercase = name.toLowerCase();
        console.log('Role name after conversion to lowercase:', name_lowercase);

        const [existingRole] = await db.query(
            'SELECT * FROM role WHERE name = ?',
            [name_lowercase]
        );
        console.log('Checking for existing role:', existingRole);

        if (existingRole.length > 0) {
            return res.status(400).json({ success: false, message: 'Role already exists' });
        }

        const [newRole] = await db.query(
            'INSERT INTO role (name) VALUES (?)',
            [name_lowercase]
        );

        if (newRole.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to create role' });
        }

        console.log('New role created:', newRole);

        return res.status(201).json({ success: true, message: 'Role created successfully' });
    } catch (error) {
        console.error('Error adding role:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}


const updateRole = async (req, res) => {
    try {
        const {roleId} = req.params;
        if (!roleId) {
            return res.status(400).json({ success: false, message: 'Role ID is required' });
        }
        const {name} = req.body;
        console.log('Update role request received:', roleId, '  Name to be updated: ', name);

        const name_lowercase = name.toLowerCase();
        console.log('Role name after conversion to lowercase:', name_lowercase);

        const [existingRole] = await db.query(
            'SELECT * FROM role WHERE role_id = ?',
            [roleId]
        );

        if (existingRole.length === 0) {
            return res.status(404).json({ success: false, message: 'Role not found' });
        }

        if (existingRole[0].name === name_lowercase) {
            return res.status(400).json({ success: false, message: 'Role name is the same as existing role' });
        }

        const [checkRoleName] = await db.query(
            'SELECT * FROM role WHERE name = ? AND role_id != ?',
            [name_lowercase, roleId]
        );

        if (checkRoleName.length > 0) {
            return res.status(400).json({ success: false, message: 'Role name already exists' });
        }

        const [updateResult] = await db.query(
            'UPDATE role SET name = ? WHERE role_id = ?',
            [name_lowercase, roleId]
        );

        if (updateResult.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to update role' });
        }

        console.log('Role updated successfully:', updateResult);
        return res.status(200).json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
        console.error('Error updating role:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports = {
    getAllRoles,
    addRole,
    updateRole
};