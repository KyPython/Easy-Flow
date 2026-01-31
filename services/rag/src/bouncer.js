// Simple moderation gateway: intent filtering + basic jailbreak detection
const bannedPatterns = [
  /ignore previous instructions/i,
  /jailbreak/i,
  /override|sudo .* instructions/i,
];

function checkIntent(query) {
  if (!query || typeof query !== 'string') return { allowed: false, reason: 'empty' };
  // Very small heuristic: require legal keywords for law-focused use
  const legalKeywords = ['contract', 'agreement', 'statute', 'court', 'liability', 'nda', 'compliance', 'policy'];
  const containsLegal = legalKeywords.some(k => query.toLowerCase().includes(k));
  if (!containsLegal) return { allowed: false, reason: 'not_legal_intent' };

  // Jailbreak/adversarial checks
  for (const re of bannedPatterns) {
    if (re.test(query)) return { allowed: false, reason: 'adversarial_detected' };
  }

  return { allowed: true };
}

module.exports = { checkIntent };
