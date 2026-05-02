export const calculateMean = (marksArray) => {
  if (!Array.isArray(marksArray) || marksArray.length === 0) return 0;

  const total = marksArray.reduce((acc, mark) => {
    if (typeof mark !== 'number') {
      throw new TypeError('All elements in the array must be numbers');
    }
    return acc + mark;
  }, 0);

  return total / marksArray.length;
};


const WEIGHTS = {
  opener: 0.3,
  midterm: 0.3,
  endterm: 0.4,
};

export const calculateOverallPerformance = (opener, midterm, endterm) => {
  if (typeof opener !== 'number' || typeof midterm !== 'number' || typeof endterm !== 'number') {
    throw new TypeError('All scores must be numbers');
  }

  return (WEIGHTS.opener * opener) + (WEIGHTS.midterm * midterm) + (WEIGHTS.endterm * endterm);
};

export const calculateRubric = (score) => {
  if (typeof score !== 'number') {
    throw new TypeError('Score must be a number');
  }

  if (score >= 80) return 'Exceeds Expectations (E.E)';
  if (score >= 65) return 'Meets Expectations (M.E)';
  if (score >= 50) return 'Approaching Expectations (A.E)';
  return 'Below Expectations (B.E)';
};