const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const Blog = require('../models/blog');
const User = require('../models/user');
const {requireAuth} = require('../middlewares/authMiddleware');
const mongoose = require("mongoose");

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

router.post('/new', requireAuth, async function (req, res, next) {
    const {title, description, content} = req.body;
    const email = req.session.user.email;

    if (!title.trim() || !description.trim() || !content.trim()) {
        res.render('new_blog', {email, error: 'Missing required field'});
    }

    if (title.length > 40) {
        res.render('new_blog', {email, error: 'Title length must be less than 40 characters'});
    }

    if (description.length > 200) {
        res.render('new_blog', {email, error: 'Description length must be less than 200 characters'});
    }

    if (content.length > 2000) {
        res.render('new_blog', {email, error: 'Content length must be less than 2000 characters'});
    }

    const user = await User.findOne({email});

    const userID = user._id.toString();

    const newBlogObj = {
        title,
        description,
        content,
        author: userID,
    };

    try {
        const newBlog = new Blog(newBlogObj);
        await newBlog.save();

        res.redirect('/blogs');
    } catch (error) {
        console.log(error);
    }
})

module.exports = router;
