/* ============================================================
   premium-web-motion — motion.js
   A drop-in, data-attribute-driven scroll-motion layer built on
   Lenis (smooth momentum scroll) + GSAP/ScrollTrigger (reveals,
   parallax, pinned scrub scenes). Zero project-specific code.

   LOAD ORDER (before this file):
     <script src="vendor/lenis.min.js"></script>
     <script src="vendor/gsap.min.js"></script>
     <script src="vendor/ScrollTrigger.min.js"></script>
     <script src="motion.js"></script>   (or defer all four)

   MARKUP API:
     data-reveal[="up|fade|left|right|scale"]  on-enter reveal
     data-reveal-group                          stagger direct children
     data-parallax="0.2"                        move at a fraction of scroll (y)
     data-parallax="-0.15"                      negative = opposite direction
     data-parallax-scale="1.15"                 scale from 1 → value across scroll
     data-pin-scene [data-scene-length="150%"]  pin section; scrub its steps
        data-pin-step                           child steps animated across the pin
     data-watermark                             (style via .watermark; add data-parallax for drift)
     data-nav-condense [data-condense-at="40"]  toggles .is-condensed past N px

   ACCESSIBILITY: honors prefers-reduced-motion at TWO levels — it
   bails entirely (native scroll, everything visible) AND every GSAP
   build is wrapped in gsap.matchMedia. Pinned scenes are also
   disabled below --pin-min-width (default 768px).

   FALLBACK: if any library is missing, adds html.motion-disabled and
   returns, leaving native scroll + fully visible content.
   ============================================================ */
(function () {
  'use strict';

  var root = document.documentElement;
  var hasLibs = window.gsap && window.ScrollTrigger && window.Lenis;
  var prefersReduced = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Fallback: no libs or reduced motion → visible, native scroll ----
  if (!hasLibs || prefersReduced) {
    root.classList.add('motion-disabled');
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  gsap.registerPlugin(ScrollTrigger);

  // Safe to hide-before-reveal now (JS confirmed + motion allowed).
  root.classList.add('motion-ready');

  // ---- 1. Smooth momentum scroll: single scroll authority --------------
  // One Lenis instance, driven by GSAP's ticker so nothing double-drives
  // the rAF loop (prevents stale-scroll jank in ScrollTrigger).
  var lenis = new window.Lenis({
    duration: 1.1,
    easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
    smoothWheel: true,
    // Touch: keep native feel; smoothing on touch is widely disabled.
    syncTouch: false,
    autoRaf: false,
    // Offset anchor targets so headings clear the sticky site header.
    anchors: {
      offset: -((document.querySelector('.site-header') || { offsetHeight: 0 }).offsetHeight + 16)
    },
    respectReducedMotion: true
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);
  window.__lenis = lenis; // expose for debugging / programmatic scrollTo

  // ---- 2. Everything below is wrapped so it's never built for -----------
  //         reduced-motion users, and pin scenes only build on desktop.
  var mm = gsap.matchMedia();
  var PIN_MIN = getComputedStyle(root).getPropertyValue('--pin-min-width').trim() || '768px';

  // Reveals + parallax: any pointer, no-preference motion.
  mm.add('(prefers-reduced-motion: no-preference)', function () {

    // -- On-enter reveals (adds .is-revealed; CSS does the transition) --
    gsap.utils.toArray('[data-reveal]').forEach(function (el) {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: function () { el.classList.add('is-revealed'); }
      });
    });
    gsap.utils.toArray('[data-reveal-group]').forEach(function (el) {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 85%',
        once: true,
        onEnter: function () { el.classList.add('is-revealed'); }
      });
    });

    // -- Parallax (y translate, scrubbed 1:1 to scroll) --
    gsap.utils.toArray('[data-parallax]').forEach(function (el) {
      var factor = parseFloat(el.getAttribute('data-parallax')) || 0.2;
      var overscan = parseFloat(
        getComputedStyle(el).getPropertyValue('--parallax-overscan')) || 60;
      // travel = factor * the element's own scroll distance
      gsap.fromTo(el,
        { yPercent: -factor * 100 * 0.5 },
        {
          yPercent: factor * 100 * 0.5,
          ease: 'none',
          scrollTrigger: {
            trigger: el.closest('.parallax-frame') || el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        }
      );
      void overscan;
    });

    // -- Parallax scale (image grows slightly as it scrolls through) --
    gsap.utils.toArray('[data-parallax-scale]').forEach(function (el) {
      var to = parseFloat(el.getAttribute('data-parallax-scale')) || 1.15;
      gsap.fromTo(el, { scale: 1 }, {
        scale: to, ease: 'none',
        scrollTrigger: {
          trigger: el.closest('.parallax-frame') || el,
          start: 'top bottom', end: 'bottom top', scrub: true
        }
      });
    });

    return function () { /* cleanup handled by matchMedia revert */ };
  });

  // -- Pinned scrub scenes: desktop + no-preference only --
  // Three flavors, chosen by what the scene contains:
  //   • has [data-pin-track]  → horizontal scroll (translate the wide track)
  //   • has [data-pin-step]   → cross-fade the steps (statement/story scenes)
  //   • neither               → simple hold-pin (pair with data-parallax inside)
  mm.add('(prefers-reduced-motion: no-preference) and (min-width: ' + PIN_MIN + ')', function () {
    gsap.utils.toArray('[data-pin-scene]').forEach(function (scene) {
      var track = scene.querySelector('[data-pin-track]');

      if (track) {
        // Horizontal scroll: move the track by its overflow width.
        var getDistance = function () {
          return Math.max(0, track.scrollWidth - scene.offsetWidth);
        };
        gsap.to(track, {
          x: function () { return -getDistance(); },
          ease: 'none',
          force3D: true, // keep the track on its own GPU layer for the whole scrub
          scrollTrigger: {
            trigger: scene,
            start: 'top top',
            end: function () { return '+=' + getDistance(); },
            scrub: 1, // longer catch-up smooths discrete wheel ticks into glide
            pin: true,
            anticipatePin: 1,
            invalidateOnRefresh: true
          }
        });
        return;
      }

      var steps = gsap.utils.toArray(scene.querySelectorAll('[data-pin-step]'));
      var lenAttr = scene.getAttribute('data-scene-length');
      var length = lenAttr || ((Math.max(steps.length, 1)) * 100) + '%';

      // Scrubbed timeline. RULE: never animate the pinned element itself —
      // only its children (steps). Pin measurements depend on the scene.
      var tl = gsap.timeline({
        scrollTrigger: {
          trigger: scene,
          start: 'top top',
          end: '+=' + length,
          scrub: 0.8,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true
        }
      });

      if (steps.length) {
        steps.forEach(function (step, i) {
          gsap.set(step, { autoAlpha: i === 0 ? 1 : 0, yPercent: i === 0 ? 0 : 6 });
        });
        // Sequential (NOT simultaneous) cross-fade with a dwell on each step,
        // so centered lines never overlap into an unreadable jumble.
        tl.to(steps[0], { autoAlpha: 1, duration: 0.6 }); // hold first
        for (var i = 1; i < steps.length; i++) {
          tl.to(steps[i - 1], { autoAlpha: 0, yPercent: -6, duration: 0.3 })
            .to(steps[i], { autoAlpha: 1, yPercent: 0, duration: 0.3 })
            .to(steps[i], { autoAlpha: 1, duration: 0.6 }); // dwell
        }
      }
    });
    return function () {};
  });

  // ---- 3. Nav condense on scroll (no lib needed, but grouped here) ------
  gsap.utils.toArray('[data-nav-condense]').forEach(function (nav) {
    var at = parseFloat(nav.getAttribute('data-condense-at')) || 40;
    ScrollTrigger.create({
      start: 'top -' + at,
      end: 99999,
      onUpdate: function (self) {
        nav.classList.toggle('is-condensed', self.scroll() > at);
      },
      onToggle: function (self) {
        nav.classList.toggle('is-condensed', self.isActive);
      }
    });
  });

  // Recalculate after web fonts load (metrics shift start/end positions).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  }
  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
