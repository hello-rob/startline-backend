// src/harvester/feeds.js
// Only confirmed live OpenActive feeds from status.openactive.io

var FEEDS = [
  // British Triathlon — covers Outlaw, Ironman UK, all BTF-sanctioned tri events
  {
    name: 'British Triathlon',
    seriesFeed: null,
    sessionsFeed: 'https://api.britishtriathlon.org/openactive/v1/events',
    activity: 'triathlon'
  },

  // British Cycling — sportives, road races, club rides
  {
    name: 'British Cycling',
    seriesFeed: null,
    sessionsFeed: 'http://api.letsride.co.uk/public/v1/rides',
    activity: 'cycling'
  },

  // British Orienteering — trail and orienteering events
  {
    name: 'British Orienteering',
    seriesFeed: null,
    sessionsFeed: 'https://www.britishorienteering.org.uk/fullfixturesjson.php',
    activity: 'running'
  },

  // Bookwhen — used by many running clubs and small race organisers
  {
    name: 'Bookwhen',
    seriesFeed: 'https://bookwhen.com/api/openactive/sessionseries',
    sessionsFeed: 'https://bookwhen.com/api/openactive/scheduledsessions',
    activity: 'general'
  },

  // Good Gym — running with a community/charity angle
  {
    name: 'Good Gym',
    seriesFeed: null,
    sessionsFeed: 'https://www.goodgym.org/api/openactive/events',
    activity: 'running'
  },

  // Our Parks — free outdoor fitness events
  {
    name: 'Our Parks',
    seriesFeed: null,
    sessionsFeed: 'https://ourparks.org.uk/api/events',
    activity: 'running'
  }
];

var ACTIVITY_MAP = {
  running:   ['run', 'jog', '5k', '10k', 'half marathon', 'marathon', 'parkrun', 'fell', 'athletics', 'cross country', 'track', 'race', 'fun run', 'obstacle', 'orienteer'],
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
