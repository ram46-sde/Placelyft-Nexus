const jwt = require('jsonwebtoken');
const { getJwtSecret } = require('../config/jwt');

const generateToken = (id, role) => {
  return jwt.sign(
    { id, role },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

module.exports = generateToken;
