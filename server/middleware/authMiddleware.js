const jwt = require('jsonwebtoken');

/**
 * Middleware to verify JWT token from headers or cookies
 * Attaches user info to req.user if token is valid
 */
const verifyToken = (req, res, next) => {
  try {
    // Try to get token from Authorization header (Bearer token)
    let token = req.headers.authorization;
    if (token && token.startsWith('Bearer ')) {
      token = token.slice(7);
    }

    // If no token in header, try to get from cookies
    if (!token) {
      token = req.cookies?.token;
    }

    // If still no token, return unauthorized
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized - No token provided'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
    
    // Attach user info to request
    req.user = decoded;
    req.userToken = decoded.username; // For backward compatibility with existing code
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired - Please login again'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        error: 'Invalid token'
      });
    } else {
      console.error('Auth middleware error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication error'
      });
    }
  }
};

module.exports = { verifyToken };
