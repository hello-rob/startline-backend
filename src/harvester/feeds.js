// src/harvester/feeds.js
// Endurance-focused feeds only — running, cycling, triathlon, open water, CrossFit.
// No leisure centres or gym class feeds.

const FEEDS = [
  // ── Running ────────────────────────────────────────────────────────────────
  {
    name: 'Parkrun UK',
    seriesFeed: null,
    sessionsFeed: 'https://api.parkrun.com/m/v1/openactive/sessions',
    activity: 'running'
  },
  {
    name: 'British Athletics',
    seriesFeed: 'https://opendata.britishathletics.org.uk/api/feeds/british-athletics-session-series',
    sessionsFeed: 'https://opendata.britishathletics.org.uk/api/feeds/british-athletics-scheduled-sessions',
    activity: 'running'
  },
  {
    name: 'England Athletics',
    seriesFeed: null,
    sessionsFeed: 'https://eas.englandathletics.org/openactive/api/scheduled-sessions',
    activity: 'running'
  },

  // ── Cycling ────────────────────────────────────────────────────────────────
  {
    name: 'British Cycling',
    seriesFeed: null,
    sessionsFeed: 'https://opendata.britishcycling.org.uk/api/feeds/british-cycling-session-series',
    activity: 'cycling'
  },

  // ── Triathlon ──────────────────────────────────────────────────────────────
  {
    name: 'British Triathlon',
    seriesFeed: null,
    sessionsFeed: 'https://data.britishtriathlon.org/openactive/api/sessions',
    activity: 'triathlon'
  },

  // ── CrossFit ───────────────────────────────────────────────────────────────
  {
    name: 'CrossFit UK Affiliates',
    seriesFeed: 'https://openactive.crossfit.com/api/feeds/session-series',
    sessionsFeed: 'https://openactive.crossfit.com/api/feeds/scheduled-sessions',
    activity: 'crossfit'
  },

  // ── Open Water Swimming ────────────────────────────────────────────────────
  {
    name: 'Outdoor Swimmer',
    seriesFeed: null,
    sessionsFeed: 'https://outdoorswimmer.com/openactive/api/sessions',
    activity: 'swimming'
  }
];

const ACTIVITY_MAP = {
  running:   ['run', 'jog', '5k', '10k', 'half marathon', 'marathon', 'parkrun', 'fell', 'athletics', 'cross country', 'track', 'race', 'fun run', 'obstacle'],
  cycling:   ['cycl', 'bike', 'velodrome', 'sportive', 'mtb', 'mountain bike', 'ride', 'gran fondo', 'audax', 'road race'],
  triathlon: ['triathlon', 'duathlon', 'aquathlon', 'swimrun'],
  swimming:  ['swim', 'open water', 'wild swim', 'lake swim', 'sea swim', 'river swim'],
  crossfit:  ['crossfit', 'cross fit', 'wod', 'functional fitness', 'hyrox'],
  walking:   ['walk', 'hike', 'trek', 'ramble', 'nordic walking', 'ultra walk']
};

function normaliseActivity(rawActivity) {
  if (!rawActivity) return 'general';
  var lower = rawActivity.toLowerCase();
  var categories = Object.keys(ACTIVITY_MAP);
  for (var i = 0; i < categories.length; i++) {
    var keywords = ACTIVITY_MAP[categories[i]];
    for (var j = 0; j < keywords.length; j++) {
      if (lower.indexOf(keywords[j]) !== -1) return categories[i];
    }
  }
  return 'general';
}

module.exports = { FEEDS: FEEDS, normaliseActivity: normaliseActivity };
