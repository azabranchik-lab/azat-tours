// Seeds content/guides.json from the current About team.
const C = require('../lib/content');
const A = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=500&q=80`;

const guides = [
  { id: 1, name: 'Azamat', role: 'Founder & lead guide', languages: ['KG', 'RU', 'EN'], photo: A('1500648767791-00dcc994a43e'), bio: 'Born in Karakol. 15 years on the trails. Knows every weather window on the Ala-Köl pass.' },
  { id: 2, name: 'Aizada', role: 'Head of trip planning', languages: ['KG', 'RU', 'EN'], photo: A('1544005313-94ddf0286df2'), bio: 'Designs your itinerary and answers within hours. Loves matching nervous first-timers to the right trek.' },
  { id: 3, name: 'Bektur', role: 'Certified mountain guide', languages: ['KG', 'EN', 'DE'], photo: A('1633332755192-727a05c4013d'), bio: 'High-altitude specialist, first-aid certified. Your safety lead on Tian Shan expeditions.' },
  { id: 4, name: 'Cholpon', role: 'Culture & horse-trek guide', languages: ['KG', 'RU', 'EN', 'FR'], photo: A('1438761681033-6461ffad8d80'), bio: 'Grew up in a herder family near Song-Köl. Teaches guests felt-making and the art of kymyz.' }
];
C.saveGuides(guides);
console.log(`Seeded content/guides.json with ${guides.length} guides`);
