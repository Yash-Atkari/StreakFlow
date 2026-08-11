import { InAppReview } from "@capacitor-community/in-app-review";
import { Capacitor } from "@capacitor/core";

export const triggerInAppReview = async (force = false) => {
  if (!Capacitor.isNativePlatform()) {
    console.log("App Review: Skipping review prompt on web/desktop platform.");
    return false;
  }

  try {
    // 1. Retrieve how many times habits have been completed
    const launchCountKey = "nivora_app_launches";
    const launchCount = parseInt(localStorage.getItem(launchCountKey) || "0", 10);
    
    // Only prompt if they have opened the app at least 3 times, OR we force prompt it (e.g., on key streak milestones)
    if (!force && launchCount < 3) {
      console.log(`App Review: Launch count (${launchCount}) is less than 3. Delaying review prompt.`);
      return false;
    }

    // 2. Check last prompted date to prevent spamming
    const lastPromptKey = "nivora_last_review_prompt";
    const lastPrompt = localStorage.getItem(lastPromptKey);
    if (lastPrompt && !force) {
      const lastPromptDate = new Date(lastPrompt);
      const diffTime = Math.abs(new Date() - lastPromptDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      // Do not prompt more than once every 60 days
      if (diffDays < 60) {
        console.log(`App Review: Already prompted ${diffDays} days ago. Delaying review prompt.`);
        return false;
      }
    }

    console.log("App Review: Triggering Google/Apple In-App Review prompt.");
    await InAppReview.requestReview();
    
    // Save last prompted date
    localStorage.setItem(lastPromptKey, new Date().toISOString());
    return true;
  } catch (error) {
    console.error("App Review: Failed to trigger in-app review", error);
    return false;
  }
};

// Increment launch count on start
export const incrementLaunchCount = () => {
  try {
    const launchCountKey = "nivora_app_launches";
    const currentCount = parseInt(localStorage.getItem(launchCountKey) || "0", 10);
    localStorage.setItem(launchCountKey, String(currentCount + 1));
  } catch (e) {
    console.error("App Review: Failed to increment launch count", e);
  }
};
