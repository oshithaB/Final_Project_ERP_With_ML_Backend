const db = require("../DB/db");
const bcrypt = require('bcrypt');

const getUserDetails = async (req, res) => {
    try {
        const userId = req.userId;
        console.log('User ID from request:', userId);
        if (!userId) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }
        console.log('Get user details request received for userId:', userId);

        const [user] = await db.query(
            'SELECT * FROM user WHERE user_id = ? AND is_active = 1',
            [userId]
        );

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        console.log('User details retrieved:', user[0]);
        return res.status(200).json({ success: true, data: user[0] });
    }
    catch (error) {
        console.error('Error retrieving user details:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}


const addUser = async (req, res) => {
    try {
        const { fullname, username, email, password, role, role_id, employee_id } = req.body;
        console.log('Add user request received:', req.body);

        // Use role_id directly if provided, otherwise convert role string to role_id
        let finalRoleId;
        
        if (role_id) {
            finalRoleId = role_id;
        } else if (role) {
            const role_lowercase = role.toLowerCase();
            console.log('Role after conversion to lowercase:', role_lowercase);

            const [roleResult] = await db.query(
                'SELECT role_id FROM role WHERE name = ?',
                [role_lowercase]
            );
            console.log('Role ID fetched:', roleResult);

            if (roleResult.length === 0) {
                return res.status(400).json({ success: false, message: 'Invalid role' });
            }
            finalRoleId = roleResult[0].role_id;
        } else {
            return res.status(400).json({ success: false, message: 'Either role or role_id is required' });
        }

        // If employee_id is provided, get employee details for user creation
        let userFullName = fullname;
        let userEmail = email;
        
        if (employee_id) {
            const [employeeData] = await db.query(
                'SELECT name, email FROM employees WHERE id = ?',
                [employee_id]
            );
            
            if (employeeData.length === 0) {
                return res.status(404).json({ success: false, message: 'Employee not found' });
            }
            
            userFullName = userFullName || employeeData[0].name;
            userEmail = userEmail || employeeData[0].email;
        }

        const [result] = await db.query(
            'SELECT * FROM user WHERE username = ? OR (email IS NOT NULL AND email = ?) AND is_active = 1',
            [username, userEmail]
        );
        console.log('Checking for existing user:', result);

        if (result.length > 0) {
            return res.status(400).json({ success: false, message: 'Username or email already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Use employee_id as user_id if provided, otherwise auto-increment
        const insertQuery = employee_id 
            ? 'INSERT INTO user (user_id, full_name, username, email, password_hash, role_id) VALUES (?, ?, ?, ?, ?, ?)'
            : 'INSERT INTO user (full_name, username, email, password_hash, role_id) VALUES (?, ?, ?, ?, ?)';
        
        const insertParams = employee_id 
            ? [employee_id, userFullName, username, userEmail, hashedPassword, finalRoleId]
            : [userFullName, username, userEmail, hashedPassword, finalRoleId];

        const [newUser] = await db.query(insertQuery, insertParams);
        console.log('New user created:', newUser);

        if (newUser.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to create user' });
        }

        return res.status(201).json({ success: true, message: 'User created successfully' });
    } catch (error) {
        console.error('Error adding user:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}


const updateUser = async (req, res) => {
    try {
        const userId = req.userId;
        const updates = req.body;
        console.log('Update user request received for userId:', userId, 'with updates:', updates);
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }

        const allowedFields = ['fullname', 'username', 'email', 'password'];
        const fieldsToUpdate = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                fieldsToUpdate[key] = updates[key];
            }
        }

        console.log(fieldsToUpdate);

        const [existingUserData] = await db.query(
            'SELECT * FROM user WHERE user_id = ? AND is_active = 1',
            [userId]
        );

        if (existingUserData.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found for update' });
        }

        if (fieldsToUpdate.fullname) {
            if (fieldsToUpdate.fullname === existingUserData[0].full_name) {
                delete fieldsToUpdate.fullname;
            }
        }

        if (fieldsToUpdate.password) {
            if (await bcrypt.compare(fieldsToUpdate.password, existingUserData[0].password_hash)) {
                delete fieldsToUpdate.password;
            }
        }

        // Check for username, email conflicts if those fields are being updated
        if (fieldsToUpdate.username || fieldsToUpdate.email) {

            if (fieldsToUpdate.username === existingUserData[0].username) {
                delete fieldsToUpdate.username;
            }

            if (fieldsToUpdate.email === existingUserData[0].email) {
                delete fieldsToUpdate.email;
            }
            

            const [conflict] = await db.query(
                'SELECT * FROM user WHERE (username = ? OR email = ?) AND user_id != ? AND is_active = 1',
                [
                    fieldsToUpdate.username || '',
                    fieldsToUpdate.email || '',
                    userId
                ]
            );
            if (conflict.length > 0) {
                return res.status(400).json({ success: false, message: 'Username, email or password already exists' });
            }
        }

        if (Object.keys(fieldsToUpdate).length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        // Prepare update query
        const setClauses = [];
        const values = [];

        if (fieldsToUpdate.fullname) {
            setClauses.push('full_name = ?');
            values.push(fieldsToUpdate.fullname);
        }
        if (fieldsToUpdate.username) {
            setClauses.push('username = ?');
            values.push(fieldsToUpdate.username);
        }
        if (fieldsToUpdate.email) {
            setClauses.push('email = ?');
            values.push(fieldsToUpdate.email);
        }
        if (fieldsToUpdate.password) {
            const hashedPassword = await bcrypt.hash(fieldsToUpdate.password, 10);
            setClauses.push('password_hash = ?');
            values.push(hashedPassword);
        }

        if (setClauses.length === 0) {
            return res.status(400).json({ success: false, message: 'No valid fields to update' });
        }

        values.push(userId);

        const [result] = await db.query(
            `UPDATE user SET ${setClauses.join(', ')} WHERE user_id = ? AND is_active = 1`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'User not found or nothing to update' });
        }

        return res.status(200).json({ success: true, message: 'User updated successfully' });
        
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

const updateUserById = async (req, res) => {
    try {
        const { userId } = req.params;
        const { username, password, role_id, full_name, email } = req.body;
        
        console.log('Update user by ID request received for userId:', userId, 'with updates:', req.body);

        // Validate required fields
        if (!username || !password || !role_id) {
            return res.status(400).json({ success: false, message: 'Username, password, and role_id are required' });
        }

        // Get the current employee's email from the employees table
        const [employeeData] = await db.query(
            'SELECT name, email FROM employees WHERE id = ?',
            [userId]
        );

        if (employeeData.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }

        // Use email from request body if provided, otherwise use employee's email
        const userEmail = email || employeeData[0].email;
        const userFullName = full_name || employeeData[0].name;

        // Check if user exists
        const [existingUser] = await db.query(
            'SELECT * FROM user WHERE user_id = ?',
            [userId]
        );

        if (existingUser.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check for username and email conflicts with other users (only if email is being set)
        let conflictQuery = 'SELECT * FROM user WHERE username = ? AND user_id != ? AND is_active = 1';
        let conflictParams = [username, userId];
        
        if (userEmail) {
            conflictQuery = 'SELECT * FROM user WHERE (username = ? OR email = ?) AND user_id != ? AND is_active = 1';
            conflictParams = [username, userEmail, userId];
        }

        const [conflict] = await db.query(conflictQuery, conflictParams);

        if (conflict.length > 0) {
            return res.status(400).json({ success: false, message: 'Username or email already exists for another user' });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update user
        const [result] = await db.query(
            'UPDATE user SET role_id = ?, full_name = ?, username = ?, email = ?, password_hash = ?, is_active = 1 WHERE user_id = ?',
            [role_id, userFullName, username, userEmail, hashedPassword, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to update user' });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Error updating user by ID:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const softDeleteUser = async (req, res) => {
    try {
        const {userId} = req.params;
        console.log('Soft delete user request received for userId:', userId);

        const [result] = await db.query(
            'SELECT * FROM user WHERE user_id = ? AND is_active = 1', 
            [ userId ]);

        if (result.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const [deleteResult] = await db.query(
            'UPDATE user SET is_active = 0 WHERE user_id = ?',
            [userId]
        );

        if (deleteResult.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to soft delete user' });
        }

        return res.status(200).json({ success: true, message: 'User soft deleted successfully' });
    } catch (error) {
        console.error('Error soft deleting user:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// const permanentlyDeleteUser = async (req, res) => {
//     try {
//         const { userId } = req.params;
//         console.log('Permanently delete user request received for userId:', userId);

//         const [result] = await db.query(
//             'SELECT * FROM user WHERE user_id = ?',
//             [userId]
//         );

//         if (result.length === 0) {
//             return res.status(404).json({ success: false, message: 'User not found' });
//         }

//         const [deleteResult] = await db.query(
//             'DELETE FROM user WHERE user_id = ?',
//             [userId]
//         );

//         if (deleteResult.affectedRows === 0) {
//             return res.status(500).json({ success: false, message: 'Failed to permanently delete user' });
//         }

//         return res.status(200).json({ success: true, message: 'User permanently deleted successfully' });
//     } catch (error) {
//         console.error('Error permanently deleting user:', error);
//         return res.status(500).json({ success: false, message: 'Internal server error' });
//     }
// };

module.exports = {
    getUserDetails,
    addUser,
    updateUser,
    updateUserById,  // Export the new function
    softDeleteUser,
    // permanentlyDeleteUser
};