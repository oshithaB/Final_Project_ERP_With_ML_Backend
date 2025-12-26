// This middleware checks if the user has one of the authorized roles
// It takes an array of roles as an argument and checks if the user's role matches any of them.
const authorizedRoles = (roles) => {
  return (req, res, next) => {
    if (!req.userId || !req.role) {
      return res.status(403).json({ success: false, message: 'Access denied. No user role found.' });
    }

    // Convert roles to array if it's a string
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    // Case-insensitive comparison
    const userRole = req.role.toLowerCase();
    const normalizedAllowedRoles = allowedRoles.map(r => r.toLowerCase());

    if (normalizedAllowedRoles.includes(userRole)) {
      // console.log(`User ID: ${req.userId}, Role: ${req.role} - Access granted`);
      return next();
    } else {
      return res.status(403).json({ success: false, message: 'Access denied. You do not have the required role.' });
    }
  };
}

module.exports = authorizedRoles;