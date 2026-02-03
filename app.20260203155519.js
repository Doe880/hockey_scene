
(() => {
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const speedSlider = document.getElementById("speed");

  const scoreEl = document.getElementById("score");
  const scoreSubEl = document.getElementById("scoreSub");
  const topbarEl = document.getElementById("topbar");

  let W = 1280, H = 720;
  let lastW = 0, lastH = 0;

  function updateViewportVars(){
    const vv = window.visualViewport;
    const vhPx = vv ? vv.height : window.innerHeight;
    const headerH = topbarEl ? Math.round(topbarEl.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--vh", (vhPx * 0.01) + "px");
    document.documentElement.style.setProperty("--header-h", headerH + "px");
  }

  function desiredCanvasCssSize(){
    // берем CSS-ширину как реально отображаемую
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width || window.innerWidth));

    const vv = window.visualViewport;
    const visibleH = vv ? vv.height : window.innerHeight;
    const headerH = topbarEl ? Math.round(topbarEl.getBoundingClientRect().height) : 0;

    // максимально возможная высота под canvas
    const maxH = Math.max(240, Math.round(visibleH - headerH - 26));
    const idealH = Math.round(cssW * 9 / 16);
    const cssH = Math.min(idealH, maxH);

    return { cssW, cssH };
  }

  function resizeCanvas(){
    updateViewportVars();
    const { cssW, cssH } = desiredCanvasCssSize();

    W = cssW; H = cssH;

    const dpr = Math.max(1, Math.min(1.6, window.devicePixelRatio || 1));
    const pxW = Math.round(cssW * dpr);
    const pxH = Math.round(cssH * dpr);

    if (canvas.width !== pxW || canvas.height !== pxH){
      canvas.width = pxW;
      canvas.height = pxH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const changed = (cssW !== lastW) || (cssH !== lastH);
    lastW = cssW; lastH = cssH;
    return changed;
  }

  if (window.visualViewport){
    window.visualViewport.addEventListener("resize", () => { if (resizeCanvas()) layout(true); });
    window.visualViewport.addEventListener("scroll", () => { if (resizeCanvas()) layout(true); });
  }
  window.addEventListener("resize", () => { if (resizeCanvas()) layout(true); });

  function loadImage(url, cb){
    const img = new Image();
    img.onload = () => cb(img);
    img.onerror = () => cb(null);
    img.src = url;
  }

  const clubs = {
    loko:    { key:"loko",    primary:"#c81f2b", secondary:"#1a1a1a" },
    spartak: { key:"spartak", primary:"#f7f7f7", secondary:"#c81f2b" }
  };

  const state = {
    running: true,
    t0: performance.now(),
    speed: 1.0,
    logos: { loko:null, spartak:null },
    faces: { loko:null, spartak:null },
    score: { loko:0, spartak:0 },
    period: 1,
    timeLeft: 20*60
  };

  let rink=null, stands=null, goals=null;

  const goalies = {
    left:  { phase: 0.0, y: 0 },
    right: { phase: 1.2, y: 0 }
  };

  const players = [
    { club:clubs.loko,    fracX:0.22, fracY:0.76, phase:0.0, scale:0.82, vx:190, dir: 1, x:0, baseY:0, shootKick:0 },
    { club:clubs.spartak, fracX:0.60, fracY:0.50, phase:1.7, scale:0.78, vx:180, dir:-1, x:0, baseY:0, shootKick:0 }
  ];

  const puck = { active:false, x:0, y:0, vx:0, vy:0, shooter:null, ttl:0, trail:[] };

  function layout(rescale){
    const old = rink ? { ...rink } : null;

    // ====== МАКСИМАЛЬНЫЙ КАТОК НА МОБИЛЕ ======
    const marginX = Math.max(8, Math.round(W * 0.03));

    // трибуны очень низкие, чтобы каток был огромный
    const standsH = Math.max(48, Math.round(H * 0.10));
    const topY = standsH + 6;

    const bottomPad = 8;
    const rinkH = Math.max(220, Math.round(H - topY - bottomPad));

    rink = {
      x: marginX,
      y: topY,
      w: W - marginX*2,
      h: rinkH,
      r: Math.max(24, Math.round(Math.min(W, H) * 0.07)),
    };

    stands = { x:0, y:0, w:W, h:standsH };

    goals = {
      left:  { x: rink.x + Math.max(52, Math.round(rink.w*0.10)), y: rink.y + rink.h/2 },
      right: { x: rink.x + rink.w - Math.max(52, Math.round(rink.w*0.10)), y: rink.y + rink.h/2 },
      mouth: { w: Math.max(86, Math.round(rink.w * 0.10)), h: Math.max(58, Math.round(rink.h * 0.16)) }
    };

    goalies.left.y = goals.left.y;
    goalies.right.y = goals.right.y;

    if (rescale && old){
      for (const p of players){
        const fx = (p.x - old.x) / Math.max(1, old.w);
        const fy = (p.baseY - old.y) / Math.max(1, old.h);
        p.x = rink.x + fx * rink.w;
        p.baseY = rink.y + fy * rink.h;
      }
      if (puck.active){
        const fx = (puck.x - old.x) / Math.max(1, old.w);
        const fy = (puck.y - old.y) / Math.max(1, old.h);
        puck.x = rink.x + fx * rink.w;
        puck.y = rink.y + fy * rink.h;
        puck.trail = puck.trail.map(pt => ({
          x: rink.x + ((pt.x - old.x)/Math.max(1,old.w))*rink.w,
          y: rink.y + ((pt.y - old.y)/Math.max(1,old.h))*rink.h
        }));
      }
    }
  }

  function reset(){
    for (const p of players){
      p.x = rink.x + rink.w * p.fracX;
      p.baseY = rink.y + rink.h * p.fracY;
      p.shootKick = 0;
    }
    state.score.loko = 0;
    state.score.spartak = 0;
    state.period = 1;
    state.timeLeft = 20*60;
    puck.active = false;
    puck.trail = [];
    state.t0 = performance.now();
    updateScoreboard(true);
  }

  function updateScoreboard(force=false){
    scoreEl.textContent = `${state.score.loko} : ${state.score.spartak}`;
    const mm = Math.floor(state.timeLeft / 60);
    const ss = Math.floor(state.timeLeft % 60);
    scoreSubEl.textContent = `${state.period} период • ${mm}:${String(ss).padStart(2,"0")}`;
    if (force) return;
  }

  function roundedRectPath(x,y,w,h,r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function drawStands(){
    const g = ctx.createLinearGradient(0, 0, 0, stands.h);
    g.addColorStop(0, "#0a0f18");
    g.addColorStop(1, "#0b1928");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, stands.h);

    ctx.save();
    ctx.globalAlpha = 0.55;
    const dots = 260;
    const stepX = 18;
    for (let i=0;i<dots;i++){
      const x = (i*stepX) % W;
      const y = (Math.floor(i*stepX / W) * 10) + 8;
      if (y > stands.h - 10) break;
      const v = (i*37) % 100;
      ctx.fillStyle = v < 33 ? "rgba(240,240,255,.35)" : v < 66 ? "rgba(255,120,120,.25)" : "rgba(120,200,255,.22)";
      ctx.fillRect(x + (v%7), y + (v%3), 2, 2);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.fillRect(0, stands.h - 8, W, 2);
  }

  function drawIce(){
    roundedRectPath(rink.x, rink.y, rink.w, rink.h, rink.r);
    ctx.fillStyle = "#eaf6ff";
    ctx.fill();

    const g = ctx.createLinearGradient(0, rink.y, 0, rink.y + rink.h);
    g.addColorStop(0, "rgba(140,200,255,.14)");
    g.addColorStop(1, "rgba(20,60,110,.10)");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.lineWidth = 6;
    ctx.strokeStyle = "#1d3a56";
    ctx.stroke();

    // линии
    ctx.beginPath();
    ctx.moveTo(rink.x, rink.y + rink.h/2);
    ctx.lineTo(rink.x + rink.w, rink.y + rink.h/2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(200,40,40,.55)";
    ctx.stroke();

    for (const k of [0.33, 0.67]){
      const xx = rink.x + rink.w * k;
      ctx.beginPath();
      ctx.moveTo(xx, rink.y);
      ctx.lineTo(xx, rink.y + rink.h);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(40,120,220,.50)";
      ctx.stroke();
    }
  }

  function drawGoal(cx, cy, scale=0.98){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 28, 60, 10, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // сетка
    ctx.save();
    ctx.strokeStyle = "rgba(120,140,160,.35)";
    ctx.lineWidth = 1;
    for (let x=-44; x<=44; x+=10){
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x-10, 30);
      ctx.stroke();
    }
    for (let y=-10; y<=30; y+=8){
      ctx.beginPath();
      ctx.moveTo(-44, y);
      ctx.lineTo(44, y);
      ctx.stroke();
    }
    ctx.restore();

    // рама
    ctx.strokeStyle = "rgba(220,40,40,.95)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-48, 22);
    ctx.lineTo(-48, -12);
    ctx.lineTo( 48, -12);
    ctx.lineTo( 48, 22);
    ctx.stroke();

    ctx.restore();
  }

  function drawGoalie(side, t){
    const g = (side === "left") ? goalies.left : goalies.right;
    const gx = (side === "left") ? goals.left.x : goals.right.x;
    const gy0 = (side === "left") ? goals.left.y : goals.right.y;

    // лёгкая анимация
    const sway = Math.sin(t*1.0 + g.phase) * 16;
    g.y = gy0 + sway;

    ctx.save();
    ctx.translate(gx, g.y);

    const offsetX = (side === "left") ? 16 : -16;
    ctx.translate(offsetX, 18);

    // тень
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 48, 24, 7, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.globalAlpha = 1;

    // тело
    ctx.fillStyle = "rgba(240,240,245,.92)";
    roundedRectPath(-14, 0, 28, 30, 10);
    ctx.fill();

    // голова
    ctx.fillStyle = "rgba(30,30,40,.92)";
    ctx.beginPath();
    ctx.arc(0, -8, 10, 0, Math.PI*2);
    ctx.fill();

    // щитки
    ctx.fillStyle = "rgba(220,220,235,.95)";
    roundedRectPath(-18, 26, 14, 24, 7);
    ctx.fill();
    roundedRectPath(4, 26, 14, 24, 7);
    ctx.fill();

    // клюшка
    ctx.strokeStyle = "rgba(90,60,25,.92)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-10, 18);
    ctx.lineTo(-22, 44);
    ctx.stroke();
    ctx.strokeStyle = "rgba(30,30,30,.9)";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-22, 44);
    ctx.lineTo(-4, 44);
    ctx.stroke();

    ctx.restore();
  }

  function drawEmblem(cx, cy, r, club){
    const logo = (club.key === "loko") ? state.logos.loko : state.logos.spartak;
    if (!logo) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.clip();
    const iw = logo.width, ih = logo.height;
    const side = Math.min(iw, ih);
    const sx = (iw - side)/2, sy = (ih - side)/2;
    ctx.drawImage(logo, sx, sy, side, side, cx-r, cy-r, r*2, r*2);
    ctx.restore();
  }

  function drawFaceOnHead(faceImg){
    if (!faceImg) return false;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -23, 15, 0, Math.PI*2);
    ctx.clip();
    const iw = faceImg.width, ih = faceImg.height;
    const side = Math.min(iw, ih);
    const sx = (iw - side)/2, sy = (ih - side)/2;
    ctx.drawImage(faceImg, sx, sy, side, side, -15, -38, 30, 30);
    ctx.restore();
    return true;
  }

  function drawLegAndSkate(offsetX, offsetY, rot){
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.rotate(rot);

    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(20,20,20,.92)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 40);
    ctx.stroke();

    ctx.save();
    ctx.translate(0, 40);
    ctx.fillStyle = "rgba(15,15,15,.95)";
    roundedRectPath(-14, -12, 28, 16, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(230,230,230,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.lineTo( 16, 12);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  function drawPlayer(p, t){
    const bob = Math.sin(t*2.2 + p.phase) * 2.0;
    const lean = Math.sin(t*1.4 + p.phase) * 0.06;
    const push = (Math.sin(t*2.8 + p.phase) * 0.5 + 0.5);

    const x = p.x;
    const y = p.baseY + bob;

    const faceImg = (p.club.key === "loko") ? state.faces.loko : state.faces.spartak;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.scale * p.dir, p.scale);
    ctx.rotate(lean);

    // тень
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 70, 52, 13, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    // клюшка
    ctx.save();
    ctx.rotate(-0.30);
    ctx.translate(36, 36);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(90,60,25,.95)";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 78);
    ctx.stroke();
    ctx.lineWidth = 11;
    ctx.strokeStyle = "rgba(30,30,30,.9)";
    ctx.beginPath();
    ctx.moveTo(0, 78);
    ctx.lineTo(42, 78);
    ctx.stroke();
    ctx.restore();

    // корпус
    ctx.save();
    roundedRectPath(-34, -10, 68, 82, 18);
    ctx.fillStyle = p.club.primary;
    ctx.fill();

    if (p.club.key === "spartak"){
      ctx.fillStyle = "rgba(200,31,43,.95)";
      ctx.fillRect(-34, 20, 68, 12);
      ctx.fillRect(-34, 48, 68, 10);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(-34, 62, 68, 7);
    }

    drawEmblem(0, 28, 16, p.club);
    ctx.restore();

    // голова
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -28, 24, 0, Math.PI*2);
    ctx.fillStyle = p.club.secondary;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -23, 15, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,224,189,.95)";
    ctx.fill();

    const used = drawFaceOnHead(faceImg);
    if (!used){
      ctx.fillStyle = "rgba(20,20,20,.7)";
      ctx.beginPath();
      ctx.arc(-5, -25, 1.8, 0, Math.PI*2);
      ctx.arc( 5, -25, 1.8, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // штаны
    ctx.save();
    roundedRectPath(-28, 36, 56, 30, 12);
    ctx.fillStyle = "rgba(20,20,20,.92)";
    ctx.fill();
    ctx.restore();

    // ноги + коньки (катание)
    ctx.save();
    drawLegAndSkate(-12, 54, -0.05);
    const pushX = 12 + (push * 10);
    const pushRot = 0.15 + push * 0.25;
    drawLegAndSkate(pushX, 54, pushRot);
    ctx.restore();

    ctx.restore();
  }

  function maybeMove(dt){
    const leftBound = rink.x + Math.max(72, Math.round(rink.w * 0.12));
    const rightBound = rink.x + rink.w - Math.max(72, Math.round(rink.w * 0.12));
    for (const p of players){
      p.x += p.vx * p.dir * state.speed * dt;
      if (p.x > rightBound){ p.x = rightBound; p.dir = -1; }
      if (p.x < leftBound){ p.x = leftBound; p.dir = 1; }
    }
  }

  function tick(now){
    const dt = 1/60;
    state.speed = Number(speedSlider.value);

    if (resizeCanvas()) layout(true);

    if (state.running){
      state.timeLeft -= dt * state.speed;
      if (state.timeLeft <= 0){
        state.period += 1;
        if (state.period > 3) state.period = 1;
        state.timeLeft = 20*60;
      }
    }

    const t = ((now - state.t0)/1000) * (state.running ? state.speed : 0);

    ctx.clearRect(0,0,W,H);

    drawStands();
    drawIce();

    // ворота + вратари (гарантировано)
    drawGoal(goals.left.x, goals.left.y, 0.98);
    drawGoal(goals.right.x, goals.right.y, 0.98);
    drawGoalie("left", t);
    drawGoalie("right", t);

    if (state.running) maybeMove(dt);

    drawPlayer(players[1], t);
    drawPlayer(players[0], t+0.25);

    updateScoreboard();

    requestAnimationFrame(tick);
  }

  pauseBtn.addEventListener("click", () => {
    state.running = !state.running;
    pauseBtn.textContent = state.running ? "Пауза" : "Продолжить";
  });
  resetBtn.addEventListener("click", () => reset());

  loadImage("assets/loko.png", img => state.logos.loko = img);
  loadImage("assets/spartak.png", img => state.logos.spartak = img);
  loadImage("assets/face_loko.png", img => state.faces.loko = img);
  loadImage("assets/face_spartak.png", img => state.faces.spartak = img);

  resizeCanvas();
  layout(false);
  reset();
  requestAnimationFrame(tick);
})();
