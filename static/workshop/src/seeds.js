// Seed data merged into a user's blob on first login (PRD Appendices A & C).
// Seeded collections are ordinary editable data afterwards — deletions persist (see mergeSeeds).
const SEED_VERSION = 1;

// FR-2.5 — run-sheet item type taxonomy. category drives the default badge color family.
export const PLAN_ITEM_TYPES = [
  { id: 'seg-hook',       name: 'S: CTA/Hook',              category: 'segment',    color: '#8E011F' },
  { id: 'seg-lecture',    name: 'S: Lecture/Explanation',   category: 'segment',    color: '#8a8f98' },
  { id: 'seg-story',      name: 'S: Story/Example',         category: 'segment',    color: '#7b8794' },
  { id: 'seg-analyze',    name: 'S: Analyze Students Input',category: 'segment',    color: '#6b7480' },
  { id: 'seg-demo',       name: 'S: Demo',                  category: 'segment',    color: '#9aa0a8' },
  { id: 'seg-debrief',    name: 'S: Debrief',               category: 'segment',    color: '#7a8290' },
  { id: 'act-individual', name: 'A: Individual Activity',   category: 'activity',   color: '#4a7c59' },
  { id: 'act-pair',       name: 'A: Pair Activity',         category: 'activity',   color: '#3f8f63' },
  { id: 'act-group',      name: 'A: Group Activity',        category: 'activity',   color: '#358a5b' },
  { id: 'act-wholeroom',  name: 'A: Whole-Room Activity',   category: 'activity',   color: '#2f7d52' },
  { id: 'struct-break',   name: 'Break',                    category: 'structural', color: '#c98a3a' },
  { id: 'struct-qa',      name: 'Q&A',                      category: 'structural', color: '#b5772f' },
];

// FR-3.1 — reusable activity bank (PRD Appendix A). typeId maps to a plan item type on "add to plan";
// tags carry the richer category for filtering. suggestedTemplates resolve once Phase 2 seeds templates.
export const IDEA_BANK = [
  { id: 'bank-two-truths', title: 'Two Truths and a Lie', typeId: 'act-wholeroom', typicalDurationMin: 12, groupSize: 'any', materials: '', tags: ['icebreaker'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Each person states 3 "facts"; the group votes which is the lie. Fast trust-builder.' },
  { id: 'bank-human-bingo', title: 'Human Bingo', typeId: 'act-wholeroom', typicalDurationMin: 15, groupSize: '10+', materials: 'printed cards', tags: ['icebreaker'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_image'], description: 'Grid of traits; find a different person for each square; first to bingo wins.' },
  { id: 'bank-one-word-checkin', title: 'One-Word Check-in', typeId: 'act-wholeroom', typicalDurationMin: 8, groupSize: 'any', materials: '', tags: ['icebreaker'], sources: [], suggestedTemplates: ['tpl_wordcloud'], description: 'Round-robin: one word on your current state or expectation.' },
  { id: 'bank-expectations-wall', title: 'Expectations Wall', typeId: 'act-wholeroom', typicalDurationMin: 10, groupSize: 'any', materials: 'stickies or phones', tags: ['icebreaker'], sources: [], suggestedTemplates: ['tpl_qa_wall'], description: 'Everyone posts what they want from the session; cluster live; revisit at close.' },
  { id: 'bank-speed-networking', title: 'Speed Networking', typeId: 'act-pair', typicalDurationMin: 12, groupSize: '8+', materials: 'timer', tags: ['icebreaker'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Rotating 2-minute pairs with a prompt per round.' },
  { id: 'bank-rps-tournament', title: 'Rock-Paper-Scissors Tournament', typeId: 'act-wholeroom', typicalDurationMin: 8, groupSize: '8+', materials: '', tags: ['energizer'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Losers become cheerleaders of the winner; bracket down to a champion.' },
  { id: 'bank-stretch-shake', title: '5-4-3-2-1 Stretch & Shake', typeId: 'act-wholeroom', typicalDurationMin: 4, groupSize: 'any', materials: '', tags: ['energizer'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Countdown of shakes per limb; halves each round.' },
  { id: 'bank-category-toss', title: 'Category Toss', typeId: 'act-wholeroom', typicalDurationMin: 5, groupSize: '6–20', materials: 'soft ball', tags: ['energizer'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Toss + name an item in the category; hesitate and a new category starts.' },
  { id: 'bank-brainwriting', title: 'Brainwriting 6-3-5', typeId: 'act-group', typicalDurationMin: 30, groupSize: '6 per table', materials: 'worksheets', tags: ['brainstorm'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_debrief'], description: '6 people write 3 ideas in 5 min, pass the sheet, build on others — 108 ideas per table.' },
  { id: 'bank-1-2-4-all', title: '1-2-4-All', typeId: 'act-wholeroom', typicalDurationMin: 15, groupSize: 'any', materials: '', tags: ['brainstorm', 'liberating-structures'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_bullets'], description: 'Solo 1 min → pairs 2 min → fours 4 min → whole room shares.' },
  { id: 'bank-crazy-8s', title: 'Crazy 8s', typeId: 'act-individual', typicalDurationMin: 10, groupSize: 'any', materials: 'paper, marker', tags: ['brainstorm'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Fold paper into 8; sketch 8 variants in 8 minutes; share the best.' },
  { id: 'bank-mind-map', title: 'Mind Mapping', typeId: 'act-group', typicalDurationMin: 18, groupSize: '2–6 per group', materials: 'flipchart', tags: ['brainstorm'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_image'], description: 'Central concept with radiating branches; groups present their maps.' },
  { id: 'bank-reverse-brainstorm', title: 'Reverse Brainstorm', typeId: 'act-group', typicalDurationMin: 18, groupSize: 'any', materials: 'flipchart', tags: ['brainstorm'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_two_col'], description: '"How would we guarantee failure?" then invert each answer into a fix.' },
  { id: 'bank-think-pair-share', title: 'Think-Pair-Share', typeId: 'act-pair', typicalDurationMin: 12, groupSize: 'any', materials: '', tags: ['discussion'], sources: [], suggestedTemplates: ['tpl_bullets'], description: 'Solo reflection → pair discussion → volunteers share out.' },
  { id: 'bank-fishbowl', title: 'Fishbowl', typeId: 'act-wholeroom', typicalDurationMin: 25, groupSize: '10+', materials: 'chairs in circles', tags: ['discussion'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Inner circle discusses, outer observes; an open chair lets observers join; swap.' },
  { id: 'bank-world-cafe', title: 'World Café', typeId: 'act-group', typicalDurationMin: 50, groupSize: '12+', materials: 'tables, flipcharts', tags: ['discussion'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_agenda'], description: 'Rotating table conversations; a host stays at each; harvest insights at the end.' },
  { id: 'bank-gallery-walk', title: 'Gallery Walk', typeId: 'act-group', typicalDurationMin: 25, groupSize: 'any', materials: 'posters on walls', tags: ['discussion'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Small groups rotate past stations, annotate with stickies, then debrief.' },
  { id: 'bank-spectrum-line', title: 'Spectrum Line / Polarity Walk', typeId: 'act-wholeroom', typicalDurationMin: 15, groupSize: 'any', materials: 'floor space', tags: ['discussion'], sources: [], suggestedTemplates: ['tpl_quote', 'tpl_rating'], description: 'Read a statement; stand along the agree↔disagree line; interview positions.' },
  { id: 'bank-nasa-moon', title: 'NASA Moon Survival', typeId: 'act-group', typicalDurationMin: 50, groupSize: 'teams of 4–6', materials: 'ranking sheets', tags: ['game', 'simulation'], sources: [{ url: '/projects/nasa-moon-survival/', title: 'NASA Moon Survival (in repo)' }], suggestedTemplates: ['tpl_instructions', 'tpl_table', 'tpl_big_number'], description: 'Rank 15 items solo → team consensus → compare to NASA. Teams beat individuals — the point.' },
  { id: 'bank-marshmallow', title: 'Marshmallow Challenge', typeId: 'act-group', typicalDurationMin: 45, groupSize: 'teams of 4', materials: 'spaghetti, tape, marshmallow', tags: ['game'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_big_number'], description: '18 minutes to build the tallest marshmallow-topped tower; the iterate-early lesson.' },
  { id: 'bank-paper-tower', title: 'Paper Tower', typeId: 'act-group', typicalDurationMin: 30, groupSize: 'teams', materials: 'paper only', tags: ['game'], sources: [], suggestedTemplates: ['tpl_instructions'], description: 'Tallest freestanding tower from paper alone; constraints breed creativity.' },
  { id: 'bank-broken-squares', title: 'Broken Squares', typeId: 'act-group', typicalDurationMin: 35, groupSize: '5 per group', materials: 'puzzle sets', tags: ['game'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_debrief'], description: 'Silent cooperation puzzle: you may give pieces, not take; debrief collaboration.' },
  { id: 'bank-case-study', title: 'Case Study Analysis', typeId: 'act-group', typicalDurationMin: 35, groupSize: '3–6 per group', materials: 'case handout', tags: ['application'], sources: [], suggestedTemplates: ['tpl_two_col', 'tpl_bullets'], description: 'Read → analyze with a provided framework → present recommendations.' },
  { id: 'bank-role-play', title: 'Role Play', typeId: 'act-pair', typicalDurationMin: 30, groupSize: 'pairs/triads', materials: 'scenario cards', tags: ['application'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_debrief'], description: 'Actor / counterpart / observer rotate; observer uses a feedback form.' },
  { id: 'bank-orid', title: 'ORID Focused Debrief', typeId: 'seg-debrief', typicalDurationMin: 18, groupSize: 'any', materials: '', tags: ['reflection', 'debrief'], sources: [], suggestedTemplates: ['tpl_debrief'], description: 'Four question rounds: Objective → Reflective → Interpretive → Decisional.' },
  { id: 'bank-plus-delta', title: 'Plus/Delta', typeId: 'seg-debrief', typicalDurationMin: 10, groupSize: 'any', materials: 'flipchart or poll', tags: ['reflection', 'debrief'], sources: [], suggestedTemplates: ['tpl_two_col', 'tpl_qa_wall'], description: 'Two columns: what worked (+) and what to change (Δ).' },
  { id: 'bank-journaling', title: 'Journaling Prompt', typeId: 'act-individual', typicalDurationMin: 10, groupSize: 'solo', materials: 'notebooks', tags: ['reflection'], sources: [], suggestedTemplates: ['tpl_quote', 'tpl_bullets'], description: 'Silent written reflection on 1–3 prompts; optional pair share.' },
  { id: 'bank-action-planning', title: 'Action Planning', typeId: 'act-individual', typicalDurationMin: 18, groupSize: 'solo→pairs', materials: 'worksheet', tags: ['reflection'], sources: [], suggestedTemplates: ['tpl_instructions', 'tpl_bullets'], description: 'Commit to 1–3 specific actions with dates; exchange with an accountability partner.' },
  { id: 'bank-quiz-round', title: 'Quiz Round', typeId: 'act-wholeroom', typicalDurationMin: 12, groupSize: 'any', materials: 'phones', tags: ['application', 'interactive'], sources: [], suggestedTemplates: ['tpl_quiz'], description: '5–10 multiple-choice questions on the material, live scoring.' },
  { id: 'bank-poll-discuss', title: 'Poll & Discuss', typeId: 'act-wholeroom', typicalDurationMin: 8, groupSize: 'any', materials: 'phones', tags: ['discussion', 'interactive'], sources: [], suggestedTemplates: ['tpl_poll'], description: 'Live poll on a spicy question, then discuss the distribution.' },
  { id: 'bank-closing-circle', title: 'One-Word Closing Circle', typeId: 'act-wholeroom', typicalDurationMin: 8, groupSize: 'any', materials: '', tags: ['reflection'], sources: [], suggestedTemplates: ['tpl_wordcloud', 'tpl_closing'], description: 'Round-robin single-word takeaway; word-cloud version for large rooms.' },
  { id: 'bank-qa-block', title: 'Q&A Block', typeId: 'struct-qa', typicalDurationMin: 12, groupSize: 'any', materials: 'phones optional', tags: ['structural'], sources: [], suggestedTemplates: ['tpl_qa_wall'], description: 'Open floor or a moderated wall of submitted questions.' },
  { id: 'bank-break', title: 'Break', typeId: 'struct-break', typicalDurationMin: 12, groupSize: '', materials: '', tags: ['structural'], sources: [], suggestedTemplates: ['tpl_section'], description: 'Timed break; the slide shows the return time.' },
  { id: 'bank-lecture-segment', title: 'Lecture Segment', typeId: 'seg-lecture', typicalDurationMin: 10, groupSize: '', materials: '', tags: ['structural'], sources: [], suggestedTemplates: ['tpl_bullets', 'tpl_two_col', 'tpl_big_number'], description: 'Structured content delivery; keep to ≤15 min between activations.' },
];

// FR-8.2 — interaction presets over the built-in kinds (PRD Appendix C). Used from Phase 4.
export const INTERACTION_TEMPLATES = [
  { id: 'ix-poll-single', name: 'Single-choice poll', kind: 'choice', config: { multi: false, resultsDisplay: 'bars' } },
  { id: 'ix-poll-multi',  name: 'Multi-choice poll',  kind: 'choice', config: { multi: true, resultsDisplay: 'bars' } },
  { id: 'ix-quiz',        name: 'Quiz question',      kind: 'choice', config: { multi: false, correctIndex: null, revealOnStep: true, resultsDisplay: 'bars' } },
  { id: 'ix-wordcloud',   name: 'Word cloud',         kind: 'freetext', config: { maxLen: 30, maxSubmissions: 3, aggregate: 'words' } },
  { id: 'ix-open-wall',   name: 'Open wall',          kind: 'freetext', config: { maxLen: 200, maxSubmissions: 1, aggregate: 'cards' } },
  { id: 'ix-scale',       name: '1–5 scale',          kind: 'rating', config: { min: 1, max: 5, labels: ['Strongly disagree', 'Strongly agree'] } },
  { id: 'ix-hotspot',     name: 'Image hotspot',      kind: 'hotspot', config: { imageUrl: '', overlay: 'dots' } },
];

// Fill empty editable collections on a user's very first load only. After seedVersion is set we
// never re-seed, so deleting a seeded entry sticks. Returns { data, changed }.
export function mergeSeeds(blob) {
  const data = { ...(blob || {}) };
  let changed = false;
  if (!Array.isArray(data.workshops)) { data.workshops = []; changed = true; }
  data.settings = data.settings || {};
  if (data.settings.seedVersion == null) {
    if (!Array.isArray(data.planItemTypes) || !data.planItemTypes.length) data.planItemTypes = clone(PLAN_ITEM_TYPES);
    if (!Array.isArray(data.ideaBank) || !data.ideaBank.length) data.ideaBank = clone(IDEA_BANK);
    if (!Array.isArray(data.interactionTemplates) || !data.interactionTemplates.length) data.interactionTemplates = clone(INTERACTION_TEMPLATES);
    data.settings.seedVersion = SEED_VERSION;
    changed = true;
  }
  return { data, changed };
}

function clone(x) { return typeof structuredClone === 'function' ? structuredClone(x) : JSON.parse(JSON.stringify(x)); }
