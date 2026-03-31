const express = require('express');
const { connectDB } = require('../config/database');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    await connectDB();
    return res.json({ status: 'alive' });
  } catch (error) {
    console.error('Keep-alive error:', error.message);
    return res.status(500).json({ error: 'Keep-alive check failed' });
  }
});

module.exports = router;
