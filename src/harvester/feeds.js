// src/harvester/feeds.js
const FEEDS = [
  {
    name: 'Active Leeds — Sessions',
    url: 'https://opendata.leisurecloud.live/api/feeds/ActiveLeeds-live-scheduled-sessions',
    activity: 'running',
  },
  {
    name: 'Active Hartlepool — Sessions',
    url: 'https://opendata.leisurecloud.live/api/feeds/HartlepoolBoroughCouncil-live-scheduled-sessions',
    activity: 'running',
  },
  {
    name: 'Active Leeds — Courses',
    url: 'https://opendata.leisurecloud.live/api/feeds/ActiveLeeds-live-course-instance',
    activity: 'cycling',
  },
  {
    name: 'Active Luton — Sessions',
    url: 'https://activeluton-openactive.legendonlineservices.co.uk/api/sessions',
    activity: 'general',
  },
  {
    name: 'Active Tameside — Sessions',
    url: 'https://tameside-openactive.legendonlineservices.co.uk/api/sessions',
    activity: 'general',
  },
];

const ACTIVITY_MAP = {
  running:   ['run', 'jog', '5k', '10k', 'half marathon', 'marathon', 'parkrun', 'fell'],
  cycling:   ['cycl', 'bike', 'velodrome', 'sportive', 'mtb', 'mountain bike', 'ride'],
  triathlon: ['triathlon', 'duathlon', 'aquathlon'],
  swimming:  ['swim', 'open water', 'aqua', 'serpentine'],
  crossfit:  ['crossfit', 'cross fit', 'wod', 'functional fitness'],
  walking:   ['walk', 'hike', 'trek', 'ramble'],
  gym:       ['gym', 'fitness', 'pilates', 'yoga', 'spin', 'hiit', 'bootcamp'],
};

function normaliseActivity(rawActivity = '') {
  const lower = rawActivity.toLowerCase();
  for (const [category, keywords] of Object.entries(ACTIVITY_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) return category;
  }
  return 'general';
}

module.exports = { FEEDS, normaliseActivity };
