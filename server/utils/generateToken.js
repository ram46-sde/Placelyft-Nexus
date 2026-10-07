const jwt = require('jsonwebtoken');

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    process.env.JWT_SECRET || 'cpms_default_secret_key',
    { expiresIn: '7d' }
  );
};

module.exports = generateToken;
