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
 * Calculates the new streak when a ritual is completed.
 * It strictly adds 1 because missed days are already zeroed out by `resetMissedStreaks` in Home.
 */
export const calculateNewStreak = (ritual) => {
  const { current_streak, last_completed_date } = ritual;
  
  const today = new Date().toDateString();
  const lastDate = last_completed_date ? new Date(last_completed_date).toDateString() : null;

  // 1. If already done today, keep the current streak
  if (lastDate === today) {
    return current_streak || 0;
  }

  // 2. Increment streak by 1
  return (current_streak || 0) + 1;
};