const blogsSwiper = new Swiper('.blogs-swiper', {
    slidesPerView: 1,
    spaceBetween: 32,
    grabCursor: true,
    loop: true,
    pagination: {
        el: '.swiper-pagination',
        clickable: true,
    },
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    },
    breakpoints: {
        576: {
            slidesPerView: 2,
        },
        1024: {
            slidesPerView: 3,
        },
    },
});
