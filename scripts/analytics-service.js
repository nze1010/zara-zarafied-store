/**
 * ZARA — ZARAFIED STORE
 * Admin Analytics Service
 * 
 * Capabilities:
 * - Aggregates Firestore `analytics_sessions` collection into rich metrics
 * - Supports Today, 7 Days, 30 Days, and Custom Date Range filters
 * - Computes period-over-period comparisons with the prior equivalent timeframe
 * - Calculates visitor engagement, device breakdown, traffic attribution, and conversion funnels
 * - Privacy-conscious: processes only pseudonymous records with zero PII
 * - Resilient to missing composite indexes: performs smart in-memory aggregation if needed
 */

import { getDb } from './firebase-config.js';

/**
 * Format duration in seconds into human-readable string (e.g. "2m 14s" or "48s")
 */
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0s';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

/**
 * Calculate percentage difference between current and previous period
 */
export function calculateDelta(current, previous) {
  if (!previous || previous === 0) {
    if (!current || current === 0) return { percent: 0, text: '0%', direction: 'neutral', hasData: false };
    return { percent: 100, text: '+100%', direction: 'positive', hasData: true };
  }
  const diff = ((current - previous) / previous) * 100;
  const isPositive = diff > 0;
  const isNeutral = Math.abs(diff) < 0.1;
  const sign = isPositive ? '+' : '';
  const direction = isNeutral ? 'neutral' : (isPositive ? 'positive' : 'negative');
  return {
    percent: Math.round(diff * 10) / 10,
    text: `${sign}${diff.toFixed(1)}%`,
    direction,
    hasData: true
  };
}

/**
 * Calculate date range boundaries for preset or custom range
 */
export function resolveDateRange(preset, customStart = null, customEnd = null) {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date(now);

  if (preset === 'today') {
    startDate.setHours(0, 0, 0, 0);
  } else if (preset === '7days') {
    startDate.setDate(now.getDate() - 7);
  } else if (preset === '30days') {
    startDate.setDate(now.getDate() - 30);
  } else if (preset === 'custom' && customStart && customEnd) {
    startDate = new Date(customStart);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(customEnd);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Default to last 7 days
    startDate.setDate(now.getDate() - 7);
  }

  // Equivalent previous timeframe
  const durationMs = endDate.getTime() - startDate.getTime();
  const prevEndDate = new Date(startDate.getTime());
  const prevStartDate = new Date(startDate.getTime() - durationMs);

  return { startDate, endDate, prevStartDate, prevEndDate };
}

/**
 * Fetch and process analytics data for the admin dashboard
 */
export async function getAnalyticsReport(preset = '7days', customStart = null, customEnd = null) {
  const db = getDb();
  if (!db) {
    throw new Error('Firebase database is not connected. Please check authentication.');
  }

  const { startDate, endDate, prevStartDate, prevEndDate } = resolveDateRange(preset, customStart, customEnd);

  const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');

  // Fetch session documents
  const sessionsCol = collection(db, 'analytics_sessions');
  const snapshot = await getDocs(sessionsCol);

  const allSessions = [];
  snapshot.forEach(docSnap => {
    allSessions.push({ id: docSnap.id, ...docSnap.data() });
  });

  const startMs = startDate.getTime();
  const endMs = endDate.getTime();
  const prevStartMs = prevStartDate.getTime();
  const prevEndMs = prevEndDate.getTime();

  // Filter into current and previous cohorts
  const currentSessions = [];
  const prevSessions = [];

  allSessions.forEach(sess => {
    const time = new Date(sess.startedAt || sess.updatedAt || 0).getTime();
    if (time >= startMs && time <= endMs) {
      currentSessions.push(sess);
    } else if (time >= prevStartMs && time < startMs) {
      prevSessions.push(sess);
    }
  });

  // Calculate live active visitors (updated within last 15 minutes)
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  const activeVisitorsEstimate = allSessions.filter(s => {
    const lastActive = new Date(s.lastActiveAt || s.updatedAt || 0).getTime();
    return lastActive >= fifteenMinutesAgo;
  }).length;

  // Process metrics for current and previous periods
  const currentMetrics = aggregateSessions(currentSessions);
  const prevMetrics = aggregateSessions(prevSessions);

  // Compute period comparisons
  const comparisons = {
    visits: calculateDelta(currentMetrics.totalVisits, prevMetrics.totalVisits),
    unique: calculateDelta(currentMetrics.uniqueVisitors, prevMetrics.uniqueVisitors),
    enquiries: calculateDelta(currentMetrics.whatsappClicks + currentMetrics.customDesignClicks, prevMetrics.whatsappClicks + prevMetrics.customDesignClicks),
    engagedTime: calculateDelta(currentMetrics.avgEngagedSeconds, prevMetrics.avgEngagedSeconds)
  };

  // Generate day-by-day trend data
  const trendData = generateTrendData(startDate, endDate, currentSessions);

  return {
    preset,
    startDate,
    endDate,
    activeVisitorsEstimate,
    current: currentMetrics,
    previous: prevMetrics,
    comparisons,
    trendData
  };
}

/**
 * Aggregate a list of session records into analytical summaries
 */
function aggregateSessions(sessions) {
  const totalVisits = sessions.length;
  if (totalVisits === 0) {
    return {
      totalVisits: 0,
      pageViews: 0,
      uniqueVisitors: 0,
      newVisitors: 0,
      returningVisitors: 0,
      totalEngagedSeconds: 0,
      avgEngagedSeconds: 0,
      whatsappClicks: 0,
      customDesignClicks: 0,
      conversionRate: 0,
      devices: { mobile: 0, desktop: 0, tablet: 0 },
      browsers: {},
      os: {},
      trafficSources: { direct: 0, search: 0, social: 0, referral: 0 },
      referrers: {},
      countries: {},
      sections: {},
      products: {},
      funnel: {
        visits: 0,
        sectionsExplored: 0,
        productsViewed: 0,
        enquiries: 0
      }
    };
  }

  let pageViews = 0;
  let totalEngagedSeconds = 0;
  let whatsappClicks = 0;
  let customDesignClicks = 0;
  let newVisitors = 0;
  let returningVisitors = 0;

  const uniqueVisitorSet = new Set();
  const devices = { mobile: 0, desktop: 0, tablet: 0 };
  const browsers = {};
  const os = {};
  const trafficSources = { direct: 0, search: 0, social: 0, referral: 0 };
  const referrers = {};
  const countries = {};
  const sectionsAgg = {};
  const productsAgg = {};

  let sessionsWithSection = 0;
  let sessionsWithProduct = 0;
  let sessionsWithEnquiry = 0;

  sessions.forEach(sess => {
    pageViews += sess.pageViews || 1;
    totalEngagedSeconds += sess.totalEngagedSeconds || 0;
    whatsappClicks += sess.whatsappClicks || 0;
    customDesignClicks += sess.customDesignClicks || 0;

    if (sess.visitorId) {
      uniqueVisitorSet.add(sess.visitorId);
    }

    if (sess.isNewVisitor) newVisitors++;
    else returningVisitors++;

    // Devices
    const dev = sess.device || 'mobile';
    if (devices[dev] !== undefined) devices[dev]++;
    else devices.mobile++;

    // Browsers
    const br = sess.browser || 'Other';
    browsers[br] = (browsers[br] || 0) + 1;

    // OS
    const operatingSys = sess.os || 'Other';
    os[operatingSys] = (os[operatingSys] || 0) + 1;

    // Traffic sources
    const src = sess.trafficSource || 'direct';
    if (trafficSources[src] !== undefined) trafficSources[src]++;
    else trafficSources.direct++;

    // Referrers
    if (sess.referrerDomain && sess.referrerDomain !== 'direct' && sess.referrerDomain !== 'internal') {
      referrers[sess.referrerDomain] = (referrers[sess.referrerDomain] || 0) + 1;
    }

    // Country
    const ctry = sess.country || 'Unknown';
    countries[ctry] = (countries[ctry] || 0) + 1;

    // Sections aggregation
    let hasSections = false;
    if (sess.sectionsViewed) {
      Object.entries(sess.sectionsViewed).forEach(([secId, secData]) => {
        if (secData.visits > 0 || secData.engagedSeconds > 0) {
          hasSections = true;
          if (!sectionsAgg[secId]) {
            sectionsAgg[secId] = {
              id: secId,
              name: secData.name || secId,
              views: 0,
              engagedSeconds: 0
            };
          }
          sectionsAgg[secId].views += secData.visits || 1;
          sectionsAgg[secId].engagedSeconds += secData.engagedSeconds || 0;
        }
      });
    }
    if (hasSections) sessionsWithSection++;

    // Products aggregation
    let hasProduct = false;
    if (sess.productsViewed) {
      Object.entries(sess.productsViewed).forEach(([prodId, prodData]) => {
        hasProduct = true;
        if (!productsAgg[prodId]) {
          productsAgg[prodId] = {
            id: prodId,
            title: prodData.title || 'Outfit',
            category: prodData.category || 'ready-to-wear',
            price: prodData.price || 0,
            views: 0,
            engagedSeconds: 0,
            whatsappClicks: 0
          };
        }
        productsAgg[prodId].views += prodData.views || 1;
        productsAgg[prodId].engagedSeconds += prodData.engagedSeconds || 0;
        productsAgg[prodId].whatsappClicks += prodData.whatsappClicks || 0;
      });
    }
    if (hasProduct) sessionsWithProduct++;

    if ((sess.whatsappClicks || 0) > 0 || (sess.customDesignClicks || 0) > 0) {
      sessionsWithEnquiry++;
    }
  });

  const uniqueVisitors = uniqueVisitorSet.size || totalVisits;
  const avgEngagedSeconds = totalVisits > 0 ? Math.round(totalEngagedSeconds / totalVisits) : 0;
  const totalEnquiries = whatsappClicks + customDesignClicks;
  const conversionRate = totalVisits > 0 ? Math.round((totalEnquiries / totalVisits) * 1000) / 10 : 0;

  return {
    totalVisits,
    pageViews,
    uniqueVisitors,
    newVisitors,
    returningVisitors,
    totalEngagedSeconds,
    avgEngagedSeconds,
    whatsappClicks,
    customDesignClicks,
    conversionRate,
    devices,
    browsers,
    os,
    trafficSources,
    referrers,
    countries,
    sections: sectionsAgg,
    products: productsAgg,
    funnel: {
      visits: totalVisits,
      sectionsExplored: sessionsWithSection,
      productsViewed: sessionsWithProduct,
      enquiries: sessionsWithEnquiry
    }
  };
}

/**
 * Generate daily trend buckets for the visitor chart
 */
function generateTrendData(startDate, endDate, sessions) {
  const buckets = {};
  const current = new Date(startDate);

  while (current <= endDate) {
    const key = current.toISOString().slice(0, 10);
    const label = current.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    buckets[key] = {
      key,
      label,
      visits: 0,
      uniqueVisitors: new Set(),
      whatsappClicks: 0
    };
    current.setDate(current.getDate() + 1);
  }

  sessions.forEach(sess => {
    const dateKey = (sess.startedAt || sess.updatedAt || '').slice(0, 10);
    if (buckets[dateKey]) {
      buckets[dateKey].visits += 1;
      if (sess.visitorId) buckets[dateKey].uniqueVisitors.add(sess.visitorId);
      buckets[dateKey].whatsappClicks += sess.whatsappClicks || 0;
    }
  });

  return Object.values(buckets).map(b => ({
    key: b.key,
    label: b.label,
    visits: b.visits,
    unique: b.uniqueVisitors.size,
    whatsappClicks: b.whatsappClicks
  }));
}
