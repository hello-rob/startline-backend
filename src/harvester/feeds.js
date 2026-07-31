// src/harvester/feeds.js
var FEEDS = [
  // ── Triathlon ──────────────────────────────────────────────────────────────
  {
    name: 'British Triathlon',
    seriesFeed: null,
    sessionsFeed: 'https://api.britishtriathlon.org/openactive/v1/events',
    activity: 'triathlon'
  },

  // ── Cycling ────────────────────────────────────────────────────────────────
  {
    name: 'British Cycling',
    seriesFeed: null,
    sessionsFeed: 'http://api.letsride.co.uk/public/v1/rides',
    activity: 'cycling'
  },

  // ── Running / Orienteering ─────────────────────────────────────────────────
  {
    name: 'British Orienteering',
    seriesFeed: null,
    sessionsFeed: 'https://www.britishorienteering.org.uk/fullfixturesjson.php',
    activity: 'running'
  },

  // Good Gym — community running events
  {
    name: 'Good Gym',
    seriesFeed: null,
    sessionsFeed: 'https://www.goodgym.org/api/openactive/events',
    activity: 'running'
  },

  // Our Parks — free outdoor running sessions
  {
    name: 'Our Parks',
    seriesFeed: null,
    sessionsFeed: 'https://ourparks.org.uk/api/events',
    activity: 'running'
  },

  // Bookwhen — used by many running clubs and small race organisers
  {
    name: 'Bookwhen',
    seriesFeed: 'https://bookwhen.com/api/openactive/sessionseries',
    sessionsFeed: 'https://bookwhen.com/api/openactive/scheduledsessions',
    activity: 'general'
  },

  // Open Sessions — community sport sessions including running clubs
  {
    name: 'Open Sessions',
    seriesFeed: 'https://opensessions.io/api/rpde/session-series',
    sessionsFeed: 'https://opensessions.io/api/rpde/events',
    activity: 'general'
  }
];

var ACTIVITY_MAP = {
  running:   ['run', 'jog', '5k', '10k', 'half marathon', 'marathon', 'parkrun', 'fell', 'athletics', 'cross country', 'track', 'race', 'fun run', 'obstacle', 'orienteer', 'trail', 'mud', 'colour run', 'santa run', 'charity run'],
  cycling:   ['cycl', 'bike', 'ride', 'velodrome', 'sportive', 'mtb', 'mountain bike', 'gran fondo', 'audax', 'road race'],
  triathlon: ['triathlon', 'duathlon', 'aquathlon', 'swimrun', 'ironman', 'outlaw', '70.3'],
  swimming:  ['swim', 'open water', 'wild swim', 'lake swim', 'sea swim', 'river swim'],
  crossfit:  ['crossfit', 'cross fit', 'wod', 'functional fitness', 'hyrox'],
  walking:   ['walk', 'hike', 'trek', 'ramble', 'nordic walking', 'ultra walk']
};

function normaliseActivity(rawActivity) {
  if (!rawActivity) return 'general';
  var lower = rawActivity.toLowerCase();
  var keys = Object.keys(ACTIVITY_MAP);
  for (var i = 0; i < keys.length; i++) {
    var kws = ACTIVITY_MAP[keys[i]];
    for (var j = 0; j < kws.length; j++) {
      if (lower.indexOf(kws[j]) !== -1) return keys[i];
    }
  }
  return 'general';
}

module.exports = { FEEDS: FEEDS, normaliseActivity: normaliseActivity };
