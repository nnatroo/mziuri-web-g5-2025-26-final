const express = require('express');
const router = express.Router();

router.get('/recentBlogs', (req, res) => {
    res.render('recentBlogs');
});

module.exports = router;