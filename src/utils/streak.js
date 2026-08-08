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
export const isDateRequired = (ritual, date) => {
  if (!date) return false;
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  if (ritual.repeat_type === 'daily') return true;

  if (ritual.repeat_type === 'custom' && ritual.custom_days) {
    return ritual.custom_days.includes(d.getDay());
  }

  if (ritual.repeat_type === 'weekly' || ritual.repeat_type === 'biweekly') {
    const createdDate = new Date(ritual.created_at);
    createdDate.setHours(0, 0, 0, 0);

    // Must be on the same day of the week
    if (d.getDay() !== createdDate.getDay()) return false;

    if (ritual.repeat_type === 'biweekly') {
      const diffTime = Math.abs(d - createdDate);
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      const diffWeeks = Math.floor(diffDays / 7);
      return diffWeeks % 2 === 0;
    }

    return true; // weekly
  }

  return false;
};

/**
 * Dynamically calculates a ritual's current streak from its habit logs and repeat rules.
 */
export const calculateStreak = (ritual) => {
  if (!ritual) return 0;
  
  const logs = ritual.habit_logs || [];
  if (logs.length === 0) return 0;

  // Create a set of completed date strings in local timezone
  const completedDates = new Set(
    logs.map(log => new Date(log.completed_at).toDateString())
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const createdDate = new Date(ritual.created_at);
  createdDate.setHours(0, 0, 0, 0);

  let checkDate = new Date(today);
  let streak = 0;

  while (checkDate >= createdDate) {
    const checkDateStr = checkDate.toDateString();
    const isCompleted = completedDates.has(checkDateStr);

    if (isCompleted) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // If today is not completed yet, the streak is not broken yet, check yesterday
      if (checkDateStr === today.toDateString()) {
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Check if checkDate was a required day
        const isRequired = isDateRequired(ritual, checkDate);
        if (isRequired) {
          // Missed a required day! Streak is broken.
          break;
        } else {
          // Not required, skip to previous day
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
    }
  }

  return streak;
};

