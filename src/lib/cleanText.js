// Light profanity filter for user-generated text (names, chat, custom
// words) — an App Store UGC expectation. English + Dutch. Matches whole
// words case-insensitively and masks them; deliberately conservative so
// normal words never get mangled.
const BLOCKLIST = [
  // en
  'fuck', 'fucking', 'fucker', 'shit', 'bitch', 'asshole', 'cunt', 'dick',
  'cock', 'pussy', 'whore', 'slut', 'bastard', 'faggot', 'fag', 'nigger',
  'nigga', 'retard', 'rape', 'nazi',
  // nl
  'kanker', 'kkr', 'kut', 'hoer', 'lul', 'tering', 'tyfus', 'godverdomme',
  'gvd', 'neger', 'flikker', 'mongool', 'debiel', 'kutwijf', 'klootzak',
];

const PATTERN = new RegExp(`\\b(${BLOCKLIST.join('|')})\\b`, 'gi');

export function cleanText(text) {
  if (!text) return text;
  return text.replace(PATTERN, m => '*'.repeat(m.length));
}
