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

const editButtons = document.querySelectorAll('.comment-edit');
const editCancelButtons = document.querySelectorAll('.edit-cancel');

const setEditing = (commentId, editing) => {
    const form = document.getElementById(`edit-form-${commentId}`);
    const content = document.getElementById(`content-${commentId}`);
    if (!form) return;

    form.classList.toggle('open', editing);
    if (content) content.classList.toggle('editing', editing);

    if (editing) {
        const textarea = form.querySelector('textarea');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
};

editButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const form = document.getElementById(`edit-form-${btn.dataset.commentId}`);
        setEditing(btn.dataset.commentId, !form.classList.contains('open'));
    });
});

editCancelButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
        const form = document.getElementById(`edit-form-${btn.dataset.commentId}`);
        if (form) form.reset();
        setEditing(btn.dataset.commentId, false);
    });
});

const deleteForms = document.querySelectorAll('.delete-form');

deleteForms.forEach((form) => {
    form.addEventListener('submit', (event) => {
        if (!confirm('Delete this comment? This cannot be undone.')) {
            event.preventDefault();
        }
    });
});
