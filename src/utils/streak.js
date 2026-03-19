// Streak.js

const isRequiredDay = (date, ritual) => {
  const dayIndex = date.getDay(); // 0 (Sun) to 6 (Sat)
  
  if (ritual.repeat_type === "daily") return true;
  
  if (ritual.repeat_type === "custom") {
    // Check if the day of the week is in the user's custom_days array
    return ritual.custom_days.includes(dayIndex);
  }

  // Add logic for weekly/biweekly if you use them specifically
  return false; 
};

export const calculateStreak = (ritual) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!ritual.last_completed_date) {
    return { streak: 1, last_completed_date: today.toISOString() };
  }

  const last = new Date(ritual.last_completed_date);
  last.setHours(0, 0, 0, 0);

  // 1. Check if they already finished it today
  if (today.getTime() === last.getTime()) {
    return { streak: ritual.current_streak, last_completed_date: ritual.last_completed_date };
  }

  // 2. Check for missed "Required" days in the gap
  let missedRequiredDay = false;
  let tempDate = new Date(last);
  tempDate.setDate(tempDate.getDate() + 1); // Start checking from the day AFTER last completion

  // Loop through every day from 'last + 1' until 'yesterday'
  while (tempDate < today) {
    if (isRequiredDay(tempDate, ritual)) {
      missedRequiredDay = true;
      break; 
    }
    tempDate.setDate(tempDate.getDate() + 1);
  }

  // 3. Determine new streak
  let newStreak;
  if (missedRequiredDay) {
    newStreak = 1; // Start fresh because they missed a scheduled day
  } else {
    newStreak = (ritual.current_streak || 0) + 1; // Consecutive scheduled day
  }

  return { streak: newStreak, last_completed_date: today.toISOString() };
};
