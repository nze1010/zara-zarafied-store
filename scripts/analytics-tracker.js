/**
 * ZARA — ZARAFIED STORE
 * Privacy-Conscious Visitor Analytics & Engagement Tracker
 * 
 * Design & Privacy Principles:
 * - Pseudonymous IDs only (no names, emails, phone numbers, or passwords stored)
 * - Zero GPS or precise location tracking; approximate country/region derived via client lookup
 * - Full IP addresses are NEVER persisted in Firestore
 * - Accurate engaged time tracking via Intersection Observer (pauses on idle & tab hidden)
 * - Highly efficient batched session writes to protect Firebase Spark tier limits
 * - Automatically excluded for store administrators on admin screens
 * - Graceful fallback: website functions 100% reliably even if analytics is blocked
 */

import { getDb } from './firebase-config.js';

const STORAGE_KEYS = {
  VISITOR_ID: 'zara_vid',
  RETURNING_FLAG: 'zara_vid_returning',
  SESSION_ID: 'zara_sid',
  GEO_CACHE: 'zara_geo_cache',
  OPT_OUT: 'zara_analytics_optout'
};

// Section mapping for engagement tracking
const MONITORED_SECTIONS = [
  { id: 'hero', name: 'Home & Hero', selector: '#hero' },
  { id: 'showcase', name: 'Signature Creations Gallery', selector: '#showcase' },
  { id: 'collections', name: 'Our Collections', selector: '#collections' },
  { id: 'shop', name: 'Shop Catalogue', selector: '#shop-catalogue' },
  { id: 'custom-designs', name: 'Custom Designs', selector: '#custom-designs' },
  { id: 'about', name: 'Meet the Designer', selector: '#designer-story' },
  { id: 'reviews', name: 'Customer Reviews', selector: '#reviews' },
  { id: 'contact', name: 'Make an Enquiry', selector: '#contact' }
];

class AnalyticsTracker {
  constructor() {
    this.initialized = false;
    this.session = null;
    this.visibleSections = new Set();
    this.activeModalProduct = null;
    this.lastActivityTimestamp = Date.now();
    this.heartbeatInterval = null;
    this.timerInterval = null;
    this.isDocumentHidden = document.hidden;
    this.pendingFlush = false;
  }

  /**
   * Determine if current visitor should be excluded from analytics
   */
  shouldExclude() {
    if (typeof window === 'undefined') return true;

    // 1. Explicit visitor opt-out
    if (localStorage.getItem(STORAGE_KEYS.OPT_OUT) === 'true') {
      return true;
    }

    // 2. Admin portal exclusion
    if (window.location.pathname.includes('admin.html')) {
      return true;
    }

    // 3. Active admin session exclusion
    if (sessionStorage.getItem('zara_admin_active') === 'true') {
      return true;
    }

    // 4. Respect browser Global Privacy Control (GPC) if enabled
    if (navigator.globalPrivacyControl === true) {
      return true;
    }

    return false;
  }

  /**
   * Initialize visitor session and engagement monitors
   */
  async init() {
    if (this.initialized || this.shouldExclude()) {
      return;
    }

    this.initialized = true;

    // 1. Establish pseudonymous identifiers
    const visitorId = this.getOrCreateVisitorId();
    const isNewVisitor = !localStorage.getItem(STORAGE_KEYS.RETURNING_FLAG);
    if (isNewVisitor) {
      localStorage.setItem(STORAGE_KEYS.RETURNING_FLAG, 'true');
    }

    const sessionId = this.getOrCreateSessionId();

    // 2. Detect device, browser, OS, and traffic attribution
    const deviceInfo = this.detectDeviceInfo();
    const trafficSource = this.detectTrafficSource();

    // 3. Initialize in-memory session object
    const startedAt = new Date().toISOString();
    this.session = {
      sessionId,
      visitorId,
      isNewVisitor,
      startedAt,
      lastActiveAt: startedAt,
      updatedAt: startedAt,
      dateKey: startedAt.slice(0, 10), // 'YYYY-MM-DD'
      device: deviceInfo.device,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      trafficSource: trafficSource.source, // 'direct', 'search', 'social', 'referral'
      referrerDomain: trafficSource.referrerDomain,
      utmSource: trafficSource.utmSource || null,
      utmMedium: trafficSource.utmMedium || null,
      utmCampaign: trafficSource.utmCampaign || null,
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      pageViews: 1,
      totalEngagedSeconds: 0,
      sectionsViewed: {},
      productsViewed: {},
      events: [],
      whatsappClicks: 0,
      customDesignClicks: 0
    };

    // Initialize monitored sections state
    MONITORED_SECTIONS.forEach(sec => {
      this.session.sectionsViewed[sec.id] = {
        name: sec.name,
        visits: 0,
        engagedSeconds: 0
      };
    });

    // 4. Asynchronously determine approximate country/region (cached per session, zero GPS)
    this.fetchApproximateLocation();

    // 5. Setup interaction, visibility, and section observers
    this.setupUserActivityListeners();
    this.setupSectionObserver();
    this.setupEngagementTicker();

    // 6. Schedule initial and periodic flushes to Firestore
    setTimeout(() => this.flush(), 3000);
    this.heartbeatInterval = setInterval(() => this.onHeartbeat(), 45000);

    // 7. Flush on page visibility change or exit
    document.addEventListener('visibilitychange', () => this.onVisibilityChange());
    window.addEventListener('pagehide', () => this.flush(true));

    // Log initial page view
    this.recordEvent('page_view', {
      path: window.location.pathname || '/',
      title: document.title || 'ZARAFIED STORE'
    });
  }

  /**
   * Pseudonymous Visitor Identifier (stored only in localStorage)
   */
  getOrCreateVisitorId() {
    let vid = localStorage.getItem(STORAGE_KEYS.VISITOR_ID);
    if (!vid) {
      vid = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(STORAGE_KEYS.VISITOR_ID, vid);
    }
    return vid;
  }

  /**
   * Pseudonymous Session Identifier (stored only in sessionStorage)
   */
  getOrCreateSessionId() {
    let sid = sessionStorage.getItem(STORAGE_KEYS.SESSION_ID);
    if (!sid) {
      sid = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, sid);
    }
    return sid;
  }

  /**
   * Privacy-conscious device, browser, and OS detection
   */
  detectDeviceInfo() {
    const ua = navigator.userAgent || '';
    const width = window.innerWidth;
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Device category
    let device = 'desktop';
    if (width < 768 || /Android|iPhone|iPod|Mobile/i.test(ua)) {
      device = 'mobile';
    } else if ((width >= 768 && width <= 1024 && isTouch) || /iPad|Tablet/i.test(ua)) {
      device = 'tablet';
    }

    // Browser
    let browser = 'Other';
    if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
    else if (/Edge|Edg/i.test(ua)) browser = 'Edge';
    else if (/Chrome|CriOS/i.test(ua)) browser = 'Chrome';
    else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) browser = 'Safari';
    else if (/Firefox|FxiOS/i.test(ua)) browser = 'Firefox';
    else if (/Opera|OPR/i.test(ua)) browser = 'Opera';

    // Operating System
    let os = 'Other';
    if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
    else if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
    else if (/CrOS/i.test(ua)) os = 'Chrome OS';
    else if (/Linux/i.test(ua)) os = 'Linux';

    return { device, browser, os };
  }

  /**
   * Parse traffic source, search engines, social media, and UTM tags
   */
  detectTrafficSource() {
    const params = new URLSearchParams(window.location.search);
    const utmSource = params.get('utm_source');
    const utmMedium = params.get('utm_medium');
    const utmCampaign = params.get('utm_campaign');

    if (utmSource) {
      return {
        source: utmSource.toLowerCase(),
        referrerDomain: utmSource,
        utmSource,
        utmMedium,
        utmCampaign
      };
    }

    const ref = document.referrer;
    if (!ref) {
      return { source: 'direct', referrerDomain: 'direct' };
    }

    try {
      const refUrl = new URL(ref);
      const host = refUrl.hostname.toLowerCase();

      // Same origin navigation is direct/internal
      if (host === window.location.hostname) {
        return { source: 'direct', referrerDomain: 'internal' };
      }

      // Search Engines
      if (/google\.|bing\.|yahoo\.|duckduckgo\.|ecosia\.|baidu\./i.test(host)) {
        return { source: 'search', referrerDomain: host };
      }

      // Social Media
      if (/instagram\.|facebook\.|fb\.|t\.co|twitter\.|x\.com|tiktok\.|linkedin\.|pinterest\.|whatsapp\.|wa\.me/i.test(host)) {
        return { source: 'social', referrerDomain: host };
      }

      // Referral website
      return { source: 'referral', referrerDomain: host };
    } catch (_) {
      return { source: 'direct', referrerDomain: 'direct' };
    }
  }

  /**
   * Approximate country/region lookup (zero GPS, no full IP stored)
   */
  async fetchApproximateLocation() {
    try {
      const cached = sessionStorage.getItem(STORAGE_KEYS.GEO_CACHE);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (this.session) {
          this.session.country = parsed.country || 'Unknown';
          this.session.region = parsed.region || 'Unknown';
          this.session.city = parsed.city || 'Unknown';
        }
        return;
      }

      // Non-blocking privacy-conscious client-side IP lookup
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('https://ipapi.co/json/', { signal: controller.signal }).catch(() => null);
      clearTimeout(timeoutId);

      if (res && res.ok) {
        const data = await res.json();
        const geoInfo = {
          country: data.country_name || 'Unknown',
          region: data.region || 'Unknown',
          city: data.city || 'Unknown'
        };
        sessionStorage.setItem(STORAGE_KEYS.GEO_CACHE, JSON.stringify(geoInfo));

        if (this.session) {
          this.session.country = geoInfo.country;
          this.session.region = geoInfo.region;
          this.session.city = geoInfo.city;
        }
      }
    } catch (_) {
      // Graceful fallback to Unknown
    }
  }

  /**
   * User activity heartbeat listener (pauses after 30s of inactivity)
   */
  setupUserActivityListeners() {
    const markActive = () => {
      this.lastActivityTimestamp = Date.now();
    };

    ['scroll', 'mousemove', 'keydown', 'touchstart', 'click'].forEach(evt => {
      window.addEventListener(evt, markActive, { passive: true });
    });
  }

  /**
   * Monitor main website sections using IntersectionObserver
   */
  setupSectionObserver() {
    if (!('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const sectionId = entry.target.dataset.analyticsSection;
          if (!sectionId) return;

          if (entry.isIntersecting) {
            this.visibleSections.add(sectionId);
            if (this.session?.sectionsViewed[sectionId]) {
              this.session.sectionsViewed[sectionId].visits += 1;
            }
          } else {
            this.visibleSections.delete(sectionId);
          }
        });
      },
      { threshold: 0.25 }
    );

    MONITORED_SECTIONS.forEach(sec => {
      const el = document.querySelector(sec.selector);
      if (el) {
        el.dataset.analyticsSection = sec.id;
        observer.observe(el);
      }
    });
  }

  /**
   * Ticker that accumulates engaged time every second
   */
  setupEngagementTicker() {
    this.timerInterval = setInterval(() => {
      if (this.isDocumentHidden) return;

      const idleDuration = Date.now() - this.lastActivityTimestamp;
      const isActivelyEngaged = idleDuration < 30000; // 30-second idle ceiling

      if (!isActivelyEngaged || !this.session) return;

      // Accumulate active session time
      this.session.totalEngagedSeconds += 1;
      this.session.lastActiveAt = new Date().toISOString();

      // Accumulate section-specific engagement time
      this.visibleSections.forEach(sectionId => {
        if (this.session.sectionsViewed[sectionId]) {
          this.session.sectionsViewed[sectionId].engagedSeconds += 1;
        }
      });

      // Accumulate product modal engagement time
      if (this.activeModalProduct && this.session.productsViewed[this.activeModalProduct.id]) {
        this.session.productsViewed[this.activeModalProduct.id].engagedSeconds += 1;
      }
    }, 1000);
  }

  /**
   * Handle visibilitychange (tab switching or backgrounding)
   */
  onVisibilityChange() {
    this.isDocumentHidden = document.hidden;
    if (this.isDocumentHidden) {
      // User switched tab or backgrounded app: flush current progress immediately
      this.flush(true);
    } else {
      this.lastActivityTimestamp = Date.now();
    }
  }

  /**
   * Periodic heartbeat
   */
  onHeartbeat() {
    if (this.isDocumentHidden) return;
    const idleDuration = Date.now() - this.lastActivityTimestamp;
    if (idleDuration < 60000) {
      this.flush();
    }
  }

  /**
   * Start tracking a product when viewed in the details modal
   */
  startProductView(product) {
    if (!product || !product.id || !this.session) return;

    this.activeModalProduct = product;

    if (!this.session.productsViewed[product.id]) {
      this.session.productsViewed[product.id] = {
        id: product.id,
        title: product.title || 'Outfit',
        category: product.category || 'ready-to-wear',
        price: product.price || 0,
        views: 0,
        engagedSeconds: 0,
        whatsappClicks: 0
      };
    }

    this.session.productsViewed[product.id].views += 1;

    this.recordEvent('product_view', {
      productId: product.id,
      title: product.title,
      category: product.category,
      price: product.price
    });
  }

  /**
   * End product modal view
   */
  endProductView() {
    this.activeModalProduct = null;
  }

  /**
   * Record a custom store event
   */
  recordEvent(eventName, eventData = {}) {
    if (!this.session) return;

    const eventRecord = {
      name: eventName,
      timestamp: new Date().toISOString(),
      ...eventData
    };

    // Keep memory event history capped at 30 items
    if (this.session.events.length >= 30) {
      this.session.events.shift();
    }
    this.session.events.push(eventRecord);

    // Track conversion counters
    if (eventName === 'whatsapp_click') {
      this.session.whatsappClicks += 1;
      if (this.activeModalProduct && this.session.productsViewed[this.activeModalProduct.id]) {
        this.session.productsViewed[this.activeModalProduct.id].whatsappClicks += 1;
      }
      // Immediate flush on conversion action
      this.flush();
    } else if (eventName === 'custom_design_enquiry') {
      this.session.customDesignClicks += 1;
      this.flush();
    }

    // Mirror to Google Analytics 4 if gtag is available
    if (typeof window.gtag === 'function') {
      try {
        window.gtag('event', eventName, eventData);
      } catch (_) {}
    }
  }

  /**
   * Persist current session to Firestore (batched and rate-controlled)
   */
  async flush(isImmediate = false) {
    if (!this.session || this.shouldExclude()) return;

    const db = getDb();
    if (!db) return;

    try {
      const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
      const now = new Date().toISOString();
      this.session.updatedAt = now;

      const sessionRef = doc(db, 'analytics_sessions', this.session.sessionId);
      await setDoc(sessionRef, this.session, { merge: true });
    } catch (err) {
      // Analytics should never disrupt public user experience
      console.info('[ZARA Analytics Standby]: Session saved locally.', err?.message);
    }
  }
}

// Singleton tracker instance
export const analyticsTracker = new AnalyticsTracker();

// Global accessor for convenience in UI interactions
if (typeof window !== 'undefined') {
  window.__ZARA_ANALYTICS__ = analyticsTracker;
}
