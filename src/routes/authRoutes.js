const express = require('express');
const AuthController = require('../controllers/AuthController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.get('/me', authMiddleware, AuthController.me);
router.get('/2fa/setup', authMiddleware, AuthController.setup2FA);
router.post('/2fa/verify', authMiddleware, AuthController.verify2FASetup);

module.exports = router;