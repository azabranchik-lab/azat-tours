// Gazetteer of the key places tours visit: canonical name, coordinates, default label side
// on the stops map, and the spellings that name the place in itinerary text (Song-Kul /
// Song-Kol / Son-Kol, Ysyk-Kol / Issyk-Kul...). Used by scripts/check-sights.js to verify that
// every place shown under "Sights visited on this tour" is really on the route, and by the
// destination hubs to match tours to a place.
const GAZ = [
  { key: 'bishkek',       name: 'Bishkek',           lat: 42.875, lng: 74.59,  dir: 'left',   pat: /Bishkek/i },
  { key: 'song-kol',      name: 'Song-Kul Lake',     lat: 41.84,  lng: 75.13,  dir: 'bottom', pat: /Song[-\s]?K[oöu]l|Son-Kol/i },
  { key: 'issyk-kol',     name: 'Lake Issyk-Kul',    lat: 42.20,  lng: 77.20,  dir: 'top',    pat: /[YI]ssyk[-\s]?K[oöu]l|Ysyk[-\s]?K[oöu]l/i },
  { key: 'kel-suu',       name: 'Kel-Suu Lake',      lat: 40.687, lng: 76.394, dir: 'top',    pat: /Kel[-\s]?Suu|K[oö]l[-\s]?Suu/i },
  { key: 'karakol',       name: 'Karakol',           lat: 42.49,  lng: 78.394, dir: 'top',    pat: /Karakol/i },
  { key: 'altyn-arashan', name: 'Altyn-Arashan',     lat: 42.37,  lng: 78.66,  dir: 'right',  pat: /Altyn[-\s]?Arashan/i },
  { key: 'ala-kol',       name: 'Ala-Kul Lake',      lat: 42.33,  lng: 78.55,  dir: 'bottom', pat: /Ala[-\s]?K[oöu]l/i },
  { key: 'skazka',        name: 'Fairy-Tale Canyon', lat: 42.136, lng: 77.438, dir: 'bottom', pat: /Fairy[-\s]?Tale|Skazka/i },
  { key: 'naryn',         name: 'Naryn',             lat: 41.43,  lng: 75.99,  dir: 'bottom', pat: /\bNaryn\b/i },
  { key: 'kochkor',       name: 'Kochkor',           lat: 42.21,  lng: 75.75,  dir: 'left',   pat: /Kochkor/i },
  { key: 'tash-rabat',    name: 'Tash Rabat',        lat: 40.82,  lng: 75.31,  dir: 'bottom', pat: /Tash[-\s]?Rabat/i },
  { key: 'talas',         name: 'Talas',             lat: 42.52,  lng: 72.24,  dir: 'top',    pat: /Talas/i },
  { key: 'besh-tash',     name: 'Besh-Tash Lake',    lat: 41.98,  lng: 72.15,  dir: 'bottom', pat: /Besh[-\s]?Tash/i },
  { key: 'bokonbaev',     name: 'Bokonbayevo',       lat: 42.12,  lng: 76.99,  dir: 'bottom', pat: /Bokonbaev/i },
  { key: 'cholpon-ata',   name: 'Cholpon-Ata',       lat: 42.65,  lng: 77.08,  dir: 'top',    pat: /Cholpon[-\s]?Ata/i },
  { key: 'chong-kemin',   name: 'Chong-Kemin',       lat: 42.75,  lng: 76.00,  dir: 'top',    pat: /Chong[-\s]?Kemin/i },
  { key: 'kol-ukok',      name: 'Köl-Ükök Lake',     lat: 42.07,  lng: 75.99,  dir: 'right',  pat: /K[oö]l[-\s]?Ukok|Kol[-\s]?Ükök/i },
  { key: 'jeti-oguz',     name: 'Jeti-Ögüz',         lat: 42.34,  lng: 78.23,  dir: 'bottom', pat: /Je[ti]+[-\s]?[OÖ]g[uü]z|Jety[-\s]?Oguz/i },
  { key: 'kyzart',        name: 'Kyzart',            lat: 41.878, lng: 75.18,  dir: 'left',   pat: /Kyzart/i },
  { key: 'tash-bashat',   name: 'Tash-Bashat',       lat: 41.466, lng: 76.395, dir: 'right',  pat: /Tash[-\s]?Bashat/i },
  { key: 'ak-suu',        name: 'Ak-Suu',            lat: 42.46,  lng: 78.53,  dir: 'left',   pat: /Ak[-\s]?Suu|Ak[-\s]?Su\b/i },
  { key: 'kyzyl-oi',      name: 'Kyzyl-Oi',          lat: 41.87,  lng: 74.34,  dir: 'top',    pat: /Kyzyl[-\s]?Oi/i },
  { key: 'ming-kush',     name: 'Ming-Kush',         lat: 41.66,  lng: 74.55,  dir: 'left',   pat: /Ming[-\s]?Kush/i },
  { key: 'kok-kiya',      name: 'Kok-Kiya Valley',   lat: 40.55,  lng: 76.30,  dir: 'right',  pat: /Kok[-\s]?Kiya/i },
  { key: 'osh',           name: 'Osh',               lat: 40.53,  lng: 72.79,  dir: 'bottom', pat: /\bOsh\b/i },
];

module.exports = { GAZ };
