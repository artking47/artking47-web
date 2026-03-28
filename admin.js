/* ============================================
   ADMIN PANEL — JavaScript
   localStorage management, image uploads,
   export/import, dynamic content rendering
   ============================================ */

// ============================================
// SECURITY — Login Gate
// ============================================
const ADMIN_PASSWORD_HASH = 'e4f5a2b3c6d7e8f9a0b1c2d3e4f5a6b7'; // SHA-256 first 32 chars of 'ArtKing47Admin'
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60000; // 60 seconds
const SESSION_KEY = 'artking47_admin_session';
const INTEGRITY_KEY = 'artking47_integrity';

// Simple hash function for integrity checking
function computeHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'h_' + Math.abs(hash).toString(36);
}

// Simple password hash (SHA-256-like using built-in)
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '_artking47_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Initialize login gate
let loginAttempts = 0;
let lockoutUntil = 0;

function initLoginGate() {
    const gate = document.getElementById('loginGate');
    const loginBtn = document.getElementById('loginBtn');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const loginError = document.getElementById('loginError');

    if (!gate) return;

    // If Firebase Auth is available, check if already logged in
    if (firebaseReady && auth) {
        firebaseOnAuthStateChanged((user) => {
            if (user) {
                console.log('[Auth] Already authenticated:', user.email);
                unlockAdmin();
            }
        });
    }

    async function attemptLogin() {
        const now = Date.now();
        if (now < lockoutUntil) {
            const remaining = Math.ceil((lockoutUntil - now) / 1000);
            loginError.textContent = `Bloqueado. Espera ${remaining} segundos.`;
            loginError.classList.add('visible');
            return;
        }

        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';

        if (!password) return;

        // Try Firebase Auth first
        if (firebaseReady && email) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Conectando...';

            const result = await firebaseLogin(email, password);

            if (result.success) {
                sessionStorage.setItem(SESSION_KEY, 'authenticated');
                loginAttempts = 0;
                unlockAdmin();
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i data-lucide="lock-open" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"></i>Acceder';
                return;
            } else {
                loginAttempts++;
                loginError.textContent = result.error || 'Error de autenticación';
                loginError.classList.add('visible');
                loginBtn.disabled = false;
                loginBtn.innerHTML = '<i data-lucide="lock-open" style="width:16px;height:16px;vertical-align:middle;margin-right:6px;"></i>Acceder';
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        } else {
            // Fallback: old password hash method (offline/no Firebase)
            const hash = await hashPassword(password);
            let storedHash = localStorage.getItem('artking47_admin_hash');
            if (!storedHash) {
                const defaultHash = await hashPassword('ARTKING47**');
                localStorage.setItem('artking47_admin_hash', defaultHash);
                storedHash = defaultHash;
            }

            if (hash === storedHash) {
                sessionStorage.setItem(SESSION_KEY, 'authenticated');
                loginAttempts = 0;
                unlockAdmin();
                return;
            } else {
                loginAttempts++;
                loginError.textContent = `Credenciales incorrectas (${loginAttempts}/${MAX_LOGIN_ATTEMPTS})`;
                loginError.classList.add('visible');
            }
        }

        if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
            lockoutUntil = Date.now() + LOCKOUT_DURATION;
            loginError.textContent = `Demasiados intentos. Bloqueado por 60 segundos.`;
            if (emailInput) emailInput.disabled = true;
            passwordInput.disabled = true;
            loginBtn.disabled = true;
            setTimeout(() => {
                if (emailInput) emailInput.disabled = false;
                passwordInput.disabled = false;
                loginBtn.disabled = false;
                loginAttempts = 0;
                loginError.classList.remove('visible');
            }, LOCKOUT_DURATION);
        }

        passwordInput.value = '';
    }

    loginBtn.addEventListener('click', attemptLogin);
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') attemptLogin();
    });
}

function unlockAdmin() {
    const gate = document.getElementById('loginGate');
    if (gate) gate.classList.add('hidden');
    document.body.classList.add('admin-unlocked');
}

// File validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function validateImageFile(file) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showToast('❌ Tipo de archivo no permitido. Solo JPG, PNG, WebP y GIF.', true);
        return false;
    }
    if (file.size > MAX_FILE_SIZE) {
        showToast('❌ Archivo demasiado grande. Máximo 5MB.', true);
        return false;
    }
    return true;
}
// ---- Default Data ----
const DEFAULTS = {
    general: {
        siteName: 'ArtKing47',
        badge: 'Disponible para proyectos',
        heroTitle: 'Tu marca merece<br>un diseño <span class="gradient-text">brutal</span>',
        heroDesc: 'Logos, flyers, contenido para redes, business cards y todo lo que tu marca necesita para destacar. Diseño gráfico profesional con estilo y actitud.'
    },
    hero: {
        slides: [
            { type: 'css', cssClass: 'slide-art-1' },
            { type: 'css', cssClass: 'slide-art-2' },
            { type: 'css', cssClass: 'slide-art-3' }
        ]
    },
    about: {
        avatarImage: '',
        avatarInitials: 'AK',
        bio1: 'Soy ArtKing47, diseñador gráfico apasionado por crear piezas visuales que impactan. Me especializo en logos, flyers, contenido para redes sociales y business cards que hacen que tu marca se vea profesional y memorable.',
        bio2: 'Trabajo con emprendedores, negocios y marcas personales que quieren sobresalir con un diseño de otro nivel. Si lo puedes imaginar, yo lo puedo diseñar.',
        stats: [
            { number: 150, label: 'Proyectos' },
            { number: 80, label: 'Clientes' },
            { number: 8, label: 'Años exp.' }
        ]
    },
    portfolio: [
        { images: [], category: 'Logo & Branding', title: 'Nebula Cosmetics', description: 'Identidad visual completa para marca de cosméticos premium', link: '', cssArt: 'port-art-1' },
        { images: [], category: 'Business Cards', title: 'Vertex Studio', description: 'Tarjetas de presentación con acabado minimalista', link: '', cssArt: 'port-art-2' },
        { images: [], category: 'Flyer', title: 'Neon Nights Event', description: 'Flyer promocional para evento nocturno', link: '', cssArt: 'port-art-3' },
        { images: [], category: 'Redes Sociales', title: 'FitPro Gym', description: 'Pack de contenido para redes sociales', link: '', cssArt: 'port-art-4' },
        { images: [], category: 'Logo & Branding', title: 'Prism Records', description: 'Logo y branding completo para sello discográfico', link: '', cssArt: 'port-art-5' },
        { images: [], category: 'Flyer & Promo', title: 'Zenith Festival', description: 'Material promocional para festival de música', link: '', cssArt: 'port-art-6' }
    ],
    services: [
        { name: 'Logos & Identidad de Marca', desc: 'Logotipos profesionales y sistemas de identidad visual completos que definen la esencia de tu marca y la hacen inolvidable.' },
        { name: 'Flyers & Material Promocional', desc: 'Flyers, afiches y material impreso con diseños llamativos que capturan la atención y comunican tu mensaje con fuerza.' },
        { name: 'Posts para Redes Sociales', desc: 'Contenido visual de alto impacto para Instagram, Facebook, TikTok y más. Diseños que generan engagement y fortalecen tu presencia digital.' },
        { name: 'Business Cards', desc: 'Tarjetas de presentación con diseño premium que dejan una impresión profesional y memorable en cada contacto.' },
        { name: 'Banners & Publicidad Digital', desc: 'Banners, portadas y creatividades publicitarias optimizadas para campañas digitales que convierten y generan resultados.' },
        { name: 'Y Mucho Más', desc: 'Menús, invitaciones, presentaciones, mockups y cualquier pieza gráfica que necesites. Si lo imaginas, lo diseño.' }
    ],
    testimonials: [
        { name: 'María C.', initials: 'MC', role: 'Emprendedora, FitPro', text: 'Excelente trabajo, superó mis expectativas. El logo quedó increíble y la identidad visual de mi marca ahora es profesional. 100% recomendado.', stars: 5 },
        { name: 'José P.', initials: 'JP', role: 'Director, Zenith Festival', text: 'Rápido, creativo y con una atención al detalle impresionante. Los flyers para mi evento fueron un éxito total. Definitivamente volveré.', stars: 5 },
        { name: 'Laura R.', initials: 'LR', role: 'CEO, Prism Records', text: 'La mejor inversión para mi negocio. Mis redes sociales pasaron de 0 engagement a recibir mensajes diarios gracias al contenido visual de ArtKing47.', stars: 5 }
    ],
    process: [
        { title: 'Briefing', desc: 'Conversamos sobre tu visión, objetivos y estilo. Entiendo a fondo qué necesita tu marca.', icon: 'message-circle' },
        { title: 'Concepto', desc: 'Investigo, boceto y desarrollo propuestas creativas alineadas con tu identidad.', icon: 'lightbulb' },
        { title: 'Diseño', desc: 'Creo las piezas finales con precisión pixel-perfect. Revisiones incluidas hasta tu satisfacción.', icon: 'pen-tool' },
        { title: 'Entrega', desc: 'Recibes todos los archivos en formatos profesionales, listos para imprimir o publicar.', icon: 'rocket' }
    ],
    faq: [
        { question: '¿Cuánto cobra por un logo profesional?', answer: 'El precio depende de la complejidad y el alcance del proyecto. Contáctame para una cotización personalizada según tus necesidades específicas.' },
        { question: '¿Cuáles son los tiempos de entrega?', answer: 'Generalmente entre 3-7 días hábiles para la primera propuesta, dependiendo del proyecto. Trabajos urgentes tienen un recargo adicional.' },
        { question: '¿En qué formatos entrega los archivos?', answer: 'Entrego en todos los formatos necesarios: AI, PSD, PDF, PNG, JPG, SVG y más. Archivos listos para impresión y digital.' },
        { question: '¿Incluye revisiones?', answer: 'Sí, cada proyecto incluye rondas de revisiones para asegurar que el resultado final sea exactamente lo que necesitas.' },
        { question: '¿Trabaja con clientes internacionales?', answer: '¡Por supuesto! Trabajo con clientes de todo el mundo. La comunicación es por WhatsApp, email o videollamada.' }
    ],
    config: {
        whatsapp: '58412136056',
        formspree: 'xjkwqzrn'
    },
    contact: {
        email: 'contacto@artking47.com',
        location: 'Venezuela 🇻🇪',
        availability: 'Lun – Vie, 9:00 – 18:00 (VET, UTC-4)',
        socials: {
            behance: 'https://behance.net',
            dribbble: 'https://dribbble.com',
            instagram: 'https://instagram.com',
            linkedin: 'https://linkedin.com',
            twitter: 'https://twitter.com'
        }
    }
};

const STORAGE_KEY = 'artking47_site_data';

// ---- State ----
let siteData = {};

// ============================================
// STORAGE (Firebase Firestore + localStorage fallback)
// ============================================
async function loadAllFromStorage() {
    let loaded = false;

    // Try Firebase first
    if (firebaseReady) {
        const firebaseData = await firebaseLoadSiteData();
        if (firebaseData) {
            // Remove Firestore metadata
            delete firebaseData._lastModified;
            delete firebaseData._version;
            siteData = firebaseData;
            loaded = true;
            showToast('🔥 Datos cargados desde Firebase');
        }
    }

    // Fallback to localStorage
    if (!loaded) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                siteData = JSON.parse(stored);
                loaded = true;
            } catch (e) {
                siteData = JSON.parse(JSON.stringify(DEFAULTS));
            }
        } else {
            siteData = JSON.parse(JSON.stringify(DEFAULTS));
        }
    }

    // Merge with defaults to catch any new fields
    siteData.general = { ...DEFAULTS.general, ...siteData.general };
    siteData.hero = { ...DEFAULTS.hero, ...siteData.hero };
    siteData.about = { ...DEFAULTS.about, ...siteData.about };
    siteData.contact = { ...DEFAULTS.contact, ...siteData.contact };
    siteData.contact.socials = { ...DEFAULTS.contact.socials, ...siteData.contact?.socials };
    if (!siteData.portfolio) siteData.portfolio = [...DEFAULTS.portfolio];
    if (!siteData.services) siteData.services = [...DEFAULTS.services];
    if (!siteData.about.stats) siteData.about.stats = [...DEFAULTS.about.stats];
    if (!siteData.testimonials) siteData.testimonials = [...DEFAULTS.testimonials];
    if (!siteData.process) siteData.process = [...DEFAULTS.process];
    if (!siteData.faq) siteData.faq = [...DEFAULTS.faq];
    siteData.config = { ...DEFAULTS.config, ...siteData.config };

    populateAllForms();
}

async function saveAll() {
    collectAllForms();

    let savedToFirebase = false;

    // Save to Firebase Firestore
    if (firebaseReady) {
        savedToFirebase = await firebaseSaveSiteData(siteData);
    }

    // Always save to localStorage as backup
    try {
        const jsonData = JSON.stringify(siteData);
        localStorage.setItem(STORAGE_KEY, jsonData);
        localStorage.setItem(INTEGRITY_KEY, computeHash(jsonData));

        if (savedToFirebase) {
            showToast('✅ Guardado en Firebase + backup local');
        } else {
            showToast('✅ Guardado localmente (Firebase no disponible)');
        }
    } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
            showToast('❌ Error: Imágenes demasiado grandes. Usa imágenes más pequeñas.', true);
        } else {
            showToast('❌ Error al guardar: ' + e.message, true);
        }
        console.error('Error saving:', e);
    }

    // Update dashboard
    updateDashboard();
}

// ============================================
// SIDEBAR NAVIGATION
// ============================================
function initSidebar() {
    const buttons = document.querySelectorAll('.sidebar-nav button');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const sectionId = btn.getAttribute('data-section');
            document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
            document.getElementById('section-' + sectionId).classList.add('active');

            // Close mobile sidebar
            document.querySelector('.sidebar').classList.remove('open');
        });
    });
}

// ============================================
// POPULATE FORMS FROM DATA
// ============================================
function populateAllForms() {
    // General
    setVal('gen-siteName', siteData.general.siteName);
    setVal('gen-badge', siteData.general.badge);
    setVal('gen-heroTitle', siteData.general.heroTitle);
    setVal('gen-heroDesc', siteData.general.heroDesc);

    // About
    setVal('about-avatarInitials', siteData.about.avatarInitials);
    setVal('about-bio1', siteData.about.bio1);
    setVal('about-bio2', siteData.about.bio2);
    setVal('about-stat1num', siteData.about.stats[0]?.number);
    setVal('about-stat1label', siteData.about.stats[0]?.label);
    setVal('about-stat2num', siteData.about.stats[1]?.number);
    setVal('about-stat2label', siteData.about.stats[1]?.label);
    setVal('about-stat3num', siteData.about.stats[2]?.number);
    setVal('about-stat3label', siteData.about.stats[2]?.label);

    // Avatar preview
    renderAvatarPreview();

    // Contact
    setVal('contact-email', siteData.contact.email);
    setVal('contact-location', siteData.contact.location);
    setVal('contact-availability', siteData.contact.availability);
    setVal('social-behance', siteData.contact.socials.behance);
    setVal('social-dribbble', siteData.contact.socials.dribbble);
    setVal('social-instagram', siteData.contact.socials.instagram);
    setVal('social-linkedin', siteData.contact.socials.linkedin);
    setVal('social-twitter', siteData.contact.socials.twitter);

    // Config
    setVal('config-whatsapp', siteData.config.whatsapp);
    setVal('config-formspree', siteData.config.formspree);

    // Dynamic sections
    renderHeroSlides();
    renderPortfolio();
    renderServices();
    renderTestimonials();
    renderProcess();
    renderFaq();

    // Dashboard
    updateDashboard();
}

// ============================================
// COLLECT FORMS INTO DATA
// ============================================
function collectAllForms() {
    // General
    siteData.general.siteName = getVal('gen-siteName');
    siteData.general.badge = getVal('gen-badge');
    siteData.general.heroTitle = getVal('gen-heroTitle');
    siteData.general.heroDesc = getVal('gen-heroDesc');

    // About
    siteData.about.avatarInitials = getVal('about-avatarInitials');
    siteData.about.bio1 = getVal('about-bio1');
    siteData.about.bio2 = getVal('about-bio2');
    siteData.about.stats = [
        { number: parseInt(getVal('about-stat1num')) || 0, label: getVal('about-stat1label') },
        { number: parseInt(getVal('about-stat2num')) || 0, label: getVal('about-stat2label') },
        { number: parseInt(getVal('about-stat3num')) || 0, label: getVal('about-stat3label') }
    ];

    // Contact
    siteData.contact.email = getVal('contact-email');
    siteData.contact.location = getVal('contact-location');
    siteData.contact.availability = getVal('contact-availability');
    siteData.contact.socials = {
        behance: getVal('social-behance'),
        dribbble: getVal('social-dribbble'),
        instagram: getVal('social-instagram'),
        linkedin: getVal('social-linkedin'),
        twitter: getVal('social-twitter')
    };

    // Config
    siteData.config.whatsapp = getVal('config-whatsapp');
    siteData.config.formspree = getVal('config-formspree');

    // Portfolio (collect from rendered inputs)
    collectPortfolio();

    // Services (collect from rendered inputs)
    collectServices();

    // Testimonials
    collectTestimonials();

    // Process
    collectProcess();

    // FAQ
    collectFaq();

    // Hero slides already updated in-place
}

// ============================================
// HERO SLIDES
// ============================================
function renderHeroSlides() {
    const container = document.getElementById('heroSlidesContainer');
    container.innerHTML = '';

    siteData.hero.slides.forEach((slide, i) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
      <div class="item-card-header">
        <h4><span class="num">${i + 1}</span> Slide ${i + 1}</h4>
        <div class="btn-group" style="margin:0">
          <button class="btn btn-danger btn-sm" data-action="remove-slide" data-index="${i}">🗑️ Eliminar</button>
        </div>
      </div>
      ${slide.type === 'image' && slide.image ?
                `<img src="${slide.image}" class="image-preview" alt="Slide ${i + 1}">` :
                `<div style="background:var(--bg);padding:1rem;border-radius:8px;text-align:center;margin-bottom:0.75rem;">
          <p style="color:var(--text-muted);font-size:0.85rem;">🎨 Usando animación CSS: <strong>${escapeHtml(slide.cssClass || 'slide-art-' + (i + 1))}</strong></p>
        </div>`
            }
      <div class="image-upload-zone" style="padding:1rem;">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-action="upload-slide" data-index="${i}">
        <p style="font-size:0.8rem;">📷 Subir imagen para este slide (recomendado: 1920×1080)</p>
      </div>
    `;
        container.appendChild(card);
    });
}

function addHeroSlide() {
    siteData.hero.slides.push({ type: 'image', image: '' });
    renderHeroSlides();
}

function removeHeroSlide(index) {
    if (siteData.hero.slides.length <= 1) {
        showToast('⚠️ Debes tener al menos 1 slide', true);
        return;
    }
    siteData.hero.slides.splice(index, 1);
    renderHeroSlides();
}

function handleSlideUpload(event, index) {
    const file = event.target.files[0];
    if (!file || !validateImageFile(file)) return;

    compressImage(file, 1200, 0.8, (compressedDataUrl) => {
        siteData.hero.slides[index] = { type: 'image', image: compressedDataUrl };
        renderHeroSlides();
    });
}

// ============================================
// PORTFOLIO
// ============================================
function renderPortfolio() {
    const container = document.getElementById('portfolioContainer');
    container.innerHTML = '';

    siteData.portfolio.forEach((project, i) => {
        // Migrate old single-image format
        if (project.image && !project.images) {
            project.images = project.image ? [project.image] : [];
            delete project.image;
        }
        if (!project.images) project.images = [];
        if (!project.description) project.description = '';
        if (!project.link) project.link = '';

        const card = document.createElement('div');
        card.className = 'item-card';

        // Build image gallery thumbnails
        let galleryHTML = '';
        if (project.images.length > 0) {
            galleryHTML = `<div class="portfolio-gallery-admin">
                ${project.images.map((img, imgIdx) => `
                    <div class="gallery-thumb">
                        <img src="${img}" alt="Imagen ${imgIdx + 1}">
                        <button class="gallery-thumb-remove" data-action="remove-portfolio-image" data-index="${i}" data-img-index="${imgIdx}" title="Eliminar imagen">✕</button>
                    </div>
                `).join('')}
            </div>`;
        }

        card.innerHTML = `
      <div class="item-card-header">
        <h4><span class="num">${i + 1}</span> Proyecto ${i + 1} ${project.images.length > 0 ? `<span class="badge" style="font-size:0.7rem">${project.images.length} 📷</span>` : ''}</h4>
        <button class="btn btn-danger btn-sm" data-action="remove-portfolio" data-index="${i}">🗑️</button>
      </div>
      ${galleryHTML}
      <div class="image-upload-zone" style="padding:1rem;margin-bottom:0.75rem;">
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-action="upload-portfolio" data-index="${i}" multiple>
        <p style="font-size:0.8rem;">📷 Agregar imágenes al proyecto (puedes seleccionar varias)</p>
      </div>
      <div class="form-row">
        <div>
          <label>Categoría</label>
          <input type="text" value="${escapeAttr(project.category)}" data-portfolio="${i}" data-field="category" maxlength="50">
        </div>
        <div>
          <label>Título del proyecto</label>
          <input type="text" value="${escapeAttr(project.title)}" data-portfolio="${i}" data-field="title" maxlength="100">
        </div>
      </div>
      <div style="margin-top:0.75rem;">
        <label>Descripción del proyecto</label>
        <textarea data-portfolio="${i}" data-field="description" maxlength="500" rows="2" style="width:100%;resize:vertical;">${escapeHtml(project.description)}</textarea>
      </div>
      <div style="margin-top:0.75rem;">
        <label>🔗 Enlace externo (Behance, Dribbble, etc.)</label>
        <input type="url" value="${escapeAttr(project.link)}" data-portfolio="${i}" data-field="link" maxlength="500" placeholder="https://behance.net/tu-proyecto">
      </div>
    `;
        container.appendChild(card);
    });
}

function addPortfolioItem() {
    siteData.portfolio.push({ images: [], category: 'Categoría', title: 'Nuevo Proyecto', description: '', link: '', cssArt: '' });
    renderPortfolio();
    document.getElementById('portfolioContainer').lastChild.scrollIntoView({ behavior: 'smooth' });
}

function removePortfolioItem(index) {
    siteData.portfolio.splice(index, 1);
    renderPortfolio();
}

function removePortfolioImage(projectIndex, imageIndex) {
    if (siteData.portfolio[projectIndex] && siteData.portfolio[projectIndex].images) {
        siteData.portfolio[projectIndex].images.splice(imageIndex, 1);
        renderPortfolio();
    }
}

function handlePortfolioUpload(event, index) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (!siteData.portfolio[index].images) siteData.portfolio[index].images = [];

    let processed = 0;
    const total = files.length;

    Array.from(files).forEach(file => {
        if (!validateImageFile(file)) { processed++; return; }
        compressImage(file, 800, 0.8, (compressedDataUrl) => {
            siteData.portfolio[index].images.push(compressedDataUrl);
            siteData.portfolio[index].cssArt = '';
            processed++;
            if (processed === total) renderPortfolio();
        });
    });
}

function collectPortfolio() {
    document.querySelectorAll('[data-portfolio]').forEach(input => {
        const idx = parseInt(input.getAttribute('data-portfolio'));
        const field = input.getAttribute('data-field');
        if (siteData.portfolio[idx] && field) {
            siteData.portfolio[idx][field] = input.value;
        }
    });
}

// ============================================
// SERVICES
// ============================================
function renderServices() {
    const container = document.getElementById('servicesContainer');
    container.innerHTML = '';

    siteData.services.forEach((service, i) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
      <div class="item-card-header">
        <h4><span class="num">${i + 1}</span> Servicio ${i + 1}</h4>
        <button class="btn btn-danger btn-sm" data-action="remove-service" data-index="${i}">🗑️</button>
      </div>
      <label>Nombre del servicio</label>
      <input type="text" value="${escapeAttr(service.name)}" data-service="${i}" data-field="name" maxlength="100">
      <label>Descripción</label>
      <textarea data-service="${i}" data-field="desc" rows="3" maxlength="500">${escapeHtml(service.desc)}</textarea>
    `;
        container.appendChild(card);
    });
}

function addServiceItem() {
    siteData.services.push({ name: 'Nuevo Servicio', desc: 'Descripción del servicio.' });
    renderServices();
    document.getElementById('servicesContainer').lastChild.scrollIntoView({ behavior: 'smooth' });
}

function removeServiceItem(index) {
    siteData.services.splice(index, 1);
    renderServices();
}

function collectServices() {
    document.querySelectorAll('[data-service]').forEach(input => {
        const idx = parseInt(input.getAttribute('data-service'));
        const field = input.getAttribute('data-field');
        if (siteData.services[idx]) {
            siteData.services[idx][field] = input.value;
        }
    });
}

// ============================================
// AVATAR
// ============================================
function initFileUploads() {
    const avatarInput = document.getElementById('avatarFileInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file || !validateImageFile(file)) return;
            compressImage(file, 600, 0.8, (compressedDataUrl) => {
                siteData.about.avatarImage = compressedDataUrl;
                renderAvatarPreview();
                showToast('📷 Imagen cargada. Recuerda guardar los cambios.');
            });
        });
    }

    // Import config
    const importInput = document.getElementById('importFileInput');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            // Validate it's a JSON file
            if (file.type && file.type !== 'application/json' && !file.name.endsWith('.json')) {
                showToast('❌ Solo se permiten archivos .json', true);
                return;
            }
            if (file.size > 1 * 1024 * 1024) { // 1MB max for config
                showToast('❌ Archivo demasiado grande.', true);
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const imported = JSON.parse(ev.target.result);
                    siteData = imported;
                    const jsonData = JSON.stringify(siteData);
                    localStorage.setItem(STORAGE_KEY, jsonData);
                    localStorage.setItem(INTEGRITY_KEY, computeHash(jsonData));
                    populateAllForms();
                    showToast('✅ Configuración importada correctamente');
                } catch (err) {
                    showToast('❌ Error: el archivo no es un JSON válido', true);
                }
            };
            reader.readAsText(file);
        });
    }
}

function renderAvatarPreview() {
    const container = document.getElementById('avatarPreviewContainer');
    if (!container) return;
    if (siteData.about.avatarImage) {
        container.innerHTML = `
      <img src="${siteData.about.avatarImage}" class="image-preview" alt="Avatar" style="width:120px;height:120px;border-radius:50%;object-fit:cover;">
      <button class="btn btn-danger btn-sm" data-action="remove-avatar" style="margin-top:0.5rem;">Eliminar foto</button>
    `;
    } else {
        container.innerHTML = '';
    }
}

function removeAvatar() {
    siteData.about.avatarImage = '';
    renderAvatarPreview();
}

// ============================================
// EXPORT / IMPORT / RESET
// ============================================
function exportConfig() {
    collectAllForms();
    const json = JSON.stringify(siteData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'artking47-config.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Archivo exportado correctamente');
}

function resetConfig() {
    if (!confirm('⚠️ ¿Estás seguro? Esto eliminará TODOS los cambios y restaurará los valores por defecto.')) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(INTEGRITY_KEY);
    siteData = JSON.parse(JSON.stringify(DEFAULTS));
    populateAllForms();
    showToast('🗑️ Todo restaurado a valores por defecto');
}

// ============================================
// UTILITIES
// ============================================
function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value ?? '';
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
}

function escapeAttr(str) {
    return (str || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showToast(message, isError) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = isError ? '#ef4444' : '#10b981';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// Compress image before storing as base64
function compressImage(file, maxSize, quality, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            if (w > maxSize || h > maxSize) {
                if (w > h) {
                    h = Math.round(h * maxSize / w);
                    w = maxSize;
                } else {
                    w = Math.round(w * maxSize / h);
                    h = maxSize;
                }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            callback(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// ============================================
// EVENT DELEGATION — Handle dynamic buttons
// ============================================
function initEventDelegation() {
    // Hero slides container — delete + upload
    const heroContainer = document.getElementById('heroSlidesContainer');
    if (heroContainer) {
        heroContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'));
            if (action === 'remove-slide') removeHeroSlide(index);
        });
        heroContainer.addEventListener('change', (e) => {
            const input = e.target.closest('[data-action="upload-slide"]');
            if (!input) return;
            const index = parseInt(input.getAttribute('data-index'));
            handleSlideUpload(e, index);
        });
    }

    // Portfolio container — delete + upload
    const portfolioContainer = document.getElementById('portfolioContainer');
    if (portfolioContainer) {
        portfolioContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'));
            if (action === 'remove-portfolio') removePortfolioItem(index);
            if (action === 'remove-portfolio-image') {
                const imgIndex = parseInt(btn.getAttribute('data-img-index'));
                removePortfolioImage(index, imgIndex);
            }
        });
        portfolioContainer.addEventListener('change', (e) => {
            const input = e.target.closest('[data-action="upload-portfolio"]');
            if (!input) return;
            const index = parseInt(input.getAttribute('data-index'));
            handlePortfolioUpload(e, index);
        });
    }

    // Services container — delete
    const servicesContainer = document.getElementById('servicesContainer');
    if (servicesContainer) {
        servicesContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'));
            if (action === 'remove-service') removeServiceItem(index);
        });
    }

    // Testimonials container — delete
    const testimonialsContainer = document.getElementById('testimonialsContainer');
    if (testimonialsContainer) {
        testimonialsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'));
            if (action === 'remove-testimonial') {
                collectTestimonials();
                siteData.testimonials.splice(index, 1);
                renderTestimonials();
            }
        });
    }

    // Process container — delete + reorder
    const processContainer = document.getElementById('processContainer');
    if (processContainer) {
        processContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'));
            collectProcess();
            if (action === 'remove-process') {
                siteData.process.splice(index, 1);
            } else if (action === 'move-process-up' && index > 0) {
                [siteData.process[index], siteData.process[index - 1]] = [siteData.process[index - 1], siteData.process[index]];
            } else if (action === 'move-process-down' && index < siteData.process.length - 1) {
                [siteData.process[index], siteData.process[index + 1]] = [siteData.process[index + 1], siteData.process[index]];
            }
            renderProcess();
        });
    }

    // FAQ container — delete
    const faqContainer = document.getElementById('faqContainer');
    if (faqContainer) {
        faqContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            const index = parseInt(btn.getAttribute('data-index'));
            if (action === 'remove-faq') {
                collectFaq();
                siteData.faq.splice(index, 1);
                renderFaq();
            }
        });
    }

    // Avatar container — remove
    const avatarContainer = document.getElementById('avatarPreviewContainer');
    if (avatarContainer) {
        avatarContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="remove-avatar"]');
            if (btn) removeAvatar();
        });
    }
}

// ============================================
// BUTTON EVENT LISTENERS (replacing inline onclick)
// ============================================
function initButtonListeners() {
    // Save / Discard
    const saveBtn = document.getElementById('saveBtn');
    const discardBtn = document.getElementById('discardBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveAll);
    if (discardBtn) discardBtn.addEventListener('click', loadAllFromStorage);

    // Add buttons
    const addHeroBtn = document.getElementById('addHeroSlideBtn');
    const addPortfolioBtn = document.getElementById('addPortfolioBtn');
    const addServiceBtn = document.getElementById('addServiceBtn');
    const addTestimonialBtn = document.getElementById('addTestimonialBtn');
    const addProcessBtn = document.getElementById('addProcessBtn');
    const addFaqBtn = document.getElementById('addFaqBtn');
    if (addHeroBtn) addHeroBtn.addEventListener('click', addHeroSlide);
    if (addPortfolioBtn) addPortfolioBtn.addEventListener('click', addPortfolioItem);
    if (addServiceBtn) addServiceBtn.addEventListener('click', addServiceItem);
    if (addTestimonialBtn) addTestimonialBtn.addEventListener('click', addTestimonialItem);
    if (addProcessBtn) addProcessBtn.addEventListener('click', addProcessItem);
    if (addFaqBtn) addFaqBtn.addEventListener('click', addFaqItem);

    // Export / Reset
    const exportBtn = document.getElementById('exportConfigBtn');
    const resetBtn = document.getElementById('resetConfigBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportConfig);
    if (resetBtn) resetBtn.addEventListener('click', resetConfig);

    // Password change
    const changePwdBtn = document.getElementById('changePasswordBtn');
    if (changePwdBtn) changePwdBtn.addEventListener('click', handlePasswordChange);

    // Dashboard quick actions
    document.querySelectorAll('[data-goto]').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-goto');
            const navBtn = document.querySelector(`.sidebar-nav button[data-section="${target}"]`);
            if (navBtn) navBtn.click();
        });
    });

    // Mobile toggle
    const mobileToggle = document.getElementById('mobileToggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            document.querySelector('.sidebar').classList.toggle('open');
        });
    }
}

// ============================================
// VENEZUELA TIMEZONE — VET (UTC-4)
// ============================================
function initVenezuelaClock() {
    const clockEl = document.getElementById('vetClock');
    if (!clockEl) return;

    function updateClock() {
        const now = new Date();
        // Venezuela is UTC-4
        const vetTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
        const hours = vetTime.getHours().toString().padStart(2, '0');
        const minutes = vetTime.getMinutes().toString().padStart(2, '0');
        const seconds = vetTime.getSeconds().toString().padStart(2, '0');
        clockEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    updateClock();
    setInterval(updateClock, 1000);
}

// ============================================
// INITIALIZATION
// ============================================
// ============================================
// TESTIMONIALS CRUD
// ============================================
function renderTestimonials() {
    const container = document.getElementById('testimonialsContainer');
    if (!container) return;
    container.innerHTML = '';

    siteData.testimonials.forEach((t, i) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
      <div class="item-card-header">
        <h4><span class="num">${i + 1}</span> ${escapeHtml(t.name)}</h4>
        <div class="btn-group" style="margin:0">
          <button class="btn btn-danger btn-sm" data-action="remove-testimonial" data-index="${i}">🗑️</button>
        </div>
      </div>
      <label>Nombre</label>
      <input type="text" class="test-name" value="${escapeHtml(t.name)}">
      <label>Iniciales (avatar)</label>
      <input type="text" class="test-initials" value="${escapeHtml(t.initials)}" maxlength="3">
      <label>Rol / Empresa</label>
      <input type="text" class="test-role" value="${escapeHtml(t.role)}">
      <label>Texto del testimonio</label>
      <textarea class="test-text" rows="3">${escapeHtml(t.text)}</textarea>
      <label>Estrellas (1-5)</label>
      <input type="number" class="test-stars" value="${t.stars}" min="1" max="5">
    `;
        container.appendChild(card);
    });
}

function collectTestimonials() {
    const cards = document.querySelectorAll('#testimonialsContainer .item-card');
    siteData.testimonials = [];
    cards.forEach(card => {
        siteData.testimonials.push({
            name: card.querySelector('.test-name')?.value || '',
            initials: card.querySelector('.test-initials')?.value || '',
            role: card.querySelector('.test-role')?.value || '',
            text: card.querySelector('.test-text')?.value || '',
            stars: parseInt(card.querySelector('.test-stars')?.value) || 5
        });
    });
}

function addTestimonialItem() {
    siteData.testimonials.push({ name: 'Nuevo Cliente', initials: 'NC', role: 'Empresa', text: 'Escribe aquí el testimonio...', stars: 5 });
    renderTestimonials();
}

// ============================================
// PROCESS CRUD
// ============================================
function renderProcess() {
    const container = document.getElementById('processContainer');
    if (!container) return;
    container.innerHTML = '';

    siteData.process.forEach((p, i) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
      <div class="item-card-header">
        <h4><span class="num">${i + 1}</span> Paso ${i + 1}: ${escapeHtml(p.title)}</h4>
        <div class="btn-group" style="margin:0">
          ${i > 0 ? `<button class="btn btn-secondary btn-sm" data-action="move-process-up" data-index="${i}">⬆️</button>` : ''}
          ${i < siteData.process.length - 1 ? `<button class="btn btn-secondary btn-sm" data-action="move-process-down" data-index="${i}">⬇️</button>` : ''}
          <button class="btn btn-danger btn-sm" data-action="remove-process" data-index="${i}">🗑️</button>
        </div>
      </div>
      <label>Título</label>
      <input type="text" class="proc-title" value="${escapeHtml(p.title)}">
      <label>Descripción</label>
      <textarea class="proc-desc" rows="2">${escapeHtml(p.desc)}</textarea>
      <label>Icono Lucide (nombre, ej: pen-tool, rocket, lightbulb)</label>
      <input type="text" class="proc-icon" value="${escapeHtml(p.icon)}" placeholder="message-circle">
    `;
        container.appendChild(card);
    });
}

function collectProcess() {
    const cards = document.querySelectorAll('#processContainer .item-card');
    siteData.process = [];
    cards.forEach(card => {
        siteData.process.push({
            title: card.querySelector('.proc-title')?.value || '',
            desc: card.querySelector('.proc-desc')?.value || '',
            icon: card.querySelector('.proc-icon')?.value || 'circle'
        });
    });
}

function addProcessItem() {
    siteData.process.push({ title: 'Nuevo Paso', desc: 'Describe este paso del proceso...', icon: 'circle' });
    renderProcess();
}

// ============================================
// FAQ CRUD
// ============================================
function renderFaq() {
    const container = document.getElementById('faqContainer');
    if (!container) return;
    container.innerHTML = '';

    siteData.faq.forEach((f, i) => {
        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
      <div class="item-card-header">
        <h4><span class="num">${i + 1}</span> Pregunta ${i + 1}</h4>
        <div class="btn-group" style="margin:0">
          <button class="btn btn-danger btn-sm" data-action="remove-faq" data-index="${i}">🗑️</button>
        </div>
      </div>
      <label>Pregunta</label>
      <input type="text" class="faq-q" value="${escapeHtml(f.question)}">
      <label>Respuesta</label>
      <textarea class="faq-a" rows="3">${escapeHtml(f.answer)}</textarea>
    `;
        container.appendChild(card);
    });
}

function collectFaq() {
    const cards = document.querySelectorAll('#faqContainer .item-card');
    siteData.faq = [];
    cards.forEach(card => {
        siteData.faq.push({
            question: card.querySelector('.faq-q')?.value || '',
            answer: card.querySelector('.faq-a')?.value || ''
        });
    });
}

function addFaqItem() {
    siteData.faq.push({ question: 'Nueva pregunta', answer: 'Escribe la respuesta aquí...' });
    renderFaq();
}

// ============================================
// DASHBOARD
// ============================================
function updateDashboard() {
    const el = (id) => document.getElementById(id);
    const pc = el('dashPortfolioCount');
    const sc = el('dashServicesCount');
    const tc = el('dashTestimonialsCount');
    const fc = el('dashFaqCount');
    const slc = el('dashSlidesCount');
    const lm = el('dashLastModified');

    if (pc) pc.textContent = siteData.portfolio?.length || 0;
    if (sc) sc.textContent = siteData.services?.length || 0;
    if (tc) tc.textContent = siteData.testimonials?.length || 0;
    if (fc) fc.textContent = siteData.faq?.length || 0;
    if (slc) slc.textContent = siteData.hero?.slides?.length || 0;

    // Last modified
    const storedRaw = localStorage.getItem(STORAGE_KEY);
    if (lm) {
        if (storedRaw) {
            const now = new Date();
            lm.textContent = `Última sesión activa: ${now.toLocaleDateString('es-VE')} ${now.toLocaleTimeString('es-VE', { timeZone: 'America/Caracas'})}  (VET)`;
        } else {
            lm.textContent = 'Sin datos guardados aún — usa "Guardar cambios" para persistir.';
        }
    }

    // Dashboard clock
    function updateDashClock() {
        const dc = document.getElementById('dashClock');
        if (!dc) return;
        const now = new Date();
        const vet = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
        dc.textContent = vet.getHours().toString().padStart(2, '0') + ':' + vet.getMinutes().toString().padStart(2, '0');
    }
    updateDashClock();
    setInterval(updateDashClock, 30000);
}

// ============================================
// PASSWORD CHANGE
// ============================================
async function handlePasswordChange() {
    const newPwd = document.getElementById('config-newPassword')?.value;
    const confirmPwd = document.getElementById('config-confirmPassword')?.value;

    if (!newPwd || newPwd.length < 6) {
        showToast('❌ La contraseña debe tener al menos 6 caracteres', true);
        return;
    }
    if (newPwd !== confirmPwd) {
        showToast('❌ Las contraseñas no coinciden', true);
        return;
    }

    const hash = await hashPassword(newPwd);
    localStorage.setItem('artking47_admin_hash', hash);
    showToast('✅ Contraseña cambiada correctamente');
    document.getElementById('config-newPassword').value = '';
    document.getElementById('config-confirmPassword').value = '';
}

document.addEventListener('DOMContentLoaded', async () => {
    // Render Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Initialize Firebase (must be first)
    if (typeof initFirebase === 'function') {
        initFirebase();
    }

    initLoginGate();
    await loadAllFromStorage();
    initSidebar();
    initFileUploads();
    initEventDelegation();
    initButtonListeners();
    initVenezuelaClock();

    // Re-render Lucide after dynamic content
    setTimeout(() => {
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 300);
});
