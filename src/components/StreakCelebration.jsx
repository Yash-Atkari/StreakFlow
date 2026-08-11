import { useEffect, useState } from "react";
import NivoraIcon from "./NivoraIcon";
import "../styles/celebration.css";

const messages = [
  "Unstoppable!",
  "Consistency King!",
  "Keep Rising!",
  "You're on a roll!",
  "Level Up!"
];

export default function StreakCelebration({ streak, onClose }) {
  const [msg] = useState(() => messages[Math.floor(Math.random() * messages.length)]);

  useEffect(() => {
    const timer = setTimeout(onClose, 3000); // Auto-close after 3 seconds
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="celebration-overlay">
      <div className="fire-container">
        <NivoraIcon className="giant-fire" />
        <div className="streak-badge">{streak}</div>
      </div>
      <h1 className="motivation-text">{msg}</h1>
      <p className="sub-text">Day Streak Active</p>
    </div>
  );
}
