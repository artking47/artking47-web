/* ============================================
   GLASSMORPHISM LANDING — JAVASCRIPT
   Navbar, Smooth Scroll, Animations, Gallery
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  // ---- Elements ----
  const navbar = document.getElementById('navbar');
  const navLinks = document.getElementById('navLinks');
  const navHamburger = document.getElementById('navHamburger');
  const navOverlay = document.getElementById('navOverlay');
  let heroSlides = document.querySelectorAll('.hero-slide');
  let statNumbers = document.querySelectorAll('.stat-number[data-count]');
  const contactForm = document.getElementById('contactForm');

  // ============================================
  // SECURITY — Sanitization Utilities
  // ============================================
  const STORAGE_KEY = 'artking47_site_data';
  const INTEGRITY_KEY = 'artking47_integrity';

  // Strip ALL HTML tags — for plain text fields
  function sanitize(str) {
    if (typeof str !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Allow only safe HTML tags (br, span, strong, em, b, i) with 'class' attr only
  function sanitizeRichHTML(str) {
    if (typeof str !== 'string') return '';
    const allowedTags = ['br', 'span', 'strong', 'em', 'b', 'i'];
    const parser = new DOMParser();
    const doc = parser.parseFromString(str, 'text/html');
    function cleanNode(node) {
      const frag = document.createDocumentFragment();
      node.childNodes.forEach(child => {
        if (child.nodeType === Node.TEXT_NODE) {
          frag.appendChild(document.createTextNode(child.textContent));
        } else if (child.nodeType === Node.ELEMENT_NODE) {
          const tag = child.tagName.toLowerCase();
          if (allowedTags.includes(tag)) {
            const el = document.createElement(tag);
            // Only preserve 'class' attribute, sanitized
            if (child.hasAttribute('class')) {
              el.className = child.getAttribute('class').replace(/[^a-zA-Z0-9_ -]/g, '');
            }
            el.appendChild(cleanNode(child));
            frag.appendChild(el);
          } else {
            // Unwrap: keep text content, strip the tag
            frag.appendChild(cleanNode(child));
          }
        }
      });
      return frag;
    }
    const container = document.createElement('div');
    container.appendChild(cleanNode(doc.body));
    return container.innerHTML;
  }

  // Validate URL — block javascript: and data: protocols
  function sanitizeURL(url) {
    if (typeof url !== 'string') return '#';
    url = url.trim();
    try {
      const parsed = new URL(url);
      if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) return url;
    } catch (e) { /* invalid URL */ }
    return '#';
  }

  // Validate data URL for images only
  function isValidDataURL(str) {
    if (typeof str !== 'string') return false;
    return /^data:image\/(jpeg|png|gif|webp|svg\+xml);base64,/.test(str);
  }

  // Sanitize CSS class names — only alphanumeric, hyphens, underscores
  function sanitizeCSSClass(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  // ============================================
  // INTEGRITY — Verify localStorage data
  // ============================================
  function computeHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return 'h_' + Math.abs(hash).toString(36);
  }

  // ============================================
  // LOAD CONTENT FROM FIREBASE / LOCALSTORAGE
  // ============================================
  async function loadContentFromStorage() {
    let data = null;

    // Try Firebase Firestore first
    if (typeof initFirebase === 'function') {
      initFirebase();
    }
    if (typeof firebaseReady !== 'undefined' && firebaseReady && typeof firebaseLoadSiteData === 'function') {
      try {
        const fbData = await firebaseLoadSiteData();
        if (fbData) {
          delete fbData._lastModified;
          delete fbData._version;
          data = fbData;
          console.log('[Landing] ✅ Data loaded from Firebase');
        }
      } catch (e) {
        console.warn('[Landing] Firebase load failed, using localStorage fallback');
      }
    }

    // Fallback to localStorage
    if (!data) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return; // Use HTML defaults

      // Integrity check
      const storedHash = localStorage.getItem(INTEGRITY_KEY);
      const currentHash = computeHash(stored);
      if (storedHash && storedHash !== currentHash) {
        console.warn('[SECURITY] localStorage data integrity check failed.');
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(INTEGRITY_KEY);
        return;
      }

      try { data = JSON.parse(stored); } catch (e) { return; }
    }

    if (!data) return;

    // --- General (SANITIZED) ---
    if (data.general) {
      const g = data.general;
      // Site name in navbar — sanitized plain text
      const navLogo = document.querySelector('.nav-logo');
      if (navLogo && g.siteName) {
        navLogo.innerHTML = `<span class="logo-dot"></span>${sanitize(g.siteName)}`;
      }
      // Hero badge — sanitized plain text
      const badge = document.querySelector('.hero-badge');
      if (badge && g.badge) {
        badge.innerHTML = `<span class="badge-dot"></span>${sanitize(g.badge)}`;
      }
      // Hero title — allows limited safe HTML (br, span, strong, em)
      const heroTitle = document.querySelector('.hero-title');
      if (heroTitle && g.heroTitle) heroTitle.innerHTML = sanitizeRichHTML(g.heroTitle);
      // Hero description — plain text only
      const heroDesc = document.querySelector('.hero-description');
      if (heroDesc && g.heroDesc) heroDesc.textContent = g.heroDesc;
      // Footer — sanitized
      const footerCopy = document.querySelector('.footer-copy');
      if (footerCopy && g.siteName) {
        footerCopy.innerHTML = `&copy; ${new Date().getFullYear()} ${sanitize(g.siteName)}. Todos los derechos reservados.`;
      }
    }

    // --- Hero Slides (SANITIZED) ---
    if (data.hero && data.hero.slides) {
      const gallery = document.querySelector('.hero-gallery');
      if (gallery) {
        gallery.innerHTML = '';
        data.hero.slides.forEach((slide, i) => {
          const div = document.createElement('div');
          div.className = 'hero-slide' + (i === 0 ? ' active' : '');
          if (slide.type === 'image' && slide.image && isValidDataURL(slide.image)) {
            const img = document.createElement('img');
            img.src = slide.image;
            img.alt = 'Slide ' + (i + 1);
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            div.appendChild(img);
          } else {
            const cssClass = sanitizeCSSClass(slide.cssClass || 'slide-art-' + (i + 1));
            div.innerHTML = `<div class="hero-slide-bg ${cssClass}"></div>`;
          }
          gallery.appendChild(div);
        });
        // Refresh heroSlides reference
        heroSlides = document.querySelectorAll('.hero-slide');
      }
    }

    // --- About (SANITIZED) ---
    if (data.about) {
      const a = data.about;
      // Avatar — validate image data URL
      const avatarEl = document.querySelector('.about-avatar');
      const placeholderEl = document.querySelector('.about-image-placeholder');
      if (placeholderEl && a.avatarImage && isValidDataURL(a.avatarImage)) {
        placeholderEl.classList.add('has-photo');
        const img = document.createElement('img');
        img.src = a.avatarImage;
        img.alt = 'Avatar';
        placeholderEl.innerHTML = '';
        placeholderEl.appendChild(img);
      } else if (avatarEl && a.avatarInitials) {
        avatarEl.textContent = sanitize(a.avatarInitials).substring(0, 3);
      }
      // Bio
      const bioParas = document.querySelectorAll('.about-text .animate-on-scroll.delay-1 p');
      if (bioParas.length >= 2) {
        if (a.bio1) bioParas[0].textContent = a.bio1;
        if (a.bio2) bioParas[1].textContent = a.bio2;
      }
      // Stats
      if (a.stats && a.stats.length >= 3) {
        const statItems = document.querySelectorAll('.stat-item');
        a.stats.forEach((stat, i) => {
          if (statItems[i]) {
            const numEl = statItems[i].querySelector('.stat-number');
            const labelEl = statItems[i].querySelector('.stat-label');
            if (numEl) { numEl.setAttribute('data-count', stat.number); numEl.textContent = '0'; }
            if (labelEl) labelEl.textContent = stat.label;
          }
        });
        // Refresh stat numbers reference
        statNumbers = document.querySelectorAll('.stat-number[data-count]');
      }
    }

    // --- Portfolio (SANITIZED) — with gallery lightbox ---
    if (data.portfolio && data.portfolio.length > 0) {
      const grid = document.querySelector('.portfolio-grid');
      if (grid) {
        grid.innerHTML = '';
        const cssArts = ['port-art-1', 'port-art-2', 'port-art-3', 'port-art-4', 'port-art-5', 'port-art-6'];

        // Store portfolio data for modal access
        window.__portfolioData = data.portfolio;

        data.portfolio.forEach((project, i) => {
          // Backwards compatibility: migrate single image to images array
          const images = project.images || (project.image ? [project.image] : []);
          const delay = (i % 3) + 1;
          const card = document.createElement('div');
          card.className = `portfolio-card glass glass-hover animate-on-scroll delay-${delay}`;
          card.style.cursor = 'pointer';
          card.setAttribute('data-project-index', i);

          let thumbContent;
          if (images.length > 0 && isValidDataURL(images[0])) {
            thumbContent = `<img src="${images[0]}" alt="${sanitize(project.title)}" class="portfolio-art" style="width:100%;height:100%;object-fit:cover;">`;
          } else {
            const artClass = sanitizeCSSClass(project.cssArt || cssArts[i % cssArts.length]);
            thumbContent = `<div class="portfolio-art ${artClass}"></div>`;
          }

          // Badges
          let badges = '';
          if (images.length > 1) {
            badges += `<span class="portfolio-badge">${images.length} 📷</span>`;
          }
          if (project.link) {
            badges += `<span class="portfolio-badge portfolio-badge-link">🔗</span>`;
          }

          card.innerHTML = `
            <div class="portfolio-thumbnail">
              ${thumbContent}
              ${badges ? `<div class="portfolio-badges">${badges}</div>` : ''}
              <div class="portfolio-overlay">
                <span class="portfolio-overlay-icon">👁️ Ver proyecto</span>
              </div>
            </div>
            <div class="portfolio-info">
              <span class="portfolio-category">${sanitize(project.category)}</span>
              <h3 class="portfolio-title">${sanitize(project.title)}</h3>
            </div>
          `;

          // Click handler for modal
          card.addEventListener('click', () => openProjectModal(i));
          grid.appendChild(card);
        });
      }
    }

    // --- Services (SANITIZED) ---
    if (data.services && data.services.length > 0) {
      const grid = document.querySelector('.services-grid');
      if (grid) {
        // Lucide icon names for each service
        const iconNames = [
          'layers',         // Logos & Identidad
          'file-text',      // Flyers & Material
          'image',          // Posts Redes Sociales
          'credit-card',    // Business Cards
          'monitor',        // Banners & Publicidad
          'plus-circle'     // Y Mucho Más
        ];

        grid.innerHTML = '';
        data.services.forEach((service, i) => {
          const delay = (i % 5) + 1;
          const iconName = iconNames[i % iconNames.length];
          const card = document.createElement('div');
          card.className = `service-card glass glass-hover animate-on-scroll delay-${delay}`;
          card.innerHTML = `
            <div class="service-icon"><i data-lucide="${iconName}" color="#d62839" stroke-width="1.5"></i></div>
            <h3 class="service-name">${sanitize(service.name)}</h3>
            <p class="service-desc">${sanitize(service.desc)}</p>
          `;
          grid.appendChild(card);
        });
      }
    }

    // --- Contact (SANITIZED) ---
    if (data.contact) {
      const c = data.contact;
      // Find by parent structure — textContent is already safe
      const contactItems = document.querySelectorAll('.contact-info-item');
      if (contactItems[0] && c.email) contactItems[0].querySelector('.contact-detail p').textContent = c.email;
      if (contactItems[1] && c.location) contactItems[1].querySelector('.contact-detail p').textContent = c.location;
      if (contactItems[2] && c.availability) contactItems[2].querySelector('.contact-detail p').textContent = c.availability;

      // Social links — validate URLs
      if (c.socials) {
        const socialLinks = document.querySelectorAll('.social-link');
        const socialOrder = ['behance', 'dribbble', 'instagram', 'linkedin', 'twitter'];
        socialOrder.forEach((platform, i) => {
          if (socialLinks[i] && c.socials[platform]) {
            socialLinks[i].href = sanitizeURL(c.socials[platform]);
          }
        });
      }
    }
  }

  // ============================================
  // PROJECT MODAL — Lightbox Gallery
  // ============================================
  let currentModalImageIndex = 0;
  let currentModalImages = [];

  function openProjectModal(projectIndex) {
    const project = window.__portfolioData?.[projectIndex];
    if (!project) return;

    const images = project.images || (project.image ? [project.image] : []);
    currentModalImages = images;
    currentModalImageIndex = 0;

    // Remove existing modal
    const existing = document.getElementById('projectModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'projectModal';
    modal.className = 'project-modal';

    const hasImages = images.length > 0;
    const cssArts = ['port-art-1', 'port-art-2', 'port-art-3', 'port-art-4', 'port-art-5', 'port-art-6'];
    const artClass = project.cssArt || cssArts[projectIndex % cssArts.length];

    let imageSection;
    if (hasImages) {
      imageSection = `
        <div class="modal-gallery">
          <img src="${images[0]}" alt="${sanitize(project.title)}" class="modal-gallery-img" id="modalMainImage">
          ${images.length > 1 ? `
            <button class="modal-nav modal-nav-prev" id="modalPrev">‹</button>
            <button class="modal-nav modal-nav-next" id="modalNext">›</button>
            <div class="modal-counter" id="modalCounter">1 / ${images.length}</div>
          ` : ''}
        </div>
      `;
    } else {
      imageSection = `<div class="modal-gallery"><div class="portfolio-art ${sanitizeCSSClass(artClass)}" style="width:100%;height:400px;border-radius:12px;"></div></div>`;
    }

    modal.innerHTML = `
      <div class="modal-backdrop" id="modalBackdrop"></div>
      <div class="modal-content">
        <button class="modal-close" id="modalClose">✕</button>
        ${imageSection}
        ${images.length > 1 ? `
          <div class="modal-thumbs">
            ${images.map((img, i) => `<img src="${img}" class="modal-thumb ${i === 0 ? 'active' : ''}" data-img-index="${i}" alt="Thumb ${i + 1}">`).join('')}
          </div>
        ` : ''}
        <div class="modal-details">
          <span class="modal-category">${sanitize(project.category)}</span>
          <h2 class="modal-title">${sanitize(project.title)}</h2>
          ${project.description ? `<p class="modal-description">${sanitize(project.description)}</p>` : ''}
          ${project.link ? `<a href="${sanitizeURL(project.link)}" target="_blank" rel="noopener noreferrer" class="modal-link">🔗 Ver en portafolio externo →</a>` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    // Force reflow then animate
    requestAnimationFrame(() => modal.classList.add('active'));

    // Close handlers
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.remove();
        document.body.style.overflow = '';
      }, 300);
    };

    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalBackdrop').addEventListener('click', closeModal);

    // Image navigation
    if (images.length > 1) {
      const updateImage = (idx) => {
        currentModalImageIndex = idx;
        const mainImg = document.getElementById('modalMainImage');
        mainImg.style.opacity = '0';
        setTimeout(() => {
          mainImg.src = images[idx];
          mainImg.style.opacity = '1';
        }, 200);
        document.getElementById('modalCounter').textContent = `${idx + 1} / ${images.length}`;
        modal.querySelectorAll('.modal-thumb').forEach((t, ti) => t.classList.toggle('active', ti === idx));
      };

      document.getElementById('modalPrev').addEventListener('click', (e) => {
        e.stopPropagation();
        updateImage((currentModalImageIndex - 1 + images.length) % images.length);
      });
      document.getElementById('modalNext').addEventListener('click', (e) => {
        e.stopPropagation();
        updateImage((currentModalImageIndex + 1) % images.length);
      });

      // Thumb clicks
      modal.querySelectorAll('.modal-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => updateImage(parseInt(thumb.dataset.imgIndex)));
      });
    }

    // Keyboard
    const handleKeydown = (e) => {
      if (e.key === 'Escape') closeModal();
      if (images.length > 1) {
        if (e.key === 'ArrowLeft') document.getElementById('modalPrev')?.click();
        if (e.key === 'ArrowRight') document.getElementById('modalNext')?.click();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    modal.addEventListener('transitionend', () => {
      if (!modal.classList.contains('active')) document.removeEventListener('keydown', handleKeydown);
    });
  }

  // Load admin content (async — Firebase first, localStorage fallback)
  (async () => {
    await loadContentFromStorage();
    // Re-render Lucide after dynamic Firebase content
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // CRITICAL: Re-observe new elements created by Firebase data
    // The initial observer runs before async data loads,
    // so dynamically created cards never get the 'visible' class.
    document.querySelectorAll('.animate-on-scroll:not(.visible)').forEach(el => {
      if (typeof _scrollObserver !== 'undefined') _scrollObserver.observe(el);
    });

    // Re-initialize hero slideshow (slides may have changed from Firebase)
    heroSlides = document.querySelectorAll('.hero-slide');
    statNumbers = document.querySelectorAll('.stat-number[data-count]');
  })();

  // Render Lucide icons (initial pass)
  if (typeof lucide !== 'undefined') lucide.createIcons();

  // ============================================
  // NAVBAR — Scroll Effect (RAF throttled)
  // ============================================
  let lastScroll = 0;
  let scrollTicking = false;

  function handleNavScroll() {
    const scrollY = window.scrollY;

    if (scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    lastScroll = scrollY;
    scrollTicking = false;
  }

  window.addEventListener('scroll', () => {
    if (!scrollTicking) {
      requestAnimationFrame(handleNavScroll);
      scrollTicking = true;
    }
  }, { passive: true });
  handleNavScroll(); // Initial check

  // ============================================
  // MOBILE MENU
  // ============================================
  function toggleMobileMenu() {
    navHamburger.classList.toggle('active');
    navLinks.classList.toggle('open');
    navOverlay.classList.toggle('active');
    document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
  }

  function closeMobileMenu() {
    navHamburger.classList.remove('active');
    navLinks.classList.remove('open');
    navOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  navHamburger.addEventListener('click', toggleMobileMenu);
  navOverlay.addEventListener('click', closeMobileMenu);

  // Close menu on link click
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMobileMenu);
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileMenu();
  });

  // ============================================
  // SMOOTH SCROLL — for nav links
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (targetId === '#') return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      const navHeight = navbar.offsetHeight;
      const targetPos = target.getBoundingClientRect().top + window.scrollY - navHeight;

      window.scrollTo({
        top: targetPos,
        behavior: 'smooth'
      });
    });
  });

  // ============================================
  // ACTIVE NAV LINK — Highlight on scroll
  // ============================================
  const sections = document.querySelectorAll('section[id]');

  function updateActiveNav() {
    const scrollPos = window.scrollY + navbar.offsetHeight + 100;

    sections.forEach(section => {
      const top = section.offsetTop;
      const height = section.offsetHeight;
      const id = section.getAttribute('id');

      const link = navLinks.querySelector(`a[href="#${id}"]`);
      if (!link || link.classList.contains('nav-cta')) return;

      if (scrollPos >= top && scrollPos < top + height) {
        navLinks.querySelectorAll('a').forEach(a => a.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', updateActiveNav, { passive: true });
  updateActiveNav();

  // ============================================
  // HERO GALLERY — Slideshow (re-init after content load)
  // ============================================
  heroSlides = document.querySelectorAll('.hero-slide'); // Refresh reference
  let currentSlide = 0;
  const slideCount = heroSlides.length;
  const slideInterval = 5000; // 5 seconds

  function nextSlide() {
    heroSlides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slideCount;
    heroSlides[currentSlide].classList.add('active');
  }

  if (slideCount > 1) {
    setInterval(nextSlide, slideInterval);
  }

  // ============================================
  // INTERSECTION OBSERVER — Scroll Animations (optimized)
  // ============================================
  const animatedElements = document.querySelectorAll('.animate-on-scroll');

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -10% 0px',
    threshold: 0.08
  };

  // Hoisted to outer scope so async Firebase loader can re-observe new elements
  const _scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        // Clean up will-change after animation completes
        entry.target.addEventListener('transitionend', () => {
          entry.target.style.willChange = 'auto';
        }, { once: true });
        _scrollObserver.unobserve(entry.target);
      }
    });
  }, observerOptions);

  animatedElements.forEach(el => _scrollObserver.observe(el));

  // ============================================
  // STAT COUNTER — Animated numbers
  // ============================================
  let statsCounted = false;

  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-count'), 10);
    const duration = 2000;
    const start = performance.now();

    function update(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * target);

      el.textContent = current + (target >= 100 ? '+' : '+');

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  const statsSection = document.querySelector('.about-stats');

  if (statsSection) {
    const statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !statsCounted) {
          statsCounted = true;
          statNumbers.forEach(el => animateCounter(el));
          statsObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    statsObserver.observe(statsSection);
  }

  // ============================================
  // CONTACT FORM — Secured handling
  // ============================================
  const FORM_RATE_LIMIT = 3; // Max submissions
  const FORM_RATE_WINDOW = 5 * 60 * 1000; // 5 minutes
  let formSubmissions = [];

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();

      // Honeypot check — hidden field that bots fill in
      const honeypot = document.getElementById('contactWebsite');
      if (honeypot && honeypot.value) {
        console.warn('[SECURITY] Honeypot triggered. Bot submission blocked.');
        return;
      }

      // Rate limiting
      const now = Date.now();
      formSubmissions = formSubmissions.filter(t => now - t < FORM_RATE_WINDOW);
      if (formSubmissions.length >= FORM_RATE_LIMIT) {
        const btn = contactForm.querySelector('button[type="submit"]');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '⚠️ Demasiados envíos. Espera unos minutos.';
        btn.style.pointerEvents = 'none';
        btn.style.background = '#ef4444';
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.pointerEvents = '';
          btn.style.background = '';
        }, 5000);
        return;
      }

      // Input validation with length limits
      const name = document.getElementById('contactName').value.trim().substring(0, 100);
      const email = document.getElementById('contactEmail').value.trim().substring(0, 254);
      const subject = document.getElementById('contactSubject').value.trim().substring(0, 200);
      const message = document.getElementById('contactMessage').value.trim().substring(0, 2000);

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        const btn = contactForm.querySelector('button[type="submit"]');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '❌ Email inválido';
        btn.style.background = '#ef4444';
        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.background = '';
        }, 3000);
        return;
      }

      if (!name || !email || !subject || !message) return;

      // Record submission for rate limiting
      formSubmissions.push(now);

      // Visual feedback
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalHTML = btn.innerHTML;

      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        ¡Mensaje enviado!
      `;
      btn.style.pointerEvents = 'none';
      btn.style.background = 'linear-gradient(135deg, #10b981, #06b6d4)';

      // Reset after 3s
      setTimeout(() => {
        btn.innerHTML = originalHTML;
        btn.style.pointerEvents = '';
        btn.style.background = '';
        contactForm.reset();
      }, 3000);

      // Log to console (replace with actual backend)
      console.log('Form submitted:', { name: sanitize(name), email: sanitize(email), subject: sanitize(subject), message: sanitize(message) });
    });
  }

  // ============================================
  // PARALLAX — Subtle hero effect
  // ============================================
  const heroGallery = document.querySelector('.hero-gallery');

  function handleParallax() {
    if (!heroGallery) return;
    const scrollY = window.scrollY;
    const speed = 0.3;

    if (scrollY < window.innerHeight) {
      heroGallery.style.transform = `translateY(${scrollY * speed}px)`;
    }
  }

  // Only enable on desktop
  if (window.matchMedia('(min-width: 769px)').matches) {
    window.addEventListener('scroll', handleParallax, { passive: true });
  }

  // ============================================
  // CURSOR GLOW — Subtle mouse glow effect
  // ============================================
  if (window.matchMedia('(min-width: 769px) and (pointer: fine)').matches) {
    const glow = document.createElement('div');
    glow.style.cssText = `
      position: fixed;
      width: 300px;
      height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(230, 57, 70, 0.06), transparent 70%);
      pointer-events: none;
      z-index: 0;
      transform: translate(-50%, -50%);
      transition: opacity 0.3s ease;
      will-change: left, top;
    `;
    document.body.appendChild(glow);

    let mouseX = 0, mouseY = 0;
    let glowX = 0, glowY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    }, { passive: true });

    function updateGlow() {
      glowX += (mouseX - glowX) * 0.08;
      glowY += (mouseY - glowY) * 0.08;
      glow.style.left = glowX + 'px';
      glow.style.top = glowY + 'px';
      requestAnimationFrame(updateGlow);
    }

    requestAnimationFrame(updateGlow);
  }

  // ============================================
  // PAGE LOADER
  // ============================================
  const pageLoader = document.getElementById('pageLoader');
  if (pageLoader) {
    setTimeout(() => pageLoader.classList.add('loaded'), 1800);
  }

  // ============================================
  // CUSTOM CURSOR
  // ============================================
  const cursorDot = document.getElementById('cursorDot');
  const cursorRing = document.getElementById('cursorRing');
  if (cursorDot && cursorRing && window.matchMedia('(hover: hover)').matches) {
    let cx = 0, cy = 0, rx = 0, ry = 0;
    document.addEventListener('mousemove', (e) => {
      cx = e.clientX; cy = e.clientY;
      cursorDot.style.left = cx + 'px';
      cursorDot.style.top = cy + 'px';
    }, { passive: true });

    function updateRing() {
      rx += (cx - rx) * 0.12;
      ry += (cy - ry) * 0.12;
      cursorRing.style.left = rx + 'px';
      cursorRing.style.top = ry + 'px';
      requestAnimationFrame(updateRing);
    }
    requestAnimationFrame(updateRing);

    // Expand ring on interactive elements
    document.querySelectorAll('a, button, .btn, .portfolio-card, .service-card, .faq-question').forEach(el => {
      el.addEventListener('mouseenter', () => cursorRing.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursorRing.classList.remove('hover'));
    });
  }

  // ============================================
  // DARK / LIGHT MODE TOGGLE
  // ============================================
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const savedTheme = localStorage.getItem('artking47_theme');
    if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);

    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('artking47_theme', next);
    });
  }

  // ============================================
  // FAQ ACCORDION
  // ============================================
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');

      // Close all
      document.querySelectorAll('.faq-item.open').forEach(openItem => {
        openItem.classList.remove('open');
        openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });

      // Toggle this one
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // ============================================
  // HERO TYPING EFFECT
  // ============================================
  const heroTitle = document.querySelector('.hero-title');
  if (heroTitle) {
    const gradientSpan = heroTitle.querySelector('.gradient-text');
    if (gradientSpan) {
      const word = gradientSpan.textContent;
      gradientSpan.textContent = '';
      gradientSpan.style.display = 'inline';
      const cursor = document.createElement('span');
      cursor.className = 'typing-cursor';
      gradientSpan.after(cursor);

      let charIdx = 0;
      function typeChar() {
        if (charIdx < word.length) {
          gradientSpan.textContent += word[charIdx];
          charIdx++;
          setTimeout(typeChar, 100 + Math.random() * 60);
        } else {
          setTimeout(() => cursor.remove(), 2000);
        }
      }
      // Start after loader
      setTimeout(typeChar, 2200);
    }
  }

  // ============================================
  // HERO MOUSE PARALLAX
  // ============================================
  const heroContent = document.querySelector('.hero-content');
  const heroSection = document.querySelector('.hero');
  if (heroContent && heroSection && window.matchMedia('(hover: hover)').matches) {
    heroSection.addEventListener('mousemove', (e) => {
      const rect = heroSection.getBoundingClientRect();
      const xRatio = (e.clientX - rect.left) / rect.width - 0.5;
      const yRatio = (e.clientY - rect.top) / rect.height - 0.5;
      heroContent.style.transform = `translate3d(${xRatio * -15}px, ${yRatio * -10}px, 0)`;
    }, { passive: true });

    heroSection.addEventListener('mouseleave', () => {
      heroContent.style.transform = 'translate3d(0, 0, 0)';
      heroContent.style.transition = 'transform 0.5s ease';
      setTimeout(() => heroContent.style.transition = '', 500);
    });
  }

  // ============================================
  // ANIMATED STAT COUNTERS
  // ============================================
  const statNums = document.querySelectorAll('.stat-number[data-count]');
  if (statNums.length > 0) {
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-count'));
          const suffix = el.textContent.replace(/[0-9]/g, '');
          let current = 0;
          const increment = Math.ceil(target / 60);
          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            el.textContent = current + suffix;
          }, 25);
          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });

    statNums.forEach(el => countObserver.observe(el));
  }

  // ============================================
  // CONTACT FORM — Formspree Integration
  // ============================================
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Honeypot check
      const honeypot = document.getElementById('contactWebsite');
      if (honeypot && honeypot.value) return;

      const submitBtn = contactForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span style="animation: loaderPulse 0.6s infinite">⏳</span> Enviando...';
      submitBtn.disabled = true;

      const formData = new FormData(contactForm);
      formData.append('name', document.getElementById('contactName')?.value || '');
      formData.append('email', document.getElementById('contactEmail')?.value || '');
      formData.append('subject', document.getElementById('contactSubject')?.value || '');
      formData.append('message', document.getElementById('contactMessage')?.value || '');

      try {
        const res = await fetch('https://formspree.io/f/xjkwqzrn', {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });

        if (res.ok) {
          submitBtn.innerHTML = '✅ ¡Mensaje enviado!';
          submitBtn.style.background = 'linear-gradient(135deg, #25D366, #128C7E)';
          contactForm.reset();
          setTimeout(() => {
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            submitBtn.style.background = '';
          }, 3000);
        } else {
          throw new Error('Form error');
        }
      } catch {
        submitBtn.innerHTML = '❌ Error, intenta de nuevo';
        submitBtn.disabled = false;
        setTimeout(() => { submitBtn.innerHTML = originalText; }, 2500);
      }
    });
  }

  // ============================================
  // EASTER EGG — Type "artking47"
  // ============================================
  let easterBuffer = '';
  document.addEventListener('keydown', (e) => {
    easterBuffer += e.key.toLowerCase();
    if (easterBuffer.length > 15) easterBuffer = easterBuffer.slice(-15);
    if (easterBuffer.includes('artking47')) {
      easterBuffer = '';
      // Confetti burst
      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.cssText = `
          position: fixed;
          width: ${6 + Math.random() * 8}px;
          height: ${6 + Math.random() * 8}px;
          background: hsl(${Math.random() * 360}, 80%, 60%);
          left: ${50 + (Math.random() - 0.5) * 30}vw;
          top: 50vh;
          border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
          z-index: 999999;
          pointer-events: none;
          animation: confettiFall ${1.5 + Math.random() * 2}s ease forwards;
        `;
        document.body.appendChild(confetti);
        setTimeout(() => confetti.remove(), 4000);
      }

      // Add confetti animation if it doesn't exist
      if (!document.getElementById('confettiStyle')) {
        const style = document.createElement('style');
        style.id = 'confettiStyle';
        style.textContent = `
          @keyframes confettiFall {
            0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
            100% { transform: translate(${Math.random() > 0.5 ? '' : '-'}${50 + Math.random() * 100}px, ${300 + Math.random() * 400}px) rotate(${360 + Math.random() * 720}deg); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
    }
  });

  // ============================================
  // PWA — SERVICE WORKER REGISTRATION
  // ============================================
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
});

