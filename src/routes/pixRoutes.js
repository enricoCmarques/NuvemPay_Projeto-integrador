const express = require('express');
const PixController = require('../controllers/PixController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/pix', authMiddleware, PixController.sendPix);
router.get('/history', authMiddleware, PixController.getHistory);

module.exports = router;