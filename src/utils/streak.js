/**
 * Helper to check if a task was completed on the current calendar day.
 */
export const isCompletedToday = (lastCompletedDate) => {
  if (!lastCompletedDate) return false;
  return new Date().toDateString() === new Date(lastCompletedDate).toDateString();
};

/**
 * Checks if a specific date was a "required" day for the ritual.
 */
const isDateRequired = (ritual, date) => {
  if (ritual.repeat_type === 'daily') return true;
  
  if (ritual.repeat_type === 'custom' && ritual.custom_days) {
    return ritual.custom_days.includes(date.getDay());
  }
  
  return false;
};

/**
 * Finds the most recent date (before today) that the task was required.
 */
const getLastRequiredDate = (ritual) => {
  let checkDate = new Date();
  
  // Look back up to 7 days to find the last required session
  for (let i = 1; i <= 7; i++) {
    checkDate.setDate(checkDate.getDate() - 1);
    if (isDateRequired(ritual, checkDate)) {
      return checkDate.toDateString();
    }
  }
  return null;
};

/**
 * Final Streak Logic using your database columns: custom_days & repeat_type
 */
export const calculatNewStreak = (ritual) => {
  const { current_streak, last_completed_date } = ritual;
  
  const today = new Date().toDateString();
  const lastDate = last_completed_date ? new Date(last_completed_date).toDateString() : null;

  // 1. If already done today, keep the current streak
  if (lastDate === today) {
    return current_streak;
  }

  // 2. First completion ever
  if (!lastDate) {
    return 1;
  }

  // 3. Find when it was last "due"
  const lastRequired = getLastRequiredDate(ritual);

  // 4. If they did it on the last required day, increment. 
  // If no last required day found (error fallback), assume it's a new streak.
  if (lastDate === lastRequired) {
    return (current_streak || 0) + 1;
  }

  // 5. Missed the last required day = Reset
  return 1;
};