// src/harvester/feeds.js
// Each provider has TWO feeds — a SessionSeries feed (names, descriptions)
// and a ScheduledSessions feed (individual occurrences with dates/availability).
// We harvest the series first, cache names, then resolve them onto sessions.

const FEEDS = [
  // ── Active Hartlepool ─────────────────────────────────────────────────────
  {
    name: 'Active Hartlepool',
    seriesFeed: 'https://opendata.leisurecloud.live/api/feeds/HartlepoolBoroughCouncil-live-session-series',
    sessionsFeed: 'https://opendata.leisurecloud.live/api/feeds/HartlepoolBoroughCouncil-live-scheduled-sessions',
    activity: 'general',
  },

  // ── Active Leeds ──────────────────────────────────────────────────────────
  {
    name: 'Active Leeds',
    seriesFeed: 'https://opendata.leisurecloud.live/api/feeds/ActiveLeeds-live-session-series',
    sessionsFeed: 'https://opendata.leisurecloud.live/api/feeds/ActiveLeeds-live-scheduled-sessions',
    activity: 'general',
  },

  // ── Active Leeds Courses ──────────────────────────────────────────────────
  {
    name: 'Active Leeds Courses',
    seriesFeed: null,
    sessionsFeed: 'https://opendata.leisurecloud.live/api/feeds/ActiveLeeds-live-course-instance',
    activity: 'general',
  },

  // ── Active Luton ──────────────────────────────────────────────────────────
  {
    name: 'Active Luton',
    seriesFeed: null,
    sessionsFeed: 'https://activeluton-openactive.legendonlineservices.co.uk/api/sessions',
    activity: 'general',
  },

  // ── Active Tameside ───────────────────────────────────────────────────────
  {
    name: 'Active Tameside',
    seriesFeed: null,
    sessionsFeed: 'https://tameside-openactive.legendonlineservices.co.uk/api/sessions',
    activity: 'general',
  },
];

const ACTIVITY_MAP = {
  running:   ['run', 'jog', '5k', '10k', 'half marathon', 'marathon', 'parkrun', 'fell', 'athletics', 'cross country'],
  cycling:   ['cycl', 'bike', 'velodrome', 'sportive', 'mtb', 'mountain bike', 'ride', 'spinning', 'spin'],
  triathlon: ['triathlon', 'duathlon', 'aquathlon'],
  swimming:  ['swim', 'open water', 'aqua', 'lane', 'pool'],
  crossfit:  ['crossfit', 'cross fit', 'wod', 'functional fitness'],
  walking:   ['walk', 'hike', 'trek', 'ramble', 'nordic'],
  gym:       ['gym', 'fitness', 'pilates', 'yoga', 'hiit', 'bootcamp', 'circuits', 'conditioning', 'strength', 'zumba', 'aerobics', 'dance'],
};

function normaliseActivity(rawActivity = '') {
  const lower = rawActivity.toLowerCase();
  for (const [category, keywords] of Object.entries(ACTIVITY_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'general';
}

module.exports = { FEEDS, normaliseActivity };  gym:       ['gym', 'fitness', 'pilates', 'yoga', 'spin', 'hiit', 'bootcamp'],
};

function normaliseActivity(rawActivity = '') {
  const lower = rawActivity.toLowerCase();
  for (const [category, keywords] of Object.entries(ACTIVITY_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'general';
}

module.exports = { FEEDS, normaliseActivity };
