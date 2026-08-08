import { useState, useEffect } from "react";
import { usePremium } from "../contexts/PremiumContext";
import { useDialog } from "../contexts/DialogContext";
import { FiSliders, FiShield, FiCpu, FiTv, FiAward } from "react-icons/fi";
import { Capacitor } from "@capacitor/core";
import "../styles/modal.css";
import "../styles/premium.css";

// Future-proof plans list (Stripe-ready schema)
const PLANS = [
  {
    id: "annual",
    name: "Annual Plan",
    priceText: "$29.99",
    periodText: "/ year",
    subtext: "$2.49/month billed annually",
    saveText: "SAVE 50%"
  },
  {
    id: "monthly",
    name: "Monthly Plan",
    priceText: "$4.99",
    periodText: "/ month",
    subtext: "Cancel anytime",
    saveText: null
  }
];

export default function PremiumModal({ close, refresh }) {
  const [closing, setClosing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState("annual");
  const [step, setStep] = useState("preview"); // 'preview' or 'success'
  
  const { unlockPremium, restorePurchases } = usePremium();
  const { alert } = useDialog();

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleClose = () => {
    setClosing(true);
    setTimeout(() => {
      close();
    }, 250);
  };

  const handleDeveloperUnlock = async () => {
    setLoading(true);
    try {
      // Simulate unlock delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      // Perform database update
      await unlockPremium();

      setStep("success");
      if (refresh) refresh();
    } catch (err) {
      console.error(err);
      await alert("Failed to unlock Premium. Please check your network.", "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div 
        className={`modal-card ${closing ? "closing" : ""}`} 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "550px", border: "1px solid rgba(255, 107, 0, 0.2)" }}
      >
        {/* Header */}
        <div className="d-flex justify-content-between mb-3 align-items-center">
          <h5 className="mb-0">
            {step === "success" ? "Welcome!" : "StreakFlow Premium"}
          </h5>
          <span style={{ cursor: "pointer", fontSize: "18px" }} onClick={handleClose}>✕</span>
        </div>

        {step === "preview" && (
          <div>
            <div className="text-center mb-3">
              <span className="premium-pill">Premium Features</span>
            </div>
            
            <p className="text-muted small text-center mb-4">
              Explore the ultimate habit tools instantly. Experience custom themes, AI suggestions, and streak protection features.
            </p>

            {/* Features list */}
            <div className="mb-4 px-2">
              <div className="d-flex align-items-start gap-2 mb-3">
                <span className="mt-1"><FiSliders size={18} color="var(--theme-primary)" /></span>
                <div>
                  <strong>Vibe-based Themes:</strong>
                  <span className="text-secondary small d-block">Choose custom branding (Zen, Gym, Study, Healing, Glowup).</span>
                </div>
              </div>
              <div className="d-flex align-items-start gap-2 mb-3">
                <span className="mt-1"><FiShield size={18} color="var(--theme-primary)" /></span>
                <div>
                  <strong>Streak Insurance:</strong>
                  <span className="text-secondary small d-block">Recover from missed days retroactively using shield passes.</span>
                </div>
              </div>
              <div className="d-flex align-items-start gap-2 mb-3">
                <span className="mt-1"><FiCpu size={18} color="var(--theme-primary)" /></span>
                <div>
                  <strong>AI Micro-Coach:</strong>
                  <span className="text-secondary small d-block">Instant, predictive suggestions to support habit alignment.</span>
                </div>
              </div>
              <div className="d-flex align-items-start gap-2 mb-3">
                <span className="mt-1"><FiTv size={18} color="var(--theme-primary)" /></span>
                <div>
                  <strong>Weekly Recap Stories:</strong>
                  <span className="text-secondary small d-block">Beautiful reel-style overview of your check-in momentum.</span>
                </div>
              </div>

            </div>

            {/* Pricing selector */}
            <div className="d-flex flex-column gap-2 mb-4">
              {PLANS.map((plan) => {
                const isSelected = selectedPlanId === plan.id;
                return (
                  <div 
                    key={plan.id}
                    className={`p-3 d-flex justify-content-between align-items-center rounded-3 border ${isSelected ? "border-warning" : "border-secondary"}`}
                    style={{ cursor: "pointer", background: isSelected ? "rgba(245, 158, 11, 0.05)" : "#111" }}
                    onClick={() => setSelectedPlanId(plan.id)}
                  >
                    <div>
                      <div className="d-flex align-items-center gap-2">
                        <strong>{plan.name}</strong>
                        {plan.saveText && (
                          <span className="badge bg-warning text-dark" style={{ fontSize: "9px" }}>{plan.saveText}</span>
                        )}
                      </div>
                      <span className="text-muted small">{plan.subtext}</span>
                    </div>
                    <div className="text-end">
                      <h5 className="mb-0 text-white">{plan.priceText}</h5>
                      <span className="text-muted small">{plan.periodText}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <button 
              className="primary-btn" 
              onClick={handleDeveloperUnlock}
              disabled={loading}
            >
              {Capacitor.isNativePlatform() ? (loading ? "Starting Purchase..." : "Upgrade Premium") : (loading ? "Unlocking Preview..." : "Developer Unlock (Free)")}
            </button>

            {Capacitor.isNativePlatform() && (
              <button 
                className="secondary-btn mt-2" 
                onClick={async () => {
                  setLoading(true);
                  await restorePurchases();
                  setLoading(false);
                }}
                disabled={loading}
              >
                Restore Purchases
              </button>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-4">
            <div className="mb-3 d-flex justify-content-center">
              <FiAward size={60} color="var(--theme-primary)" style={{ animation: "pop 0.5s ease" }} />
            </div>
            <h4 className="mb-2 text-warning">StreakFlow Premium Activated!</h4>
            <p className="text-muted small mb-4">
              The developer preview is now unlocked. We've updated your user subscription and credited 3 Streak Shields to your account.
            </p>
            <div className="p-3 bg-dark rounded-3 border border-secondary mb-4 text-start">
              <div className="small text-secondary">WHAT'S UNLOCKED:</div>
              <div className="fw-bold text-white mt-1 d-flex align-items-center gap-2">
                <FiShield color="var(--theme-primary)" /> +3 Streak Shields (Insurance Passes)
              </div>
              <div className="small text-muted">Use them on any broken habit cards to restore your streak!</div>
            </div>
            <button 
              className="primary-btn" 
              onClick={handleClose}
            >
              Start Customizing
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
