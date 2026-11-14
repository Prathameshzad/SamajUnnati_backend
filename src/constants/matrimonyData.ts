// backend/src/constants/matrimonyData.ts

export const COMMON_HOBBIES = [
  'Reading', 'Traveling', 'Cooking', 'Photography', 'Gaming',
  'Music', 'Art', 'Sports', 'Dancing', 'Yoga',
  'Cycling', 'Trekking', 'Baking', 'Gardening', 'Swimming',
  'Writing', 'Painting', 'Singing', 'DIY Projects', 'Fitness',
  'Board Games', 'Volunteering', 'Meditation', 'Astrology', 'Fishing',
  'Calligraphy', 'Pottery', 'Knitting', 'Bird Watching', 'Astronomy',
  'Stand-up Comedy', 'Podcasting', 'Video Editing', 'Rock Climbing', 'Surfing',
];

export const COMMON_INTERESTS = [
  'Technology', 'Movies', 'Nature', 'Finance', 'Startups',
  'Literature', 'Food', 'History', 'Science', 'Politics',
  'Anime', 'Fashion', 'Architecture', 'Business', 'Spirituality',
  'Animals/Pets', 'Theater', 'Philosophy', 'Comedy', 'Environment',
  'Real Estate', 'Cryptocurrency', 'Automobiles', 'Aviation', 'Investing',
  'Language Learning', 'Pop Culture', 'Documentaries', 'Social Media', 'Design',
  'Geopolitics', 'Fitness & Wellness', 'Veganism', 'Mental Health', 'Space',
];

/**
 * "Vibes" — Bumble-style personality tags. Users pick up to 3.
 * `emoji` is display-only; `value` is what gets stored.
 */
export const MATRIMONY_VIBES = [
  { value: 'Family-first', emoji: '🏡' },
  { value: 'Ambitious', emoji: '🚀' },
  { value: 'Adventurous', emoji: '🏔️' },
  { value: 'Foodie', emoji: '🍜' },
  { value: 'Spiritual', emoji: '🙏' },
  { value: 'Traditional', emoji: '🪔' },
  { value: 'Modern thinker', emoji: '💡' },
  { value: 'Homebody', emoji: '🛋️' },
  { value: 'Traveller', emoji: '✈️' },
  { value: 'Fitness freak', emoji: '💪' },
  { value: 'Creative soul', emoji: '🎨' },
  { value: 'Calm & grounded', emoji: '🌿' },
  { value: 'Funny', emoji: '😂' },
  { value: 'Romantic', emoji: '💕' },
  { value: 'Music lover', emoji: '🎧' },
  { value: 'Pet lover', emoji: '🐾' },
  { value: 'Bookworm', emoji: '📚' },
  { value: 'Social butterfly', emoji: '🦋' },
];

export const FAMILY_TYPES = ['Joint family', 'Nuclear family', 'Living independently'];

export const MARRIAGE_TIMELINES = [
  'Within 6 months',
  '6 – 12 months',
  '1 – 2 years',
  'Not sure yet',
];
