
// Define subjects for each class
const subjectsByClass = {
  'Playgroup': ['maths', 'language', 'reading', 'environmental','creative','cre'],
  'PP1': ['maths', 'language', 'reading', 'environmental','creative','cre'],
  'PP2': ['maths', 'language', 'reading', 'kiswahili','environmental', 'cre', 'creative', 'kusoma'],
  'Grade 1': ['maths', 'english', 'kiswahili', 'integrated'],
  'Grade 2': ['maths', 'english', 'kiswahili', 'integrated'],
  'Grade 3': ['maths', 'english', 'kiswahili', 'integrated'],
  'Grade 4': ['maths', 'english', 'kiswahili', 'integrated', 'social'],
  'Grade 5': ['maths', 'english', 'kiswahili', 'integrated', 'social'],
  'Grade 6': ['maths', 'english', 'kiswahili', 'integrated', 'social'],
  'Grade 7': ['maths', 'english', 'kiswahili', 'social', 'integrated', 'creative', 'cre', 'agriculture', 'pretech'],
  'Grade 8': ['maths', 'english', 'kiswahili', 'integrated', 'agriculture', 'pretech', 'creative', 'social', 'cre'],
  'Grade 9': ['maths', 'english', 'kiswahili', 'integrated', 'social', 'pretech', 'creative', 'agriculture', 'cre']
};

// Get all possible subjects across all classes for debugging
export const getAllSubjects = () => {
  const allSubjects = new Set();
  Object.values(subjectsByClass).forEach(subjects => {
    subjects.forEach(subject => allSubjects.add(subject));
  });
  return Array.from(allSubjects);
};

// Function to get subjects for a specific class
export const getSubjectsByClass = (className) => {
  if (!className) return subjectsByClass['Grade 1'];
  return subjectsByClass[className] || subjectsByClass['Grade 1'];
};

export const getSubjectDisplayName = (subject) => {
  const displayNames = {
    maths: 'Maths',
    english: 'English',
    kiswahili: 'Kiswahili',
    language: 'Language',
    reading: 'Reading',
    environmental: 'Environmental',
    integrated: 'Integrated',
    creative: 'Creative',
    cre: 'CRE',
    kusoma: 'Kusoma',
    social: 'Social',
    pretech: 'Pretech',
    agriculture: 'Agriculture'
  };
  return displayNames[subject] || subject;
};

// Function to get rubric based on mean score (using full names)
export const getRubric = (mean) => {
  if (mean >= 80) return 'Exceeds Expectations (E.E)';
  if (mean >= 65) return 'Meets Expectations (M.E)';  
  if (mean >= 50) return 'Approaching Expectations (A.E)';
  return 'Below Expectations (B.E)';
};