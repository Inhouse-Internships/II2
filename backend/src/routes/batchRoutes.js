const express = require('express');
const router = express.Router();
const { executeBatch } = require('../controllers/batchController');
const authenticate = require('../middlewares/authenticate');

router.post('/', authenticate, executeBatch);

module.exports = router;
