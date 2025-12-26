const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(403).json({ success: false, message: "No token provided" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        req.userId = decoded.userId;
        req.role = decoded.role;
        // console.log(`User ID: ${req.userId}, Role: ${req.role}`);
        next();
    });
};

module.exports = verifyToken;
