const replyButtons = document.querySelectorAll('.comment-reply');
const cancelButtons = document.querySelectorAll('.reply-cancel');

replyButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const form = document.getElementById(`reply-form-${btn.dataset.commentId}`);
        if (!form) return;

        form.classList.toggle('open');

        if (form.classList.contains('open')) {
            form.querySelector('textarea').focus();
        }
    });
});

cancelButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const form = document.getElementById(`reply-form-${btn.dataset.commentId}`);
        if (!form) return;

        form.classList.remove('open');
        form.reset();
    });
});
