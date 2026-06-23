const mongoose = require('mongoose');
const {mongo} = require("mongoose");

const commentSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        default: Date.now
    },
    editedAt: {
        type: Date
    },
    replies: [{
        content: {
            type: String,
            required: true,
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        date: {
            type: Date,
            default: Date.now
        },
        editedAt: {
            type: Date
        },
        likes: [{
            author: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            }
        }],
        dislikes: [{
            author: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            }
        }]
    }],
    likes: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }],
    dislikes: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        }
    }]
})

const blogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 40
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    thumbnail: {
        type: String
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    },
    comments: [commentSchema]
}, {
    timestamps: true
});

const Blog = mongoose.model('Blog', blogSchema);

module.exports = Blog;
