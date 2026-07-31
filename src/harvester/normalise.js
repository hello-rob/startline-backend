// src/harvester/normalise.js
const { normaliseActivity } = require('./feeds');

function normaliseItem(item, feedMeta, seriesCache) {
  const d = item.data;
  if (!d) return null;

  const loc  = d.location || d.place || {};
  const addr = loc.address || {};
  const geo  = loc.geo || {};

  // Resolve parent series
  const seriesId   = (d.superEvent && d.superEvent['@id'])
    ? d.superEvent['@id']
    : (typeof d.superEvent === 'string' ? d.superEvent : null);
  const seriesData = (seriesId && seriesCache) ? seriesCache.get(seriesId) : null;

  // Activity: try session first, then series, then feed default
  const sessionActivityRaw = extractActivity(d);
  const seriesActivityRaw  = seriesData ? extractActivity(seriesData.raw || {}) : '';
  const activityRaw        = sessionActivityRaw || seriesActivityRaw || '';

  const activity = feedMeta.activity !== 'general'
    ? feedMeta.activity
    : normaliseActivity(activityRaw);

  // Name
  const name = resolveName(d, seriesData, activityRaw, loc, feedMeta);

  // Description
  const description = d.description || (seriesData ? seriesData.description : null) || null;

  // Location: prefer session, fall back to series
  const seriesLoc  = seriesData ? (seriesData.loc || {}) : {};
  const resolvedLoc  = (loc.name || addr.streetAddress) ? loc : seriesLoc;
  const resolvedAddr = resolvedLoc.address || {};
  const resolvedGeo  = resolvedLoc.geo || {};

  const startDate = d.startDate || d.startTime || null;

  return {
    id:              d['@id'] || item.id,
    source_feed:     feedMeta.name,
    modified:        item.modified || 0,
    name:            name,
    description:     description,
    activity:        activity,
    activity_raw:    activityRaw,
    start_date:      startDate,
    end_date:        d.endDate || d.endTime || null,
    duration:        d.duration || (seriesData ? seriesData.duration : null) || null,
    location_name:   resolvedLoc.name || resolvedAddr.streetAddress || null,
    street_address:  resolvedAddr.streetAddress || null,
    city:            resolvedAddr.addressLocality || resolvedAddr.addressRegion || null,
    postcode:        resolvedAddr.postalCode || null,
    lat:             parseFloat(resolvedGeo.latitude)  || null,
    lng:             parseFloat(resolvedGeo.longitude) || null,
    price:           extractPrice(d) !== null ? extractPrice(d) : extractPrice((seriesData && seriesData.raw) ? seriesData.raw : {}),
    price_currency:  'GBP',
    url:             d.url || (seriesData ? seriesData.url : null) || d['@id'] || null,
    organiser_name:  extractOrganiser(d) || (seriesData ? extractOrganiser(seriesData.raw || {}) : null),
    organiser_url:   extractOrganiserUrl(d) || (seriesData ? extractOrganiserUrl(seriesData.raw || {}) : null),
    max_attendees:   d.maximumAttendeeCapacity || null,
    remaining_spots: d.remainingAttendeeCapacity || null,
    status:          'active'
  };
}

function normaliseSeriesItem(item, feedMeta) {
  const d = item.data;
  if (!d || !d['@id']) return null;
  const loc = d.location || d.place || {};
  return {
    id:          d['@id'],
    name:        d.name || null,
    description: d.description || null,
    activityRaw: extractActivity(d),
    loc:         loc,
    duration:    d.duration || null,
    url:         d.url || null,
    raw:         d
  };
}

function resolveName(d, seriesData, activityRaw, loc, feedMeta) {
  if (d.name && isUsefulName(d.name)) return d.name.trim();
  if (seriesData && seriesData.name && isUsefulName(seriesData.name)) return seriesData.name.trim();
  if (d.superEvent && d.superEvent.name && isUsefulName(d.superEvent.name)) return d.superEvent.name.trim();

  const actLabel = activityRaw
    ? activityRaw.charAt(0).toUpperCase() + activityRaw.slice(1)
    : null;

  const seriesLoc = seriesData ? (seriesData.loc || {}) : {};
  const place = (loc.name && isUsefulName(loc.name)) ? loc.name
    : (seriesLoc.name && isUsefulName(seriesLoc.name)) ? seriesLoc.name
    : (loc.address && loc.address.addressLocality) ? loc.address.addressLocality
    : (seriesLoc.address && seriesLoc.address.addressLocality) ? seriesLoc.address.addressLocality
    : null;

  const parts = [];
  if (actLabel) parts.push(actLabel);
  if (place) parts.push('at ' + place);
  if (parts.length > 1) return parts.join(' ');

  const provider = feedMeta.name.replace(/ — (Sessions|Courses)$/, '');
  if (actLabel) return actLabel + ' · ' + provider;
  return 'Activity · ' + provider;
}

function isUsefulName(name) {
  if (!name || !name.trim()) return false;
  if (name.startsWith('http')) return false;
  const lower = name.toLowerCase().trim();
  const useless = ['scheduledsession', 'sessionseries', 'courseinstance', 'event', 'session'];
  return useless.indexOf(lower) === -1;
}

function extractActivity(d) {
  if (!d) return '';
  if (Array.isArray(d.activity) && d.activity.length > 0) {
    return d.activity[0].prefLabel || d.activity[0].id || '';
  }
  if (typeof d.activity === 'string') return d.activity;
  return '';
}

function extractPrice(d) {
  if (!d) return null;
  const offers = Array.isArray(d.offers) ? d.offers : (d.offers ? [d.offers] : []);
  if (!offers.length) return null;
  const prices = offers.map(function(o) { return parseFloat(o.price); }).filter(function(p) { return !isNaN(p); });
  return prices.length ? Math.min.apply(null, prices) : null;
}

function extractOrganiser(d) {
  if (!d) return null;
  const org = d.organizer || d.provider || d.organiser || null;
  return (org && org.name) ? org.name : null;
}

function extractOrganiserUrl(d) {
  if (!d) return null;
  const org = d.organizer || d.provider || d.organiser || null;
  return (org && org.url) ? org.url : null;
}

module.exports = { normaliseItem: normaliseItem, normaliseSeriesItem: normaliseSeriesItem };
