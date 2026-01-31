// Very small RAG Triad evaluator (Faithfulness, Relevancy, Precision)
function scoreFaithfulness(generated, sources, expected) {
  // crude heuristic: presence of expected tokens
  if (!expected) return 0.5;
  const match = expected.split(/\s+/).filter(w => generated.toLowerCase().includes(w.toLowerCase())).length;
  return Math.min(1, match / Math.max(1, expected.split(/\s+/).length));
}

function scoreRelevancy(generated, query) {
  // simple overlap heuristic
  const qTokens = query.split(/\s+/).map(s=>s.toLowerCase());
  const g = generated.toLowerCase();
  const overlap = qTokens.filter(t => t && g.includes(t)).length;
  return Math.min(1, overlap / Math.max(1, qTokens.length));
}

function scorePrecision(generated) {
  // penalize hedging words as a naive precision proxy
  const hedges = ['maybe','possibly','could','might','may'];
  const count = hedges.filter(h => generated.toLowerCase().includes(h)).length;
  return Math.max(0, 1 - (count * 0.2));
}

function evaluate({generated, sources, query, expected}) {
  const faith = scoreFaithfulness(generated, sources, expected);
  const rel = scoreRelevancy(generated, query);
  const prec = scorePrecision(generated);
  return {faithfulness: faith, relevancy: rel, precision: prec, score: (faith+rel+prec)/3};
}

module.exports = { evaluate };
