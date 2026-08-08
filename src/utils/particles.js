// src/utils/particles.js

/**
 * Spawns a premium Canvas-based particle explosion from the specified coordinate.
 * Supports circles, glowing fire shapes, stars, physics, gravity, and drag.
 * Automatically cleans up its DOM canvas element once finished.
 */
export function triggerParticleBurst(x, y, color = "#ff6c00") {
  // Create fullscreen canvas overlay
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "999999";
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  
  // Set scaling based on device pixel ratio for crystal clear graphics
  const dpr = window.devicePixelRatio || 1;
  let width = window.innerWidth;
  let height = window.innerHeight;
  
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const particles = [];
  const particleCount = 35 + Math.floor(Math.random() * 15);

  // Parse color to rgb if it's hex to apply smooth alpha gradients
  let rgbColor = "255, 108, 0";
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      rgbColor = `${r}, ${g}, ${b}`;
    }
  }

  // Create particles
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Velocity magnitude
    const speed = 1.5 + Math.random() * 5.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      // Slight upward bias for explosive feel
      vy: Math.sin(angle) * speed - (1.0 + Math.random() * 2.0),
      radius: 1.5 + Math.random() * 3.5,
      alpha: 1.0,
      decay: 0.012 + Math.random() * 0.018,
      color: rgbColor,
      shape: Math.random() > 0.4 ? "circle" : "star",
      spin: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 0.1
    });
  }

  function drawStar(context, cx, cy, spikes, outerRadius, innerRadius, fillStyle, alpha, spin) {
    let rot = (Math.PI / 2) * 3 + spin;
    let sx = cx;
    let sy = cy;
    const step = Math.PI / spikes;

    context.save();
    context.globalAlpha = alpha;
    context.beginPath();
    context.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      sx = cx + Math.cos(rot) * outerRadius;
      sy = cy + Math.sin(rot) * outerRadius;
      context.lineTo(sx, sy);
      rot += step;

      sx = cx + Math.cos(rot) * innerRadius;
      sy = cy + Math.sin(rot) * innerRadius;
      context.lineTo(sx, sy);
      rot += step;
    }
    
    context.lineTo(cx, cy - outerRadius);
    context.closePath();
    context.fillStyle = fillStyle;
    context.shadowBlur = 8;
    context.shadowColor = fillStyle;
    context.fill();
    context.restore();
  }

  let animationFrameId;

  function updateAndRender() {
    ctx.clearRect(0, 0, width, height);

    let active = false;

    particles.forEach(p => {
      if (p.alpha > 0) {
        active = true;
        
        // Physics update
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // Gravity pull downwards
        p.vx *= 0.97; // Drag/friction coeff
        p.alpha -= p.decay;
        p.spin += p.spinSpeed;

        if (p.alpha <= 0) return;

        const currentStyle = `rgba(${p.color}, ${p.alpha})`;

        if (p.shape === "star") {
          drawStar(ctx, p.x, p.y, 5, p.radius * 2, p.radius, currentStyle, p.alpha, p.spin);
        } else {
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = currentStyle;
          ctx.shadowBlur = 10;
          ctx.shadowColor = currentStyle;
          ctx.fill();
          ctx.restore();
        }
      }
    });

    if (active) {
      animationFrameId = requestAnimationFrame(updateAndRender);
    } else {
      canvas.remove();
    }
  }

  // Trigger animation loop
  animationFrameId = requestAnimationFrame(updateAndRender);

  // Resize handler wrapper
  const handleResize = () => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
  };
  
  window.addEventListener("resize", handleResize);
  
  // Cleanup hook if browser garbage collection occurs early
  return () => {
    cancelAnimationFrame(animationFrameId);
    window.removeEventListener("resize", handleResize);
    canvas.remove();
  };
}

/**
 * Spawns a full screen shower of shimmering golden stars.
 * Perfect for celebration screen overlays.
 */
export function triggerStreakCelebrationShower(color = "#f59e0b") {
  const canvas = document.createElement("canvas");
  canvas.style.position = "fixed";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100vw";
  canvas.style.height = "100vh";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "9998"; // Just behind the celebration text
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  let width = window.innerWidth;
  let height = window.innerHeight;
  
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const particles = [];
  const particleCount = 60;

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * -100, // Spawn above screen
      vx: (Math.random() - 0.5) * 2,
      vy: 1.5 + Math.random() * 3,
      radius: 1 + Math.random() * 3,
      alpha: 0.8 + Math.random() * 0.2,
      decay: 0.005 + Math.random() * 0.008,
      color: color,
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.05
    });
  }

  function drawShimmerStar(context, cx, cy, spikes, outerRadius, innerRadius, colorVal, alpha, spin) {
    let rot = (Math.PI / 2) * 3 + spin;
    let sx = cx;
    let sy = cy;
    const step = Math.PI / spikes;

    context.save();
    context.globalAlpha = alpha;
    context.beginPath();
    context.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
      sx = cx + Math.cos(rot) * outerRadius;
      sy = cy + Math.sin(rot) * outerRadius;
      context.lineTo(sx, sy);
      rot += step;

      sx = cx + Math.cos(rot) * innerRadius;
      sy = cy + Math.sin(rot) * innerRadius;
      context.lineTo(sx, sy);
      rot += step;
    }
    
    context.lineTo(cx, cy - outerRadius);
    context.closePath();
    context.fillStyle = colorVal;
    context.shadowBlur = 6;
    context.shadowColor = colorVal;
    context.fill();
    context.restore();
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    let active = false;

    particles.forEach(p => {
      if (p.y < height && p.alpha > 0) {
        active = true;
        
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        p.spin += p.spinSpeed;

        if (p.alpha <= 0) return;

        drawShimmerStar(ctx, p.x, p.y, 4, p.radius * 2, p.radius, p.color, p.alpha, p.spin);
      }
    });

    if (active) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(animate);
}
