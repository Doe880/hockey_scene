
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
    controlledId: 0,
  };

  let rink=null, stands=null, goals=null;

  // Вратари стоят напротив друг друга (одинаковая Y), двигаются только по чуть-чуть по створу
  const goalies = {
    left:  { y: 0, baseY: 0, phase: 0.0 },
    right: { y: 0, baseY: 0, phase: 1.2 }
  };

  const players = [
    { id:0, club:clubs.loko,    fracX:0.25, fracY:0.82, phase:0.0, scale:0.84, x:0, y:0, vx:0, vy:0, dir:1, shootKick:0 },
    { id:1, club:clubs.spartak, fracX:0.62, fracY:0.52, phase:1.7, scale:0.80, x:0, y:0, vx:0, vy:0, dir:-1, shootKick:0 }
  ];

  const puck = { active:true, x:0, y:0, vx:0, vy:0, owner:null, ttl:999, trail:[] };

  const touch = {
    active:false,
    id:null,
    startX:0, startY:0,
    x:0, y:0,
    startT:0,
    moved:false,
  };

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
  function getControlled(){ return players.find(p => p.id === state.controlledId) || players[0]; }

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
    const centerY = rink.y + rink.h/2;

    // ВОРОТА НАПРОТИВ ДРУГ ДРУГА: одинаковый Y
    goals = {
      left:  { x: rink.x + goalInset, y: centerY },
      right: { x: rink.x + rink.w - goalInset, y: centerY },
      mouthH: Math.max(70, Math.round(rink.h * 0.14)),
      lineXPad: Math.max(18, Math.round(rink.w * 0.02))
    };

    goalies.left.baseY = centerY;
    goalies.right.baseY = centerY;
    goalies.left.y = centerY;
    goalies.right.y = centerY;

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
      touch.active = false;
      touch.id = null;
    }
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
    puck.owner = players[0];
    puck.trail = [];
    syncPuckToOwner();

    state.controlledId = 0;
    state.t0 = performance.now();
    updateScoreboard(true);
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

    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(200,40,40,.35)";
    ctx.beginPath();
    ctx.moveTo(rink.x + goals.lineXPad, rink.y);
    ctx.lineTo(rink.x + goals.lineXPad, rink.y + rink.h);
    ctx.moveTo(rink.x + rink.w - goals.lineXPad, rink.y);
    ctx.lineTo(rink.x + rink.w - goals.lineXPad, rink.y + rink.h);
    ctx.stroke();
  }

  function drawGoal(cx, cy){
    ctx.save();
    ctx.translate(cx, cy);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 28, 60, 10, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

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

  function updateGoalies(t){
    // лёгкое движение по створу, но базовая точка у обоих ОДИНАКОВА
    const sway = Math.sin(t*1.0) * (goals.mouthH * 0.10);
    goalies.left.y  = goalies.left.baseY  + sway;
    goalies.right.y = goalies.right.baseY - sway;
  }

  function drawGoalie(side){
    const g = (side === "left") ? goalies.left : goalies.right;
    const gx = (side === "left") ? goals.left.x : goals.right.x;

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

    // выбранный игрок
    if (p.id == state.controlledId){
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 70, 62, 16, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

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

    // ноги+коньки
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
    const p = puck.owner;
    const ahead = 54 * p.scale * p.dir;
    const down  = 58 * p.scale;
    puck.x = p.x + ahead;
    puck.y = p.y + down;
    puck.vx = 0; puck.vy = 0;
    puck.ttl = 999;
  }

  function shootToOpponentGoal(player){
    // простой бросок: всегда в центр ворот соперника (чуть рандома по Y)
    const target = (player.club.key === "loko") ? goals.right : goals.left;
    const tx = target.x;
    const ty = target.y + (Math.random()*goals.mouthH - goals.mouthH/2) * 0.35;
    shootPuck(player, tx, ty);
  }

  function shootPuck(fromPlayer, tx, ty){
    if (puck.owner !== fromPlayer) return; // бросать может только владелец
    puck.owner = null;
    puck.active = true;
    puck.trail = [];

    const ahead = 54 * fromPlayer.scale * fromPlayer.dir;
    const down  = 58 * fromPlayer.scale;
    puck.x = fromPlayer.x + ahead;
    puck.y = fromPlayer.y + down;

    const speed = 980;
    const dx = tx - puck.x, dy = ty - puck.y;
    const len = Math.max(1, Math.hypot(dx, dy));
    puck.vx = dx/len * speed;
    puck.vy = dy/len * speed;
    puck.ttl = 1.6;

    fromPlayer.shootKick = 0.45;
  }

  function checkGoalOrSave(){
    const goalLineLeftX  = rink.x + goals.lineXPad;
    const goalLineRightX = rink.x + rink.w - goals.lineXPad;

    const inLeftMouth  = Math.abs(puck.y - goals.left.y)  <= goals.mouthH/2;
    const inRightMouth = Math.abs(puck.y - goals.right.y) <= goals.mouthH/2;

    if (puck.x <= goalLineLeftX){
      const goalieClose = Math.abs(puck.y - goalies.left.y) <= goals.mouthH*0.35;
      if (inLeftMouth && goalieClose){
        flashMessage("СЭЙВ!");
      } else if (inLeftMouth){
        state.score.spartak += 1;
        flashMessage("ГОЛ!");
      } else {
        flashMessage("СЭЙВ!");
      }
      puck.owner = getControlled();
      syncPuckToOwner();
      return true;
    }

    if (puck.x >= goalLineRightX){
      const goalieClose = Math.abs(puck.y - goalies.right.y) <= goals.mouthH*0.35;
      if (inRightMouth && goalieClose){
        flashMessage("СЭЙВ!");
      } else if (inRightMouth){
        state.score.loko += 1;
        flashMessage("ГОЛ!");
      } else {
        flashMessage("СЭЙВ!");
      }
      puck.owner = getControlled();
      syncPuckToOwner();
      return true;
    }
    return false;
  }

  function updateShotPuck(dt){
    if (puck.owner) return;

    puck.ttl -= dt;
    if (puck.ttl <= 0){
      puck.owner = getControlled();
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

  function isInsideRink(x,y){
    return x >= rink.x && x <= rink.x + rink.w && y >= rink.y && y <= rink.y + rink.h;
  }

  function eventToCanvasXY(e, forcedTouch=null){
    const rect = canvas.getBoundingClientRect();
    const t = forcedTouch || (e.changedTouches && e.changedTouches[0]) || e;
    const x = (t.clientX - rect.left) / rect.width * W;
    const y = (t.clientY - rect.top) / rect.height * H;
    return { x, y };
  }

  function playerAt(x,y){
    const pickR = 64;
    for (const p of players){
      if (dist(x,y,p.x,p.y) <= pickR) return p;
    }
    return null;
  }

  // === Управление ===
  // свайп/перетаскивание = движение выбранного игрока
  // одинарный тап по игроку = выбрать игрока
  // одинарный тап по льду = бросок в ворота соперника (если шайба у выбранного)
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const { x, y } = eventToCanvasXY(e, t);
    if (!isInsideRink(x,y)) return;

    touch.active = true;
    touch.id = t.identifier;
    touch.startX = x; touch.startY = y;
    touch.x = x; touch.y = y;
    touch.startT = performance.now();
    touch.moved = false;
  }, { passive:false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!touch.active) return;

    let tmatch = null;
    for (const tt of e.changedTouches){
      if (tt.identifier === touch.id){ tmatch = tt; break; }
    }
    if (!tmatch) return;

    const { x, y } = eventToCanvasXY(e, tmatch);
    touch.x = x; touch.y = y;

    const movedDist = dist(touch.startX, touch.startY, x, y);
    if (movedDist > 28) touch.moved = true;
  }, { passive:false });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (!touch.active) return;

    let tmatch = null;
    for (const tt of e.changedTouches){
      if (tt.identifier === touch.id){ tmatch = tt; break; }
    }
    if (!tmatch) return;

    const { x, y } = eventToCanvasXY(e, tmatch);
    const endT = performance.now();
    const heldMs = endT - touch.startT;

    const controlled = getControlled();

    // ТАП (без движения) = либо выбор игрока, либо бросок
    if (!touch.moved && heldMs < 260){
      const picked = playerAt(x,y);
      if (picked){
        state.controlledId = picked.id;
        // если шайба у выбранного — синхронизируем
        if (puck.owner === picked) syncPuckToOwner();
      } else {
        // один тап по льду = бросок в ворота соперника
        shootToOpponentGoal(controlled);
      }
    }

    touch.active = false;
    touch.id = null;
  }, { passive:false });

  canvas.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    touch.active = false;
    touch.id = null;
  }, { passive:false });

  // === Движение ===
  function updateControlledPlayer(dt){
    const p = getControlled();

    if (!touch.active || !touch.moved){
      p.vx *= Math.max(0, 1 - dt*6);
      p.vy *= Math.max(0, 1 - dt*6);
    } else {
      const tx = clamp(touch.x, rink.x+20, rink.x+rink.w-20);
      const ty = clamp(touch.y, rink.y+20, rink.y+rink.h-20);

      const dx = tx - p.x;
      const dy = ty - p.y;
      const d = Math.max(1, Math.hypot(dx, dy));

      const maxSpeed = 520;
      const desire = clamp(d / 240, 0, 1) * maxSpeed;

      const ux = dx / d;
      const uy = dy / d;

      const targetVx = ux * desire;
      const targetVy = uy * desire;

      const accel = 10.0;
      p.vx += (targetVx - p.vx) * (1 - Math.exp(-accel * dt));
      p.vy += (targetVy - p.vy) * (1 - Math.exp(-accel * dt));
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    p.x = clamp(p.x, rink.x+70, rink.x+rink.w-70);
    p.y = clamp(p.y, rink.y+90, rink.y+rink.h-70);
  }

  function updateAIPlayer(p, dt, t){
    const baseX = (p.club.key === "loko") ? (rink.x + rink.w*0.35) : (rink.x + rink.w*0.65);
    const baseY = (p.club.key === "loko") ? (rink.y + rink.h*0.62) : (rink.y + rink.h*0.42);

    let tx = baseX + Math.sin(t*0.6 + p.phase) * (rink.w*0.16);
    let ty = baseY + Math.cos(t*0.7 + p.phase) * (rink.h*0.10);

    if (puck.active){
      tx = tx*0.65 + puck.x*0.35;
      ty = ty*0.65 + puck.y*0.35;
    }

    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.max(1, Math.hypot(dx, dy));

    const maxSpeed = 240;
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

  function maybePickup(){
    if (puck.owner) return;
    let best = null;
    let bestD = 1e9;
    for (const p of players){
      const d = Math.hypot(p.x - puck.x, p.y - puck.y);
      if (d < bestD){ bestD = d; best = p; }
    }
    if (best && bestD < 70){
      puck.owner = best;
      syncPuckToOwner();
    }
  }

  // === Рендер/логика ===
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

    state.timeLeft -= dt;
    if (state.timeLeft <= 0){
      state.period += 1;
      if (state.period > 3) state.period = 1;
      state.timeLeft = 20*60;
    }

    const t = ((now - state.t0)/1000);

    updateControlledPlayer(dt);
    for (const p of players){
      if (p.id !== state.controlledId){
        updateAIPlayer(p, dt, t);
      }
    }

    updateGoalies(t);

    if (puck.owner){
      syncPuckToOwner();
    } else {
      updateShotPuck(dt);
    }

    maybePickup();

    ctx.clearRect(0,0,W,H);
    drawStands();
    drawIce();

    drawGoal(goals.left.x, goals.left.y);
    drawGoal(goals.right.x, goals.right.y);
    drawGoalie("left");
    drawGoalie("right");

    drawPuckTrail();
    drawPuckNow();

    drawPlayer(players[1], t);
    drawPlayer(players[0], t + 0.25);

    drawCenterMessage();
    updateScoreboard();

    requestAnimationFrame(tick);
  }

  // ассеты
  loadImage("assets/loko.png", img => state.logos.loko = img);
  loadImage("assets/spartak.png", img => state.logos.spartak = img);
  loadImage("assets/face_loko.png", img => state.faces.loko = img);
  loadImage("assets/face_spartak.png", img => state.faces.spartak = img);

  resizeCanvas();
  layout(false);
  reset();
  requestAnimationFrame(tick);
})();
