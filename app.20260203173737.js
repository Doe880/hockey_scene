
(() => {
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  const scoreEl = document.getElementById("score");
  const scoreSubEl = document.getElementById("scoreSub");
  const scoreboardEl = document.getElementById("scoreboard");
  const topbarEl = document.getElementById("topbar");

  let W = 900, H = 1200;
  let lastW = 0, lastH = 0;

  function isMobile(){ return matchMedia("(max-width: 720px)").matches; }

  function updateViewportVars(){
    const vv = window.visualViewport;
    const vhPx = vv ? vv.height : window.innerHeight;
    const headerH = topbarEl ? Math.round(topbarEl.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--vh", (vhPx * 0.01) + "px");
    document.documentElement.style.setProperty("--header-h", headerH + "px");
  }

  function desiredCanvasCssSize(){
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(320, Math.round(rect.width || window.innerWidth));

    const vv = window.visualViewport;
    const visibleH = vv ? vv.height : window.innerHeight;
    const headerH = topbarEl ? Math.round(topbarEl.getBoundingClientRect().height) : 0;
    const maxH = Math.max(320, Math.round(visibleH - headerH - 26));

    const idealH = isMobile() ? Math.round(cssW * (4/3)) : Math.round(cssW * (9/16));
    const cssH = Math.min(idealH, maxH);
    return { cssW, cssH };
  }

  function resizeCanvas(){
    updateViewportVars();
    const { cssW, cssH } = desiredCanvasCssSize();
    W = cssW; H = cssH;

    const dpr = Math.max(1, Math.min(isMobile() ? 1.5 : 2, window.devicePixelRatio || 1));
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
    window.visualViewport.addEventListener("scroll",  () => { if (resizeCanvas()) layout(true); });
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
    logos: { loko:null, spartak:null },
    faces: { loko:null, spartak:null },
    score: { loko:0, spartak:0 },
    period: 1,
    timeLeft: 20*60,
    flashUntil: 0,
    msg: "",
    msgUntil: 0,
  };

  let rink=null, stands=null, goals=null;

  const goalies = {
    left:  { phase: 0.0, y: 0, baseY: 0 },
    right: { phase: 1.2, y: 0, baseY: 0 }
  };

  // Игрок 0 = управляемый (Локомотив)
  const players = [
    { id:0, club:clubs.loko,    fracX:0.25, fracY:0.82, phase:0.0, scale:0.84,
      x:0, y:0, vx:0, vy:0, dir:1, shootKick:0 },

    // Игрок 1 = соперник (автопилот)
    { id:1, club:clubs.spartak, fracX:0.62, fracY:0.52, phase:1.7, scale:0.80,
      x:0, y:0, vx:0, vy:0, dir:-1, shootKick:0 }
  ];

  // шайба
  const puck = { active:false, x:0, y:0, vx:0, vy:0, owner:null, ttl:0, trail:[] };

  // === Touch control state ===
  const touch = {
    active:false,
    id:null,
    startX:0, startY:0,
    x:0, y:0,
    startT:0,
    moved:false,
    aiming:false,
    aimX:0, aimY:0,
    lastTapT:0
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }

  function layout(rescale){
    const old = rink ? { ...rink } : null;

    const marginX = Math.max(10, Math.round(W * 0.05));
    const standsH = Math.max(36, Math.round(H * 0.08));
    const topY = standsH + 6;
    const bottomPad = 8;
    const rinkH = Math.max(260, Math.round(H - topY - bottomPad));

    rink = {
      x: marginX,
      y: topY,
      w: W - marginX*2,
      h: rinkH,
      r: Math.max(22, Math.round(Math.min(W, H) * 0.06))
    };

    stands = { x:0, y:0, w:W, h:standsH };

    const goalInset = Math.max(46, Math.round(rink.w * 0.10));
    goals = {
      left:  { x: rink.x + goalInset, y: rink.y + rink.h/2 },
      right: { x: rink.x + rink.w - goalInset, y: rink.y + rink.h/2 },
      mouthH: Math.max(70, Math.round(rink.h * 0.14)),
      lineXPad: Math.max(18, Math.round(rink.w * 0.02))
    };

    goalies.left.baseY = goals.left.y;
    goalies.right.baseY = goals.right.y;

    if (rescale && old){
      for (const p of players){
        const fx = (p.x - old.x) / Math.max(1, old.w);
        const fy = (p.y - old.y) / Math.max(1, old.h);
        p.x = rink.x + fx * rink.w;
        p.y = rink.y + fy * rink.h;
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
      if (touch.active){
        // Переводим позицию пальца в новую систему (по canvas-координатам) не нужен:
        // touch хранит уже canvas coords, но при ресайзе лучше не "телепортировать" цель — просто выключим.
        touch.active = false;
        touch.aiming = false;
      }
    }
  }

  function reset(){
    for (const p of players){
      p.x = rink.x + rink.w * p.fracX;
      p.y = rink.y + rink.h * p.fracY;
      p.vx = 0; p.vy = 0;
      p.shootKick = 0;
    }
    state.score.loko = 0;
    state.score.spartak = 0;
    state.period = 1;
    state.timeLeft = 20*60;
    state.msg = ""; state.msgUntil = 0;
    state.flashUntil = 0;

    puck.active = true;
    puck.owner = players[0]; // стартовое владение у игрока
    puck.trail = [];
    syncPuckToOwner();

    state.t0 = performance.now();
    updateScoreboard(true);
  }

  function flashMessage(text){
    state.msg = text;
    state.msgUntil = performance.now() + 850;
    state.flashUntil = performance.now() + 700;
  }

  function updateScoreboard(force=false){
    scoreEl.textContent = `${state.score.loko} : ${state.score.spartak}`;
    const mm = Math.floor(state.timeLeft / 60);
    const ss = Math.floor(state.timeLeft % 60);
    scoreSubEl.textContent = `${state.period} период • ${mm}:${String(ss).padStart(2,"0")}`;

    if (!force){
      if (performance.now() < state.flashUntil) scoreboardEl.style.filter = "brightness(1.25)";
      else scoreboardEl.style.filter = "none";
    }
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
    ctx.fillRect(0,0,W,stands.h);

    ctx.save();
    ctx.globalAlpha = 0.55;
    const dots = 220;
    const stepX = 18;
    for (let i=0;i<dots;i++){
      const x = (i*stepX) % W;
      const y = (Math.floor(i*stepX / W) * 10) + 6;
      if (y > stands.h - 10) break;
      const v = (i*37) % 100;
      ctx.fillStyle = v < 33 ? "rgba(240,240,255,.35)" : v < 66 ? "rgba(255,120,120,.25)" : "rgba(120,200,255,.22)";
      ctx.fillRect(x + (v%7), y + (v%3), 2, 2);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.fillRect(0, stands.h - 7, W, 2);
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

    // центральная
    ctx.beginPath();
    ctx.moveTo(rink.x, rink.y + rink.h/2);
    ctx.lineTo(rink.x + rink.w, rink.y + rink.h/2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(200,40,40,.55)";
    ctx.stroke();

    // синие
    for (const k of [0.33, 0.67]){
      const xx = rink.x + rink.w * k;
      ctx.beginPath();
      ctx.moveTo(xx, rink.y);
      ctx.lineTo(xx, rink.y + rink.h);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(40,120,220,.50)";
      ctx.stroke();
    }

    // гол-линии
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(200,40,40,.35)";
    ctx.beginPath();
    ctx.moveTo(rink.x + goals.lineXPad, rink.y);
    ctx.lineTo(rink.x + goals.lineXPad, rink.y + rink.h);
    ctx.moveTo(rink.x + rink.w - goals.lineXPad, rink.y);
    ctx.lineTo(rink.x + rink.w - goals.lineXPad, rink.y + rink.h);
    ctx.stroke();
  }

  function drawGoal(cx, cy, scale=1.0){
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
      ctx.beginPath(); ctx.moveTo(x, -10); ctx.lineTo(x-10, 30); ctx.stroke();
    }
    for (let y=-10; y<=30; y+=8){
      ctx.beginPath(); ctx.moveTo(-44, y); ctx.lineTo(44, y); ctx.stroke();
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
    const base = (side === "left") ? goalies.left.baseY : goalies.right.baseY;

    // если шайба летит к воротам — чуть "следит" за ней
    let follow = 0;
    if (puck.active && !puck.owner){
      const toLeft = puck.vx < 0;
      const toRight = puck.vx > 0;
      if ((side === "left" && toLeft) || (side === "right" && toRight)){
        follow = clamp((puck.y - base), -goals.mouthH*0.45, goals.mouthH*0.45);
      }
    }
    const sway = Math.sin(t*1.0 + g.phase) * (goals.mouthH * 0.12);
    g.y = base + sway + follow*0.35;

    ctx.save();
    ctx.translate(gx, g.y);

    const offsetX = (side === "left") ? 16 : -16;
    ctx.translate(offsetX, 18);

    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 48, 24, 7, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(240,240,245,.92)";
    roundedRectPath(-14, 0, 28, 30, 10);
    ctx.fill();

    ctx.fillStyle = "rgba(30,30,40,.92)";
    ctx.beginPath();
    ctx.arc(0, -8, 10, 0, Math.PI*2);
    ctx.fill();

    ctx.fillStyle = "rgba(220,220,235,.95)";
    roundedRectPath(-18, 26, 14, 24, 7);
    ctx.fill();
    roundedRectPath(4, 26, 14, 24, 7);
    ctx.fill();

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

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,.22)";
    ctx.stroke();
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

  function drawPlayer(p, t){
    const bob = Math.sin(t*2.2 + p.phase) * 2.0;
    const lean = Math.sin(t*1.4 + p.phase) * 0.06;

    if (p.shootKick > 0) p.shootKick = Math.max(0, p.shootKick - 1/60);
    const kick = p.shootKick;

    // направление по скорости
    if (Math.abs(p.vx) > 5) p.dir = p.vx > 0 ? 1 : -1;

    const x = p.x;
    const y = p.y + bob;

    const faceImg = (p.club.key === "loko") ? state.faces.loko : state.faces.spartak;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.scale * p.dir, p.scale);
    ctx.rotate(lean - kick*0.10);

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
    const stickAngle = -0.30 - kick*0.55;
    ctx.rotate(stickAngle);
    ctx.translate(36, 36 + kick*8);
    ctx.lineWidth = 7;
    ctx.strokeStyle = "rgba(90,60,25,.95)";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 78); ctx.stroke();
    ctx.lineWidth = 11;
    ctx.strokeStyle = "rgba(30,30,30,.9)";
    ctx.beginPath(); ctx.moveTo(0, 78); ctx.lineTo(42, 78); ctx.stroke();
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

    // ноги+коньки — катание
    const push = (Math.sin(t*2.8 + p.phase) * 0.5 + 0.5);
    function leg(offX, offY, rot){
      ctx.save();
      ctx.translate(offX, offY);
      ctx.rotate(rot);
      ctx.lineWidth = 14;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(20,20,20,.92)";
      ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0,40); ctx.stroke();
      ctx.translate(0,40);
      ctx.fillStyle = "rgba(15,15,15,.95)";
      roundedRectPath(-14,-12,28,16,6); ctx.fill();
      ctx.strokeStyle = "rgba(230,230,230,.95)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-16,12); ctx.lineTo(16,12); ctx.stroke();
      ctx.restore();
    }
    leg(-12, 54, -0.05);
    leg(12 + push*10, 54, 0.15 + push*0.25);

    ctx.restore();
  }

  function drawCenterMessage(){
    if (performance.now() > state.msgUntil) return;
    ctx.save();
    ctx.font = `900 34px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 12;
    ctx.fillText(state.msg, W/2, H*0.62);
    ctx.restore();
  }

  function syncPuckToOwner(){
    if (!puck.owner) return;
    // позиция "у клюшки" владельца
    const p = puck.owner;
    const ahead = 54 * p.scale * p.dir;
    const down  = 58 * p.scale;
    puck.x = p.x + ahead;
    puck.y = p.y + down;
    puck.vx = 0; puck.vy = 0;
    puck.ttl = 999;
  }

  function shootPuck(fromPlayer, tx, ty){
    // снять владение
    puck.owner = null;
    puck.active = true;
    puck.trail = [];
    // старт у клюшки
    const ahead = 54 * fromPlayer.scale * fromPlayer.dir;
    const down  = 58 * fromPlayer.scale;
    puck.x = fromPlayer.x + ahead;
    puck.y = fromPlayer.y + down;

    const speed = 980; // фикс, управление зависит от угла
    const dx = tx - puck.x, dy = ty - puck.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    puck.vx = dx/len * speed;
    puck.vy = dy/len * speed;
    puck.ttl = 1.8;
    fromPlayer.shootKick = 0.45;
  }

  function registerGoal(teamKey){
    state.score[teamKey] += 1;
    flashMessage("ГОЛ!");
    puck.active = true;
    puck.owner = players[0];
    syncPuckToOwner();
    updateScoreboard();
  }

  function registerSave(){
    flashMessage("СЭЙВ!");
    // после сейва — возвращаем владение управляемому (пока так, потом сделаем борьбу)
    puck.active = true;
    puck.owner = players[0];
    syncPuckToOwner();
  }

  function updatePuck(dt){
    if (!puck.active) return;

    if (puck.owner){
      syncPuckToOwner();
      return;
    }

    puck.ttl -= dt;
    if (puck.ttl <= 0){
      // если истекло — считаем что шайба "подобрана" ближайшим
      puck.owner = players[0];
      syncPuckToOwner();
      return;
    }

    // trail
    const TRAIL_MAX = 12;
    puck.trail.push({x:puck.x, y:puck.y});
    if (puck.trail.length > TRAIL_MAX) puck.trail.shift();

    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;

    // drag
    const drag = Math.max(0.0, 1.0 - dt*0.18);
    puck.vx *= drag;
    puck.vy *= drag;

    // bounds Y
    const top = rink.y + 18;
    const bottom = rink.y + rink.h - 18;
    if (puck.y < top){ puck.y = top; puck.vy = Math.abs(puck.vy) * 0.85; }
    if (puck.y > bottom){ puck.y = bottom; puck.vy = -Math.abs(puck.vy) * 0.85; }

    const goalLineLeftX  = rink.x + goals.lineXPad;
    const goalLineRightX = rink.x + rink.w - goals.lineXPad;

    if (puck.x <= goalLineLeftX){
      const inMouth = Math.abs(puck.y - goals.left.y) <= goals.mouthH/2;
      const goalieClose = Math.abs(puck.y - goalies.left.y) <= goals.mouthH*0.35;
      if (inMouth && goalieClose) registerSave();
      else if (inMouth) registerGoal("loko"); // кто забил? определяем по направлению: если летит влево — это атака справа
      else registerSave();
      return;
    }
    if (puck.x >= goalLineRightX){
      const inMouth = Math.abs(puck.y - goals.right.y) <= goals.mouthH/2;
      const goalieClose = Math.abs(puck.y - goalies.right.y) <= goals.mouthH*0.35;
      if (inMouth && goalieClose) registerSave();
      else if (inMouth) registerGoal("spartak"); // летит вправо — атака слева
      else registerSave();
      return;
    }
  }

  function drawPuck(){
    if (!puck.active) return;

    if (!puck.owner){
      ctx.save();
      for (let i=0;i<puck.trail.length;i++){
        const a = i / puck.trail.length;
        ctx.globalAlpha = 0.05 + a*0.14;
        ctx.beginPath();
        ctx.arc(puck.trail[i].x, puck.trail[i].y, 3.5 + a*2.2, 0, Math.PI*2);
        ctx.fillStyle = "rgba(20,20,30,1)";
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, 7.0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(15,15,20,1)";
    ctx.fill();
    ctx.restore();
  }

  function drawAimOverlay(){
    if (!touch.active || !touch.aiming) return;
    const p = players[0];
    // линия прицела
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(255,255,255,.85)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(touch.aimX, touch.aimY);
    ctx.stroke();

    // точка
    ctx.globalAlpha = 0.95;
    ctx.beginPath();
    ctx.arc(touch.aimX, touch.aimY, 10, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.fill();

    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(touch.aimX, touch.aimY, 16, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(255,255,255,.35)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.restore();
  }

  // === Input helpers ===
  function eventToCanvasXY(e){
    const rect = canvas.getBoundingClientRect();
    const t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
    const x = (t.clientX - rect.left) / rect.width * W;
    const y = (t.clientY - rect.top) / rect.height * H;
    return { x, y };
  }

  function isInsideRink(x,y){
    return x >= rink.x && x <= rink.x + rink.w && y >= rink.y && y <= rink.y + rink.h;
  }

  // Touch events (mobile)
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (!e.changedTouches || e.changedTouches.length === 0) return;

    const t = e.changedTouches[0];
    const { x, y } = eventToCanvasXY(e);

    // только если палец по льду — иначе игнор
    if (!isInsideRink(x,y)) return;

    touch.active = true;
    touch.id = t.identifier;
    touch.startX = x; touch.startY = y;
    touch.x = x; touch.y = y;
    touch.startT = performance.now();
    touch.moved = false;
    touch.aiming = false;
    touch.aimX = x; touch.aimY = y;
  }, { passive:false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!touch.active) return;

    // найти наш touch
    let tmatch = null;
    for (const tt of e.changedTouches){
      if (tt.identifier === touch.id){ tmatch = tt; break; }
    }
    if (!tmatch) return;

    const rect = canvas.getBoundingClientRect();
    const x = (tmatch.clientX - rect.left) / rect.width * W;
    const y = (tmatch.clientY - rect.top) / rect.height * H;

    touch.x = x; touch.y = y;

    const movedDist = dist(touch.startX, touch.startY, x, y);
    if (movedDist > 10) touch.moved = true;

    const heldMs = performance.now() - touch.startT;
    if (heldMs > 180){
      touch.aiming = true;
      touch.aimX = clamp(x, rink.x+8, rink.x+rink.w-8);
      touch.aimY = clamp(y, rink.y+8, rink.y+rink.h-8);
    }
  }, { passive:false });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!touch.active) return;

    let tmatch = null;
    for (const tt of e.changedTouches){
      if (tt.identifier === touch.id){ tmatch = tt; break; }
    }
    if (!tmatch) return;

    const endT = performance.now();
    const heldMs = endT - touch.startT;

    const controlled = players[0];

    // если был прицел — бросок по прицелу
    if (touch.aiming){
      shootPuck(controlled, touch.aimX, touch.aimY);
    } else {
      // короткий тап = пас/бросок
      if (!touch.moved && heldMs < 180){
        // если второй игрок достаточно близко — пас ему, иначе бросок в ворота
        const other = players[1];
        const d = dist(controlled.x, controlled.y, other.x, other.y);
        if (d < 220){
          shootPuck(controlled, other.x, other.y);
        } else {
          // бросок по центру ворот соперника
          const target = goals.right; // Локомотив атакует вправо по умолчанию
          shootPuck(controlled, target.x, target.y + (Math.random()*goals.mouthH - goals.mouthH/2)*0.4);
        }
      }
    }

    touch.active = false;
    touch.aiming = false;
    touch.id = null;
  }, { passive:false });

  canvas.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    touch.active = false;
    touch.aiming = false;
    touch.id = null;
  }, { passive:false });

  // === Movement update ===
  function updateControlledPlayer(dt){
    const p = players[0];

    if (!touch.active){
      // мягкое торможение
      p.vx *= Math.max(0, 1 - dt*6);
      p.vy *= Math.max(0, 1 - dt*6);
    } else {
      // "свайп = направление/ускорение": едем к пальцу
      const tx = clamp(touch.x, rink.x+20, rink.x+rink.w-20);
      const ty = clamp(touch.y, rink.y+20, rink.y+rink.h-20);

      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.max(1, Math.hypot(dx, dy));

      // чем дальше палец — тем больше желаемая скорость
      const maxSpeed = 520; // px/sec
      const desire = clamp(d / 240, 0, 1) * maxSpeed;

      const ux = dx / d;
      const uy = dy / d;

      const targetVx = ux * desire;
      const targetVy = uy * desire;

      // "ускорение" = сглаживание
      const accel = 10.0;
      p.vx += (targetVx - p.vx) * (1 - Math.exp(-accel * dt));
      p.vy += (targetVy - p.vy) * (1 - Math.exp(-accel * dt));
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // границы катка
    p.x = clamp(p.x, rink.x+70, rink.x+rink.w-70);
    p.y = clamp(p.y, rink.y+90, rink.y+rink.h-70);
  }

  function updateOpponent(dt, t){
    const p = players[1];
    // простой AI: патруль и иногда смещается к шайбе
    const baseX = rink.x + rink.w*0.65;
    const baseY = rink.y + rink.h*0.45;

    let tx = baseX + Math.sin(t*0.6) * (rink.w*0.18);
    let ty = baseY + Math.cos(t*0.7) * (rink.h*0.12);

    // если шайба летит/есть — немного "поджимает"
    if (puck.active){
      tx = tx*0.6 + puck.x*0.4;
      ty = ty*0.6 + puck.y*0.4;
    }

    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.max(1, Math.hypot(dx, dy));

    const maxSpeed = 280;
    const desire = clamp(d/260, 0, 1) * maxSpeed;
    const ux = dx/d, uy = dy/d;

    const accel = 5.0;
    p.vx += (ux*desire - p.vx) * (1 - Math.exp(-accel * dt));
    p.vy += (uy*desire - p.vy) * (1 - Math.exp(-accel * dt));

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.x = clamp(p.x, rink.x+70, rink.x+rink.w-70);
    p.y = clamp(p.y, rink.y+90, rink.y+rink.h-70);
  }

  function updateGoalies(t){
    // вратари двигаются по створу и слегка следят
    const followL = (!puck.owner && puck.vx < 0) ? clamp((puck.y - goals.left.y), -goals.mouthH*0.45, goals.mouthH*0.45) : 0;
    const followR = (!puck.owner && puck.vx > 0) ? clamp((puck.y - goals.right.y), -goals.mouthH*0.45, goals.mouthH*0.45) : 0;

    goalies.left.y  = goalies.left.baseY  + Math.sin(t*1.0 + goalies.left.phase)  * (goals.mouthH*0.12) + followL*0.35;
    goalies.right.y = goalies.right.baseY + Math.sin(t*1.0 + goalies.right.phase) * (goals.mouthH*0.12) + followR*0.35;
  }

  function checkGoalOrSave(){
    const goalLineLeftX  = rink.x + goals.lineXPad;
    const goalLineRightX = rink.x + rink.w - goals.lineXPad;

    if (puck.x <= goalLineLeftX){
      const inMouth = Math.abs(puck.y - goals.left.y) <= goals.mouthH/2;
      const goalieClose = Math.abs(puck.y - goalies.left.y) <= goals.mouthH*0.35;
      if (inMouth && goalieClose) { flashMessage("СЭЙВ!"); puck.owner = players[0]; syncPuckToOwner(); return true; }
      if (inMouth) { state.score.spartak += 1; flashMessage("ГОЛ!"); puck.owner = players[0]; syncPuckToOwner(); return true; }
      flashMessage("СЭЙВ!"); puck.owner = players[0]; syncPuckToOwner(); return true;
    }
    if (puck.x >= goalLineRightX){
      const inMouth = Math.abs(puck.y - goals.right.y) <= goals.mouthH/2;
      const goalieClose = Math.abs(puck.y - goalies.right.y) <= goals.mouthH*0.35;
      if (inMouth && goalieClose) { flashMessage("СЭЙВ!"); puck.owner = players[0]; syncPuckToOwner(); return true; }
      if (inMouth) { state.score.loko += 1; flashMessage("ГОЛ!"); puck.owner = players[0]; syncPuckToOwner(); return true; }
      flashMessage("СЭЙВ!"); puck.owner = players[0]; syncPuckToOwner(); return true;
    }
    return false;
  }

  function updateShotPuck(dt){
    if (puck.owner) return;

    puck.ttl -= dt;
    if (puck.ttl <= 0){
      puck.owner = players[0];
      syncPuckToOwner();
      return;
    }

    const TRAIL_MAX = 12;
    puck.trail.push({x:puck.x, y:puck.y});
    if (puck.trail.length > TRAIL_MAX) puck.trail.shift();

    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;

    const drag = Math.max(0.0, 1.0 - dt*0.18);
    puck.vx *= drag;
    puck.vy *= drag;

    const top = rink.y + 18;
    const bottom = rink.y + rink.h - 18;
    if (puck.y < top){ puck.y = top; puck.vy = Math.abs(puck.vy) * 0.85; }
    if (puck.y > bottom){ puck.y = bottom; puck.vy = -Math.abs(puck.vy) * 0.85; }

    checkGoalOrSave();
  }

  function drawPuckTrail(){
    if (puck.owner) return;
    ctx.save();
    for (let i=0;i<puck.trail.length;i++){
      const a = i / puck.trail.length;
      ctx.globalAlpha = 0.05 + a*0.14;
      ctx.beginPath();
      ctx.arc(puck.trail[i].x, puck.trail[i].y, 3.5 + a*2.2, 0, Math.PI*2);
      ctx.fillStyle = "rgba(20,20,30,1)";
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPuckNow(){
    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, 7.0, 0, Math.PI*2);
    ctx.fillStyle = "rgba(15,15,20,1)";
    ctx.fill();
    ctx.restore();
  }

  function drawVignette(){
    ctx.save();
    const g1 = ctx.createLinearGradient(0, 0, 0, H);
    g1.addColorStop(0, "rgba(0,0,0,.50)");
    g1.addColorStop(0.25, "rgba(0,0,0,.0)");
    g1.addColorStop(0.75, "rgba(0,0,0,.0)");
    g1.addColorStop(1, "rgba(0,0,0,.40)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawCenterMessage(){
    if (performance.now() > state.msgUntil) return;
    ctx.save();
    ctx.font = `900 34px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 12;
    ctx.fillText(state.msg, W/2, H*0.62);
    ctx.restore();
  }

  let lastNow = performance.now();

  function tick(now){
    const dt = Math.min(0.05, (now - lastNow)/1000);
    lastNow = now;

    if (resizeCanvas()) layout(true);

    if (state.running){
      state.timeLeft -= dt;
      if (state.timeLeft <= 0){
        state.period += 1;
        if (state.period > 3) state.period = 1;
        state.timeLeft = 20*60;
      }
    }

    const t = ((now - state.t0)/1000);

    // логика
    if (state.running){
      updateControlledPlayer(dt);
      updateOpponent(dt, t);
      updateGoalies(t);

      if (puck.owner){
        syncPuckToOwner();
      } else {
        updateShotPuck(dt);
      }

      // подбор шайбы (если свободна и рядом игрок)
      if (!puck.owner){
        const p0 = players[0], p1 = players[1];
        const d0 = Math.hypot(p0.x - puck.x, p0.y - puck.y);
        const d1 = Math.hypot(p1.x - puck.x, p1.y - puck.y);
        if (Math.min(d0, d1) < 70){
          puck.owner = (d0 < d1) ? p0 : p1;
          syncPuckToOwner();
        }
      }

      // если шайбой владеет соперник — он иногда бросает
      if (puck.owner === players[1] && Math.random() < dt*0.35){
        const target = goals.left;
        shootPuck(players[1], target.x, target.y + (Math.random()*goals.mouthH - goals.mouthH/2)*0.35);
      }
    }

    // отрисовка
    ctx.clearRect(0,0,W,H);
    drawStands();
    drawIce();

    drawGoal(goals.left.x, goals.left.y, 1.0);
    drawGoal(goals.right.x, goals.right.y, 1.0);

    drawGoalie("left", t);
    drawGoalie("right", t);

    drawPuckTrail();
    drawPuckNow();

    // игроки (дальний->ближний)
    drawPlayer(players[1], t);
    drawPlayer(players[0], t + 0.25);

    drawAimOverlay();
    drawCenterMessage();
    drawVignette();

    updateScoreboard();
    requestAnimationFrame(tick);
  }

  // Mouse fallback (на случай теста на ПК)
  let mouseDown = false;
  canvas.addEventListener("mousedown", (e) => {
    mouseDown = true;
    const {x,y} = eventToCanvasXY(e);
    touch.active = true;
    touch.startX = touch.x = x; touch.startY = touch.y = y;
    touch.startT = performance.now();
    touch.moved = false; touch.aiming = false;
  });
  window.addEventListener("mousemove", (e) => {
    if (!mouseDown) return;
    const {x,y} = eventToCanvasXY(e);
    touch.x = x; touch.y = y;
    if (dist(touch.startX,touch.startY,x,y) > 10) touch.moved = true;
    if (performance.now() - touch.startT > 180){
      touch.aiming = true;
      touch.aimX = clamp(x, rink.x+8, rink.x+rink.w-8);
      touch.aimY = clamp(y, rink.y+8, rink.y+rink.h-8);
    }
  });
  window.addEventListener("mouseup", (e) => {
    if (!mouseDown) return;
    mouseDown = false;
    const p = players[0];
    if (touch.aiming){
      shootPuck(p, touch.aimX, touch.aimY);
    } else if (!touch.moved){
      const other = players[1];
      const d = Math.hypot(p.x-other.x, p.y-other.y);
      if (d < 220) shootPuck(p, other.x, other.y);
      else shootPuck(p, goals.right.x, goals.right.y);
    }
    touch.active = false; touch.aiming = false;
  });

  // ассеты
  loadImage("assets/loko.png", img => state.logos.loko = img);
  loadImage("assets/spartak.png", img => state.logos.spartak = img);
  loadImage("assets/face_loko.png", img => state.faces.loko = img);
  loadImage("assets/face_spartak.png", img => state.faces.spartak = img);

  // старт
  resizeCanvas();
  layout(false);
  reset();
  requestAnimationFrame(tick);
})();
