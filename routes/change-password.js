const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const bcrypt = require('bcrypt');
const User = require('../models/user');
const {requireAuth} = require('../middlewares/authMiddleware');

router.get('/', requireAuth, function (req, res, next) {
    res.render('change_password', {email: req.session.user.email, error: null, success: null});
});

router.post('/', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const {currentPassword, newPassword, confirmPassword} = req.body;

    try {
        const user = await User.findOne({email});

        if (!user) {
            return next(createError(404));
        }

        const render = (error, success) => res.render('change_password', {email, error, success});

        if (!currentPassword || !newPassword || !confirmPassword) {
            return render('All fields are required', null);
        }

        const matches = await bcrypt.compare(currentPassword, user.password);
        if (!matches) {
            return render('Current password is incorrect', null);
        }

        if (newPassword.length < 8) {
            return render('New password must be at least 8 characters', null);
        }

        if (newPassword !== confirmPassword) {
            return render('New passwords do not match', null);
        }

        if (currentPassword === newPassword) {
            return render('New password must be different from the current one', null);
        }

        // Assigning the raw password marks it modified, so the User pre-save
        // hook hashes it before storing.
        user.password = newPassword;
        await user.save();

        return render(null, 'Password updated successfully');
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

module.exports = router;
