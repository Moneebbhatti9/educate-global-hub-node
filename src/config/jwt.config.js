const jwt = require('jsonwebtoken');

const jwtConfig = {
  // Access Token Configuration
  accessToken: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    algorithm: 'HS256'
  },
  
  // Refresh Token Configuration
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    algorithm: 'HS256'
  },
  
  // Token Options
  options: {
    issuer: 'educate-global-hub',
    audience: 'educate-global-hub-users'
  }
};

// Generate Access Token
const generateAccessToken = (payload) => {
  return jwt.sign(payload, jwtConfig.accessToken.secret, {
    expiresIn: jwtConfig.accessToken.expiresIn,
    algorithm: jwtConfig.accessToken.algorithm,
    issuer: jwtConfig.options.issuer,
    audience: jwtConfig.options.audience
  });
};

// Generate Refresh Token
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, jwtConfig.refreshToken.secret, {
    expiresIn: jwtConfig.refreshToken.expiresIn,
    algorithm: jwtConfig.refreshToken.algorithm,
    issuer: jwtConfig.options.issuer,
    audience: jwtConfig.options.audience
  });
};

// Verify Access Token
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, jwtConfig.accessToken.secret, {
      algorithms: [jwtConfig.accessToken.algorithm],
      issuer: jwtConfig.options.issuer,
      audience: jwtConfig.options.audience
    });
  } catch (error) {
    throw new Error('Invalid access token');
  }
};

// Verify Refresh Token
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, jwtConfig.refreshToken.secret, {
      algorithms: [jwtConfig.refreshToken.algorithm],
      issuer: jwtConfig.options.issuer,
      audience: jwtConfig.options.audience
    });
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

module.exports = {
  jwtConfig,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
