const express = require('express');
const router = express.Router();
const createError = require('http-errors');
const Blog = require('../models/blog');
const User = require('../models/user');
const {requireAuth} = require('../middlewares/authMiddleware');
const mongoose = require("mongoose");

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

        res.render("blog", {email, blog, recentBlogPosts});
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
