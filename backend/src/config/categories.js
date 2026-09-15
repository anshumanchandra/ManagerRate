// ==========================================
// Rating Categories, Strengths, Weaknesses — Single Source of Truth
// ==========================================

const CATEGORIES = [
  'Leadership & Vision',
  'Communication Skills',
  'Career Development Support',
  'Work-Life Balance',
  'Fairness & Transparency',
  'Conflict Resolution',
  'Empathy & Emotional Intelligence',
  'Decision Making',
  'Team Building',
  'Accountability',
  'Technical Competence',
];

// Grouped for display
const CATEGORY_GROUPS = {
  Leadership: ['Leadership & Vision', 'Communication Skills', 'Decision Making'],
  People: ['Fairness & Transparency', 'Empathy & Emotional Intelligence', 'Conflict Resolution'],
  Growth: ['Career Development Support', 'Accountability', 'Technical Competence'],
  Culture: ['Work-Life Balance', 'Team Building'],
};

const STRENGTHS = [
  'Mentorship', 'Technical expertise', 'Communication', 'Fairness',
  'Advocacy', 'Strategic thinking', 'Empathy', 'Delegation',
  'Career development', 'Clear expectations', 'Psychological safety',
  'Innovation', 'Recognition', 'Availability', 'Trust building',
];

const WEAKNESSES = [
  'Micromanagement', 'Favoritism', 'Poor communication',
  'Unrealistic expectations', 'Poor feedback', 'Lack of recognition',
  'Overwork', 'Office politics', 'Indecisiveness', 'Unavailability',
  'Inconsistency', 'Poor conflict resolution', 'Lack of empathy',
  'No career support', 'Blame culture',
];

const TENURE_VALUES = [
  'less_than_3_months', '3_6_months', '6_12_months',
  '1_2_years', '2_5_years', '5_plus_years',
];

const RELATIONSHIP_VALUES = [
  'direct_report', 'skip_level', 'project_manager',
  'cross_functional', 'peer', 'former_direct_report',
];

const WORK_AGAIN_VALUES = [
  'definitely', 'probably', 'maybe', 'probably_not', 'definitely_not',
];

module.exports = {
  CATEGORIES,
  CATEGORY_GROUPS,
  STRENGTHS,
  WEAKNESSES,
  TENURE_VALUES,
  RELATIONSHIP_VALUES,
  WORK_AGAIN_VALUES,
};
