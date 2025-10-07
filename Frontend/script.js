document.addEventListener('DOMContentLoaded', function() {
    // Navbar scroll effect
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Animate elements when they come into view
    const animateOnScroll = function() {
        const elements = document.querySelectorAll('.feature-card, .step-card, .seller-card, .testimonial-card');
        
        elements.forEach(element => {
            const elementPosition = element.getBoundingClientRect().top;
            const screenPosition = window.innerHeight / 1.2;
            
            if (elementPosition < screenPosition) {
                element.classList.add('animate__animated', 'animate__fadeInUp');
            }
        });
    };

    window.addEventListener('scroll', animateOnScroll);
    animateOnScroll(); // Run once on page load

    // Testimonial slider navigation
    const testimonialSlider = document.querySelector('.testimonial-slider');
    let isDown = false;
    let startX;
    let scrollLeft;

    testimonialSlider.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - testimonialSlider.offsetLeft;
        scrollLeft = testimonialSlider.scrollLeft;
    });

    testimonialSlider.addEventListener('mouseleave', () => {
        isDown = false;
    });

    testimonialSlider.addEventListener('mouseup', () => {
        isDown = false;
    });

    testimonialSlider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - testimonialSlider.offsetLeft;
        const walk = (x - startX) * 2;
        testimonialSlider.scrollLeft = scrollLeft - walk;
    });

    // Floating chat button interaction
    const chatBtn = document.querySelector('.floating-chat-btn');
    
    chatBtn.addEventListener('click', function() {
        alert("Chat feature will be available soon!");
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // GSAP animations
    if (typeof gsap !== 'undefined') {
        gsap.from('.navbar-brand', {
            duration: 1,
            y: -50,
            opacity: 0,
            delay: 0.2
        });
        
        gsap.from('.nav-item', {
            duration: 1,
            y: -50,
            opacity: 0,
            delay: 0.4,
            stagger: 0.1
        });
        
        gsap.from('.hero-section h1', {
            duration: 1,
            y: 50,
            opacity: 0,
            delay: 0.6
        });
        
        gsap.from('.hero-section p', {
            duration: 1,
            y: 50,
            opacity: 0,
            delay: 0.8
        });
        
        gsap.from('.hero-section .btn', {
            duration: 1,
            y: 50,
            opacity: 0,
            delay: 1,
            stagger: 0.1
        });
        
        gsap.from('.hero-image', {
            duration: 1,
            x: 50,
            opacity: 0,
            delay: 0.8
        });
    }
});