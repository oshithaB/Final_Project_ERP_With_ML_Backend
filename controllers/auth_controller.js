const db = require("../DB/db");
const bcrypt = require('bcrypt');
const { use } = require("bcrypt/promises");
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
require('dotenv').config();


//Controller functions for user authentication 
// This function authenticates the user by checking the username and password against the database.
// If the credentials are valid, it generates a JWT token and returns it to the client.
const authenticateUser = async (req, res) => {
    try {
        console.log('Login request received:', req.body);
        const { email, password } = req.body;
        console.log('Email:', email);
        console.log('Password:', password);

        const [user] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
        console.log('User fetched from database:', user);

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user[0].is_active) {
            return res.status(403).json({ success: false, message: 'User account is inactive' });
        }

        if (user) {
            console.log('User found:', user[0]);
            const isMatch = await bcrypt.compare(password, user[0].password_hash);
            if (isMatch) {
                const [role] = await db.query('SELECT name FROM role WHERE role_id = ?', [user[0].role_id]);
                if (role.length === 0) {
                    return res.status(404).json({ success: false, message: 'Role not found' });
                }
                console.log('User role:', role[0].name);
                const token = jwt.sign(
                    { userId: user[0].user_id, role: role[0].name },
                    process.env.JWT_SECRET,
                    { expiresIn: '24h' }
                );
                return res.status(200).json({ 
                    success: true, 
                    message: 'Login successful', 
                    token , 
                    user: { 
                        id: user[0].user_id, 
                        username: user[0].username, 
                        email: user[0].email, 
                        fullname: user[0].full_name, 
                        role: role[0].name 
                    } 
                });
            } else {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } else {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
    } catch (err) {
        console.error('Error during login:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

//Controller functions for user verification in password reset
// This function verifies the user by checking if the username or email exists in the database. 
const verifyUser = async (req, res) => {
    try {

        const {email} = req.body; 
        console.log('Reset password request received for email:', email);

        const [user] = await db.query('SELECT * FROM user WHERE email = ?', [email]);

        
        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user[0].is_active) {
            return res.status(403).json({ success: false, message: 'User account is inactive' });
        }


        generateOTP_Sendmail(user);
        return res.status(200).json({ success: true, message: 'User found' });
        
    } catch (err) {
        console.error('Error during user verification:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
        
};

//Controller functions for OTP verification
// This function verifies the OTP entered by the user against the one stored in the database.
const verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        console.log('OTP verification request received for email:', email);

        const [user] = await db.query('SELECT * FROM user WHERE email = ?', [email]);

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user[0].is_active) {
            return res.status(403).json({ success: false, message: 'User account is inactive' });
        }

        const currentTime = new Date();
        if (user[0].otp_expiry < currentTime) {
            return res.status(400).json({ success: false, message: 'OTP expired' });
        }

        if (user[0].otp_code !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        const [result] = await db.query('UPDATE user SET otp_code = NULL, otp_expiry = NULL WHERE user_id = ?', [user[0].user_id]);
        if (result.affectedRows === 0) {
            return res.status(500).json({ success: false, message: 'Failed to clear OTP' });
        }
        console.log('OTP verified and cleared for email:', email);

        return res.json({ success: true, message: 'OTP verified successfully' });

    } catch (err) {
        console.error('Error during OTP verification:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

//Controller functions for resending OTP
// This function allows the user to request a new OTP if the previous one has expired or was not received.
// It checks if the user exists and then generates and sends a new OTP.
const resendOTP = async (req, res) => {
    try {
        const { userId } = req.body;
        const [user] = await db.query('SELECT * FROM user WHERE user_id = ?', [userId]);

        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user[0].is_active) {
            return res.status(403).json({ success: false, message: 'User account is inactive' });
        }

        // Generate and send OTP
        await generateOTP_Sendmail(user);
        return res.status(200).json({ success: true, message: 'OTP resent successfully', email: user[0].email });

    } catch (err) {
        console.error('Error during OTP resending:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


//Controller functions for resetting password
// This function take the user ID and new password from the request body, hashes the new password, and updates it in the database.
const resetPassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        const [user] = await db.query('SELECT * FROM user WHERE email = ?', [email]);
        if (user.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        if (!user[0].is_active) {
            return res.status(403).json({ success: false, message: 'User account is inactive' });
        }

        const [result] = await db.query('UPDATE user SET password_hash = ? WHERE email = ?', [bcrypt.hashSync(newPassword, 10), email]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Failed to reset password' });
        }
        console.log('Password reset successfully for user email:', email);
        return res.status(200).json({ success: true, message: 'Password reset successfully' });

    } catch (err) {
        console.error('Error during password reset:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Function to generate OTP and send it via email
// This function generates a 6-digit OTP, saves it to the database, and sends it
const generateOTP_Sendmail = async (user) => {
    try {
        const otp = Math.floor(100000 + Math.random() * 900000);
        console.log('Generated OTP:', otp);
        const expiresIn = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes from now
        console.log('OTP expiration time:', expiresIn);

        const [result] = await db.query('UPDATE user SET otp_code = ?, otp_expiry = ? WHERE user_id = ?', [otp, expiresIn, user[0].user_id]);
        
        if (result.affectedRows === 0) {
            throw new Error('Failed to save OTP to database');
        }

        console.log('OTP saved to database for user ID:', user[0].user_id);

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user[0].email,
            subject: 'Password Reset OTP',
            text: `Your OTP for password reset is ${otp}. It is valid for 15 minutes.`
            ,
            html: `<div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 24px;">
                <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 32px;">
                    <p style="font-size: 16px; color: #444;">Your OTP for password reset is:</p>
                    <div style="font-size: 32px; font-weight: bold; color: #1976d2; margin: 16px 0;">${otp}</div>
                    <p style="font-size: 14px; color: #666;">This OTP is valid for 15 minutes.</p>
                    <p style="font-size: 13px; color: #aaa; margin-top: 32px;">If you did not request a password reset, please ignore this email.</p>
                </div>
                </div>`
        };

        await transporter.sendMail(mailOptions);
        console.log('Password reset OTP sent to email:', user[0].email);
    } catch (err) {
        console.error('Error during OTP generation:', err);
        throw new Error('Failed to generate OTP');
    }
};


module.exports = {
    authenticateUser,
    verifyUser,
    verifyOTP,
    resendOTP,
    resetPassword
};