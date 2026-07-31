// src/harvester/normalise.js
const { normaliseActivity } = require('./feeds');

function normaliseItem(item, feedMeta, seriesCache) {
  const d = item.data;
  if (!d) return null;

  const activityRaw = extractActivity(d);

  const loc  = d.location || d.place || {};
  const addr = loc.address || {};
  const geo  = loc.geo || {};

  const seriesId   = (d.superEvent && d.superEvent['@id']) ? d.superEvent['@id'] : (typeof d.superEvent === 'string' ? d.superEvent : null);
  const seriesData = seriesId && seriesCache ? seriesCache.get(seriesId) : null;

  const name        = resolveName(d, seriesData, activityRaw, loc, feedMeta);
  const description = d.description || (seriesData ? seriesData.description : null) || null;

  var resolvedActivityRaw = activityRaw || (seriesData ? seriesData.activityRaw : '') || '';
  const activity = feedMeta.activity === 'general'
    ? normaliseActivity(resolvedActivityRaw)
    : feedMeta.activity;

  const resolvedLoc  = (loc.name || addr.streetAddress) ? loc : ((seriesData && seriesData.loc) ? seriesData.loc : loc);
  const resolvedAddr = resolvedLoc.address || addr;
  const resolvedGeo  = resolvedLoc.geo || geo;

  const startDate = d.startDate || d.startTime || null;
  // NOTE: we do NOT filter out past events here — let the API/DB handle that
  // so we don't accidentally drop events due to timezone differences

  return {
    id:              d['@id'] || item.id,
    source_feed:     feedMeta.name,
    modified:        item.modified || 0,
    name:            name,
    description:     description,
    activity:        activity,
    activity_raw:    resolvedActivityRaw,
    start_date:      startDate,
    end_date:        d.endDate || d.endTime || null,
    duration:        d.duration || (seriesData ? seriesData.duration : null) || null,
    location_name:   resolvedLoc.name || resolvedAddr.streetAddress || null,
    street_address:  resolvedAddr.streetAddress || null,
    city:            resolvedAddr.addressLocality || resolvedAddr.addressRegion || null,
    postcode:        resolvedAddr.postalCode || null,
    lat:             parseFloat(resolvedGeo.latitude)  || null,
    lng:             parseFloat(resolvedGeo.longitude) || null,
    price:           extractPrice(d) !== null ? extractPrice(d) : (seriesData ? extractPrice(seriesData.raw || {}) : null),
    price_currency:  'GBP',
    url:             d.url || (seriesData ? seriesData.url : null) || d['@id'] || null,
    organiser_name:  extractOrganiser(d, seriesData),
    organiser_url:   extractOrganiserUrl(d, seriesData),
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
  if (d.name && d.name.trim() && isUsefulName(d.name)) return d.name.trim();
  if (seriesData && seriesData.name && isUsefulName(seriesData.name)) return seriesData.name.trim();
  if (d.superEvent && d.superEvent.name && isUsefulName(d.superEvent.name)) return d.superEvent.name.trim();

  var activity = activityRaw || (seriesData ? seriesData.activityRaw : '') || '';
  var actLabel = activity ? activity.charAt(0).toUpperCase() + activity.slice(1) : null;

  var seriesLoc = seriesData ? seriesData.loc : null;
  var place = null;
  if (loc && loc.name && isUsefulName(loc.name)) {
    place = loc.name;
  } else if (seriesLoc && seriesLoc.name && isUsefulName(seriesLoc.name)) {
    place = seriesLoc.name;
  } else if (loc && loc.address && loc.address.addressLocality) {
    place = loc.address.addressLocality;
  } else if (seriesLoc && seriesLoc.address && seriesLoc.address.addressLocality) {
    place = seriesLoc.address.addressLocality;
  }

  var parts = [];
  if (actLabel) parts.push(actLabel);
  if (place) parts.push('at ' + place);
  if (parts.length > 1) return parts.join(' ');

  var provider = feedMeta.name.replace(/ — (Sessions|Courses)$/, '');
  if (actLabel) return actLabel + ' \u00b7 ' + provider;
  return 'Activity \u00b7 ' + provider;
}

function isUsefulName(name) {
  if (!name || !name.trim()) return false;
  if (name.startsWith('https://') || name.startsWith('http://')) return false;
  var lower = name.toLowerCase().trim();
  var useless = ['scheduledsession', 'sessionseries', 'courseinstance', 'event', 'session'];
  return useless.indexOf(lower) === -1;
}

function extractActivity(d) {
  if (!d) return '';
  if (Array.isArray(d.activity) && d.activity.length > 0) return d.activity[0].prefLabel || '';
  if (typeof d.activity === 'string') return d.activity;
  return '';
}

function extractPrice(d) {
  if (!d) return null;
  var offers = Array.isArray(d.offers) ? d.offers : (d.offers ? [d.offers] : []);
  if (!offers.length) return null;
  var prices = offers.map(function(o) { return parseFloat(o.price); }).filter(function(p) { return !isNaN(p); });
  return prices.length ? Math.min.apply(null, prices) : null;
}

function extractOrganiser(d, seriesData) {
  var org = d.organizer || d.provider || d.organiser || null;
  if (org && org.name) return org.name;
  if (seriesData && seriesData.raw) {
    var sorg = seriesData.raw.organizer || seriesData.raw.provider || seriesData.raw.organiser || null;
    if (sorg && sorg.name) return sorg.name;
  }
  return null;
}

function extractOrganiserUrl(d, seriesData) {
  var org = d.organizer || d.provider || d.organiser || null;
  if (org && org.url) return org.url;
  if (seriesData && seriesData.raw) {
    var sorg = seriesData.raw.organizer || seriesData.raw.provider || seriesData.raw.organiser || null;
    if (sorg && sorg.url) return sorg.url;
  }
  return null;
}

module.exports = { normaliseItem: normaliseItem, normaliseSeriesItem: normaliseSeriesItem };
