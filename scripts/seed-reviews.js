// Seeds content/reviews.json from the current demo testimonials.
// placement: 'home' | 'reviews' | 'guide:<id>' | 'tour:<slug>'
const C = require('../lib/content');
const A = id => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=120&q=80`;

const reviews = [
  // homepage carousel
  { id: 5001, name: 'Hannah R.', country: 'Germany', context: 'Song-Köl Horse Trek', rating: 5, avatar: A('1438761681033-6461ffad8d80'), placement: 'home', text: "The Song-Köl horse trek was the highlight of our whole Central Asia trip. Our guide felt like family by day two. Flawless organisation from the first email." },
  { id: 5002, name: 'James K.', country: 'Australia', context: 'Ala-Köl Trek', rating: 5, avatar: A('1500648767791-00dcc994a43e'), placement: 'home', text: "Ala-Köl nearly broke my legs and completely stole my heart. Alatoo handled permits, food and weather calls perfectly. Worth every cent." },
  { id: 5003, name: 'Sofia & Lena', country: 'Canada', context: 'Issyk-Köl & Nomad Culture', rating: 5, avatar: A('1544005313-94ddf0286df2'), placement: 'home', text: "As two solo women travellers we felt safe the entire time. Genuine local hospitality, beautiful yurts, and the clearest communication before arrival." },
  { id: 5004, name: 'Daniel M.', country: 'UK', context: 'Tailor-Made Family Trip', rating: 5, avatar: A('1633332755192-727a05c4013d'), placement: 'home', text: "They built a custom 9-day itinerary around our kids and it was magic. Eagle hunters, yurts, hot springs — the children still talk about it." },
  // reviews page extras
  { id: 5005, name: 'Lucas P.', country: 'France', context: 'Ultimate Road Trip', rating: 5, avatar: A('1507003211169-0a1dd7228f2d'), placement: 'reviews', text: "Best decision was going with a local operator. Roads, weather, where to eat — they just knew. The Kel-Suu off-road day was unreal." },
  { id: 5006, name: 'Marco B.', country: 'Italy', context: 'Best of Kyrgyzstan', rating: 5, avatar: A('1488161628813-04466f872be2'), placement: 'reviews', text: "I found them on Instagram and was nervous booking a whole trip over WhatsApp — but they answered every question within hours. Totally legit and so kind." },
  { id: 5007, name: 'Emma T.', country: 'New Zealand', context: 'Hidden Trails Horse Tour', rating: 5, avatar: A('1547425260-76bcadfb4f2c'), placement: 'reviews', text: "Horses well cared for, guides experienced, food surprisingly great in the middle of nowhere. A proper adventure with zero stress." },
  { id: 5008, name: 'Thomas W.', country: 'USA', context: 'Express Tour', rating: 5, avatar: A('1463453091185-61582044d556'), placement: 'reviews', text: "Did the express 5-day tour with limited time and still saw so much. Punctual, professional, and genuinely warm people." },
  { id: 5009, name: 'Yuki S.', country: 'Japan', context: 'Active Kyrgyzstan', rating: 5, avatar: A('1534528741775-53994a69daeb'), placement: 'reviews', text: "From airport pickup to the last sunset over Song-Köl, everything was seamless. This team loves their country and it shows." },
  // guide-specific
  { id: 5010, name: 'Hannah R.', country: 'Germany', rating: 5, avatar: A('1438761681033-6461ffad8d80'), placement: 'guide:1', text: "Azamat read the mountain weather like a book and made the big pass day feel safe and fun." },
  { id: 5011, name: 'Daniel M.', country: 'UK', rating: 5, avatar: A('1633332755192-727a05c4013d'), placement: 'guide:2', text: "Aizada planned everything around our kids and replied to my hundred questions within hours. Incredible." },
  { id: 5012, name: 'James K.', country: 'Australia', rating: 5, avatar: A('1500648767791-00dcc994a43e'), placement: 'guide:3', text: "Bektur is a proper mountain pro — calm, prepared, and you instantly trust him at altitude." },
  { id: 5013, name: 'Sofia & Lena', country: 'Canada', rating: 5, avatar: A('1544005313-94ddf0286df2'), placement: 'guide:4', text: "Cholpon welcomed us into her family's world — kymyz, felt-making, songs by the fire. Unforgettable." }
];
C.saveReviews(reviews);
console.log(`Seeded content/reviews.json with ${reviews.length} reviews`);
