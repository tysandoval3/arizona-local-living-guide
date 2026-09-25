// Active-section highlighting for the sticky nav.
// (Scroll motion — smooth scroll, reveals, parallax — lives in js/motion.js.)

const navLinks = [...document.querySelectorAll('.section-nav a[href^="#"]')];
const sectionsById = new Map(
  navLinks
    .map((link) => document.getElementById(link.hash.slice(1)))
    .filter(Boolean)
    .map((section) => [section.id, section])
);

const sectionObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      navLinks.forEach((link) =>
        link.classList.toggle('active', link.hash === `#${entry.target.id}`)
      );
      const active = document.querySelector('.section-nav a.active');
      if (active) active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  },
  { rootMargin: '-30% 0px -60% 0px' }
);

sectionsById.forEach((section) => sectionObserver.observe(section));
