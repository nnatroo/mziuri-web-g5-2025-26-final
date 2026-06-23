const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 8
    },
    username: {
        type: String,
        trim: true,
        maxlength: 30
    },
    avatar: {
        type: String
    },
    bio: {
        type: String,
        trim: true,
        maxlength: 300
    },
    bookmarks: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Blog'
    }]
}, {
    timestamps: true
});

userSchema.pre('save', async function() {
    if (!this.isModified('password')) {
        return;
    }

    try {
        this.password = await bcrypt.hash(this.password, 10);
        return;
    } catch (err) {
        console.log(err);
        return;
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;
