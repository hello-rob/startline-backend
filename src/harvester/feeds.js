// src/harvester/feeds.js
const FEEDS = [
  {
    name: 'Active Hartlepool',
    seriesFeed: 'https://opendata.leisurecloud.live/api/feeds/HartlepoolBoroughCouncil-live-session-series',
    sessionsFeed: 'https://opendata.leisurecloud.live/api/feeds/HartlepoolBoroughCouncil-live-scheduled-sessions',
    activity: 'general'
  },
  {
    name: 'Active Leeds',
    seriesFeed: 'https://opendata.leisurecloud.live/api/feeds/ActiveLeeds-live-session-series',
    sessionsFeed: 'https://opendata.leisurecloud.live/api/feeds/ActiveLeeds-live-scheduled-sessions',
    activity: 'general'
  },
  {
    name: 'Active Leeds Courses',
    seriesFeed: null,
    sessionsFeed: 'https://opendata.leisurecloud.live/api/feeds/ActiveLeeds-live-course-instance',
    activity: 'general'
  },
  {
    name: 'Active Luton',
    seriesFeed: null,
    sessionsFeed: 'https://activeluton-openactive.legendonlineservices.co.uk/api/sessions',
    activity: 'general'
  },
  {
    name: 'Active Tameside',
    seriesFeed: null,
    sessionsFeed: 'https://tameside-openactive.legendonlineservices.co.uk/api/sessions',
    activity: 'general'
  }
];

const ACTIVITY_MAP = {
  running:   ['run', 'jog', '5k', '10k', 'half marathon', 'marathon', 'parkrun', 'fell', 'athletics', 'cross country'],
  cycling:   ['cycl', 'bike', 'velodrome', 'sportive', 'mtb', 'mountain bike', 'ride', 'spinning', 'spin'],
  triathlon: ['triathlon', 'duathlon', 'aquathlon'],
  swimming:  ['swim', 'open water', 'aqua', 'lane', 'pool'],
  crossfit:  ['crossfit', 'cross fit', 'wod', 'functional fitness'],
  walking:   ['walk', 'hike', 'trek', 'ramble', 'nordic'],
  gym:       ['gym', 'fitness', 'pilates', 'yoga', 'hiit', 'bootcamp', 'circuits', 'conditioning', 'strength', 'zumba', 'aerobics', 'dance']
};

function normaliseActivity(rawActivity) {
  if (!rawActivity) return 'general';
  var lower = rawActivity.toLowerCase();
  var categories = Object.keys(ACTIVITY_MAP);
  for (var i = 0; i < categories.length; i++) {
    var category = categories[i];
    var keywords = ACTIVITY_MAP[category];
    for (var j = 0; j < keywords.length; j++) {
      if (lower.indexOf(keywords[j]) !== -1) return category;
    }
  }
  return 'general';
}

module.exports = { FEEDS: FEEDS, normaliseActivity: normaliseActivity };
