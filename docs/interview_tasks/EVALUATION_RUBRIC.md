**Evaluation Rubric for IDE-style Interview**

Scoring (1–5 each): 1=Poor, 2=Below, 3=Meets, 4=Strong, 5=Outstanding

- **Comprehension:** reads repo, identifies entry points, reproduces behavior.
- **Design:** appropriate abstractions, API choices, backward compatibility, extensibility.
- **Implementation:** correctness, code clarity, error handling, idiomatic style.
- **Tests:** unit/regression tests added, edge cases covered, CI-awareness.
- **Tradeoffs & Reasoning:** identifies complexity, performance, and maintenance tradeoffs.
- **Communication:** explains steps, rationale, and next steps concisely.
- **AI Judgement:** appropriate use of AI, verification of outputs, and provenance.

Level thresholds (example)
- Junior: no metric below 2; at least three 3s.
- Mid: no metric below 3; at least two 4s.
- Senior: no metric below 3; at least three 4s and one 5 in Design or Tradeoffs.

Scoring tips
- Prefer evidence: reference commits, tests, and small diffs when justifying scores.
- Penalize: large copy-paste commits without tests or inability to explain core logic.

Sample quick-check (during review)
- Are there small, logical commits? (+)
- Does new behavior have tests? (+)
- Can candidate explain why they chose this data structure/algorithm? (+)
- Did they run and verify tests after AI-assisted edits? (+)
