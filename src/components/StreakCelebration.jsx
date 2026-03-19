import { useEffect, useState } from "react";
import { HiFire } from "react-icons/hi";
import "../styles/celebration.css";

const messages = [
  "Unstoppable!",
  "Consistency King!",
  "Keep Burning!",
  "You're on a roll!",
  "Level Up!"
];

export default function StreakCelebration({ streak, onClose }) {
  const [msg] = useState(messages[Math.floor(Math.random() * messages.length)]);

  useEffect(() => {
    const timer = setTimeout(onClose, 3000); // Auto-close after 3 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="celebration-overlay">
      <div className="fire-container">
        <HiFire className="giant-fire" />
        <div className="streak-badge">{streak}</div>
      </div>
      <h1 className="motivation-text">{msg}</h1>
      <p className="sub-text">Day Streak Active</p>
    </div>
  );
}
