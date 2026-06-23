const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Blog = require('../models/blog');
const User = require('../models/user');
const {requireAuth} = require('../middlewares/authMiddleware');
const mongoose = require("mongoose");

// Where uploaded thumbnails are stored (served statically from /public).
const uploadDir = path.join(__dirname, '..', 'public', 'images', 'uploads');
fs.mkdirSync(uploadDir, {recursive: true});

const allowedThumbnailTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const thumbnailUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => cb(null, uploadDir),
        filename: (req, file, cb) => {
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, `thumbnail-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
        }
    }),
    limits: {fileSize: 5 * 1024 * 1024},
    fileFilter: (req, file, cb) => {
        if (allowedThumbnailTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(null, false);
        }
    }
}).single('thumbnail');

// Wrap multer so its errors (e.g. file too large) are surfaced to the route
// handler via req.uploadError, which re-renders the relevant form instead of
// letting the error bubble up as an unhandled 500.
function uploadThumbnail(req, res, next) {
    thumbnailUpload(req, res, (err) => {
        if (err) {
            req.uploadError = 'Thumbnail upload failed. Use an image under 5MB.';
        }
        next();
    });
}

// Removes a previously uploaded thumbnail file from disk. Only touches files in
// our uploads dir, so bundled/default thumbnails are never deleted.
function removeThumbnailFile(thumbnail) {
    if (thumbnail && thumbnail.startsWith('/images/uploads/')) {
        fs.unlink(path.join(__dirname, '..', 'public', thumbnail), () => {});
    }
}

// Toggles a like/dislike on a comment or reply. A user can only have one of
// the two active at a time, so reacting one way clears the opposite reaction.
function toggleReaction(target, userId, reaction) {
    const opposite = reaction === 'likes' ? 'dislikes' : 'likes';
    const existing = target[reaction].find(r => r.author.equals(userId));

    if (existing) {
        target[reaction].pull(existing._id);
        return;
    }

    target[reaction].push({author: userId});

    const oppositeExisting = target[opposite].find(r => r.author.equals(userId));
    if (oppositeExisting) {
        target[opposite].pull(oppositeExisting._id);
    }
}

router.get('/', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const blogs = await Blog.find().sort({date: -1}).populate("author", "email")

    res.render('blogs', {email, blogs});
});

router.get('/new', requireAuth, function (req, res, next) {
    const email = req.session.user.email;
    res.render('new_blog', {email, error: null});
})

router.get('/:blogId', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const blogId = req.params.blogId

    try {
        const blog = await Blog.findById(blogId)
            .populate("author", "email")
            .populate("comments.author", "email")
            .populate("comments.replies.author", "email");

        if (!blog) {
            return next(createError(404));
        }

        const recentBlogPosts = await Blog.find({_id: {$ne: blogId}})
            .sort({date: -1})
            .limit(8)
            .populate("author", "email");

        const user = await User.findOne({email});
        const userId = user ? user._id.toString() : null;

        res.render("blog", {email, blog, recentBlogPosts, userId});
    } catch (error) {
        return next(createError(404));
    }
});

router.post('/:blogId/comments', requireAuth, async function (req, res, next) {
    const {content} = req.body;
    const email = req.session.user.email;
    const blogId = req.params.blogId;

    if (!content || !content.trim()) {
        return res.redirect(`/blogs/${blogId}`);
    }

    try {
        const user = await User.findOne({email});
        const blog = await Blog.findById(blogId);

        if (!blog) {
            return next(createError(404));
        }

        blog.comments.push({author: user._id, content: content.trim()});
        await blog.save();

        res.redirect(`/blogs/${blogId}`);
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

router.post('/:blogId/comments/:commentId/replies', requireAuth, async function (req, res, next) {
    const {content} = req.body;
    const email = req.session.user.email;
    const {blogId, commentId} = req.params;

    if (!content || !content.trim()) {
        return res.redirect(`/blogs/${blogId}`);
    }

    try {
        const user = await User.findOne({email});
        const blog = await Blog.findById(blogId);

        if (!blog) {
            return next(createError(404));
        }

        const comment = blog.comments.id(commentId);

        if (!comment) {
            return next(createError(404));
        }

        comment.replies.push({author: user._id, content: content.trim()});
        await blog.save();

        res.redirect(`/blogs/${blogId}`);
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

router.post('/:blogId/comments/:commentId/edit', requireAuth, async function (req, res, next) {
    const {content} = req.body;
    const email = req.session.user.email;
    const {blogId, commentId} = req.params;

    if (!content || !content.trim()) {
        return res.redirect(`/blogs/${blogId}#comment-${commentId}`);
    }

    try {
        const user = await User.findOne({email});
        const blog = await Blog.findById(blogId);

        if (!blog) {
            return next(createError(404));
        }

        const comment = blog.comments.id(commentId);

        if (!comment) {
            return next(createError(404));
        }

        if (!comment.author.equals(user._id)) {
            return next(createError(403));
        }

        comment.content = content.trim();
        comment.editedAt = new Date();
        await blog.save();

        res.redirect(`/blogs/${blogId}#comment-${commentId}`);
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

router.post('/:blogId/comments/:commentId/delete', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const {blogId, commentId} = req.params;

    try {
        const user = await User.findOne({email});
        const blog = await Blog.findById(blogId);

        if (!blog) {
            return next(createError(404));
        }

        const comment = blog.comments.id(commentId);

        if (!comment) {
            return next(createError(404));
        }

        const isCommentAuthor = comment.author.equals(user._id);
        const isBlogAuthor = blog.author.equals(user._id);

        if (!isCommentAuthor && !isBlogAuthor) {
            return next(createError(403));
        }

        blog.comments.pull(commentId);
        await blog.save();

        res.redirect(`/blogs/${blogId}#comments`);
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

router.post('/:blogId/comments/:commentId/:reaction(like|dislike)', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const {blogId, commentId, reaction} = req.params;

    try {
        const user = await User.findOne({email});
        const blog = await Blog.findById(blogId);

        if (!blog) {
            return next(createError(404));
        }

        const comment = blog.comments.id(commentId);

        if (!comment) {
            return next(createError(404));
        }

        toggleReaction(comment, user._id, reaction === 'like' ? 'likes' : 'dislikes');
        await blog.save();

        res.redirect(`/blogs/${blogId}#comment-${commentId}`);
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

router.post('/:blogId/comments/:commentId/replies/:replyId/:reaction(like|dislike)', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const {blogId, commentId, replyId, reaction} = req.params;

    try {
        const user = await User.findOne({email});
        const blog = await Blog.findById(blogId);

        if (!blog) {
            return next(createError(404));
        }

        const comment = blog.comments.id(commentId);
        const reply = comment && comment.replies.id(replyId);

        if (!reply) {
            return next(createError(404));
        }

        toggleReaction(reply, user._id, reaction === 'like' ? 'likes' : 'dislikes');
        await blog.save();

        res.redirect(`/blogs/${blogId}#comment-${commentId}`);
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

router.post('/new', requireAuth, uploadThumbnail, async function (req, res, next) {
    const {title, description, content} = req.body;
    const email = req.session.user.email;

    // Remove an orphaned upload before re-rendering the form on a validation error.
    const renderError = (error) => {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        return res.render('new_blog', {email, error});
    };

    if (req.uploadError) {
        return renderError(req.uploadError);
    }

    if (!title || !title.trim() || !description || !description.trim() || !content || !content.trim()) {
        return renderError('Missing required field');
    }

    if (title.length > 40) {
        return renderError('Title length must be less than 40 characters');
    }

    if (description.length > 200) {
        return renderError('Description length must be less than 200 characters');
    }

    if (content.length > 2000) {
        return renderError('Content length must be less than 2000 characters');
    }

    if (!req.file) {
        return renderError('A thumbnail image is required (PNG, JPG, WEBP or GIF, up to 5MB)');
    }

    try {
        const user = await User.findOne({email});

        const newBlog = new Blog({
            title,
            description,
            content,
            thumbnail: `/images/uploads/${req.file.filename}`,
            author: user._id,
        });
        await newBlog.save();

        res.redirect('/blogs');
    } catch (error) {
        console.log(error);
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        next(createError(500));
    }
})

router.get('/:blogId/edit', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const {blogId} = req.params;

    try {
        const blog = await Blog.findById(blogId).populate('author', 'email');

        if (!blog) {
            return next(createError(404));
        }

        const user = await User.findOne({email});

        if (!user || !blog.author._id.equals(user._id)) {
            return next(createError(403));
        }

        res.render('edit_blog', {email, blog, error: null});
    } catch (error) {
        return next(createError(404));
    }
});

router.post('/:blogId/edit', requireAuth, uploadThumbnail, async function (req, res, next) {
    const {title, description, content} = req.body;
    const email = req.session.user.email;
    const {blogId} = req.params;

    // Discard any freshly uploaded file when we are not going to keep it.
    const discardUpload = () => {
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
    };

    try {
        const user = await User.findOne({email});
        const blog = await Blog.findById(blogId).populate('author', 'email');

        if (!blog) {
            discardUpload();
            return next(createError(404));
        }

        if (!user || !blog.author._id.equals(user._id)) {
            discardUpload();
            return next(createError(403));
        }

        // Re-render the edit form on a problem, discarding the orphaned upload.
        const renderError = (error) => {
            discardUpload();
            return res.render('edit_blog', {email, blog, error});
        };

        if (req.uploadError) {
            return renderError(req.uploadError);
        }

        if (!title || !title.trim() || !description || !description.trim() || !content || !content.trim()) {
            return renderError('Missing required field');
        }

        if (title.length > 40) {
            return renderError('Title length must be less than 40 characters');
        }

        if (description.length > 200) {
            return renderError('Description length must be less than 200 characters');
        }

        if (content.length > 2000) {
            return renderError('Content length must be less than 2000 characters');
        }

        blog.title = title;
        blog.description = description;
        blog.content = content;

        // Swap in the new thumbnail and clean up the old upload only when a new
        // file was provided; otherwise keep the existing image.
        if (req.file) {
            const oldThumbnail = blog.thumbnail;
            blog.thumbnail = `/images/uploads/${req.file.filename}`;
            removeThumbnailFile(oldThumbnail);
        }

        await blog.save();

        res.redirect(`/blogs/${blogId}`);
    } catch (error) {
        console.log(error);
        discardUpload();
        next(createError(500));
    }
});

router.post('/:blogId/delete', requireAuth, async function (req, res, next) {
    const email = req.session.user.email;
    const {blogId} = req.params;

    try {
        const user = await User.findOne({email});
        const blog = await Blog.findById(blogId);

        if (!blog) {
            return next(createError(404));
        }

        if (!user || !blog.author.equals(user._id)) {
            return next(createError(403));
        }

        removeThumbnailFile(blog.thumbnail);
        await blog.deleteOne();

        res.redirect('/blogs');
    } catch (error) {
        console.log(error);
        next(createError(500));
    }
});

module.exports = router;
