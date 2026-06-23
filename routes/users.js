const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Blog = require('../models/blog');
const User = require('../models/user');
const {requireAuth} = require('../middlewares/authMiddleware');

// Avatars share the uploads dir that blog thumbnails use (served from /public).
const uploadDir = path.join(__dirname, '..', 'public', 'images', 'uploads');
fs.mkdirSync(uploadDir, {recursive: true});

const allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const avatarUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
        }
    }),
    limits: {fileSize: 5 * 1024 * 1024},
    fileFilter: (req, file, cb) => {
        cb(null, allowedAvatarTypes.includes(file.mimetype));
    }
}).single('avatar');

// Surface multer errors to the handler instead of bubbling up as a 500.
function uploadAvatar(req, res, next) {
    avatarUpload(req, res, (err) => {
        if (err) {
            req.uploadError = 'Avatar upload failed. Use an image under 5MB.';
        }
        next();
    });
}

// Removes a previously uploaded avatar from disk. Only touches files in our
// uploads dir, so nothing bundled is ever deleted.
function removeUploadedFile(file) {
    if (file && file.startsWith('/images/uploads/')) {
        fs.unlink(path.join(__dirname, '..', 'public', file), () => {});
    }
}

// Convenience link target for the header: resolves the logged-in user to their
// canonical profile URL. Registered before /:userId so "me" isn't read as an id.
router.get('/me', requireAuth, async function (req, res, next) {
    try {
        const user = await User.findOne({email: req.session.user.email});

        if (!user) {
            return next(createError(404));
        }

        res.redirect(`/users/${user._id}`);
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

router.get('/:userId', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const {userId} = req.params;

    try {
        const profileUser = await User.findById(userId);

        if (!profileUser) {
            return next(createError(404));
        }

        const blogs = await Blog.find({author: userId})
            .sort({date: -1})
            .populate('author', 'email username');

        const isOwnProfile = profileUser.email === email;

        res.render('profile', {email, profileUser, blogs, isOwnProfile});
    } catch (error) {
        return next(createError(404));
    }
});

router.get('/:userId/edit', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const {userId} = req.params;

    try {
        const profileUser = await User.findById(userId);

        if (!profileUser) {
            return next(createError(404));
        }

        if (profileUser.email !== email) {
            return next(createError(403));
        }

        res.render('edit_profile', {email, profileUser, error: null});
    } catch (error) {
        return next(createError(404));
    }
});

router.post('/:userId/edit', requireAuth, uploadAvatar, async function (req, res, next) {
    const email = req.session.user.email;
    const {userId} = req.params;
    const {username, bio} = req.body;

    const discardUpload = () => {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
    };

    try {
        const profileUser = await User.findById(userId);

        if (!profileUser) {
            discardUpload();
            return next(createError(404));
        }

        if (profileUser.email !== email) {
            discardUpload();
            return next(createError(403));
        }

        const renderError = (error) => {
            discardUpload();
            return res.render('edit_profile', {email, profileUser, error});
        };

        if (req.uploadError) {
            return renderError(req.uploadError);
        }

        if (username && username.length > 30) {
            return renderError('Username must be 30 characters or fewer');
        }

        if (bio && bio.length > 300) {
            return renderError('Bio must be 300 characters or fewer');
        }

        profileUser.username = username ? username.trim() : undefined;
        profileUser.bio = bio ? bio.trim() : undefined;

        // Swap in the new avatar and remove the old upload only when one was
        // provided; otherwise keep the existing image.
        if (req.file) {
            const oldAvatar = profileUser.avatar;
            profileUser.avatar = `/images/uploads/${req.file.filename}`;
            removeUploadedFile(oldAvatar);
        }

        await profileUser.save();

        res.redirect(`/users/${userId}`);
    } catch (error) {
        console.log(error);
        discardUpload();
        next(createError(500));
    }
});

module.exports = router;
