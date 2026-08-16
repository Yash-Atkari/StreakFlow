import { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabaseClient";
import UrgencyCard from "./UrgencyCard";

export default function UrgencyList({ 
  goals = [], 
  refresh, 
  onEdit, 
  onOpenModal 
}) {
  // Sort goals:
  // 1. Incomplete goals first, sorted by deadline (end_time) ascending (closest deadline first)
  // 2. Completed goals next, sorted by completed_at descending (most recently completed first)
  const sorted = [...goals].sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    
    if (!a.completed && !b.completed) {
      return new Date(a.end_time) - new Date(b.end_time);
    } else {
      return new Date(b.completed_at || b.created_at) - new Date(a.completed_at || a.created_at);
    }
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center mt-2 py-4 px-3" style={{ background: "rgba(255,255,255,0.02)", borderRadius: "18px", border: "1px dashed rgba(255,255,255,0.1)" }}>
        <h5 className="text-white mb-2 fw-bold">Zero Urgency Goals</h5>
        <p className="text-secondary small mb-4">
          No urgency sprints defined. Add a time-restricted sprint to stay hyper-focused and get things done!
        </p>
        <button 
          className="primary-btn" 
          style={{ maxWidth: "200px", margin: "0 auto", padding: "10px 20px" }}
          onClick={() => {
            onEdit(null);
            onOpenModal();
          }}
        >
          Create Urgency Goal
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <span className="subheading">Active Timeline Sprints</span>
        <span className="badge rounded-pill bg-dark text-secondary px-3 py-1" style={{ fontSize: "11px" }}>
          {sorted.filter(g => !g.completed).length} remaining
        </span>
      </div>

      {sorted.map((goal) => (
        <UrgencyCard
          key={goal.id}
          goal={goal}
          refresh={refresh}
          onEdit={onEdit}
          openModal={onOpenModal}
        />
      ))}
      <div style={{ height: "120px" }} />
    </div>
  );
}
