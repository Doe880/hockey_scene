
(() => {
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const speedSlider = document.getElementById("speed");

  const scoreEl = document.getElementById("score");
  const scoreSubEl = document.getElementById("scoreSub");
  const scoreboardEl = document.getElementById("scoreboard");

  // Видимые (CSS) размеры сцены
  let W = 1280;
  let H = 720;

  function isMobileNow(){
    return matchMedia("(max-width: 720px)").matches;
  }

  // HiDPI + resize
  function resizeCanvasToDisplaySize(){
    const rect = canvas.getBoundingClientRect();

    // реальный CSS размер
    const displayW = Math.max(320, Math.round(rect.width));
    const displayH = Math.max(240, Math.round(rect.height || (rect.width * 9/16)));

    // DPR ограничим до 2 (иначе на некоторых телефонах будет тяжело)
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    const newW = Math.round(displayW * dpr);
    const newH = Math.round(displayH * dpr);

    if (canvas.width !== newW || canvas.height !== newH){
      canvas.width = newW;
      canvas.height = newH;
    }

    // рисуем в координатах CSS, а не "сырых" пикселях
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    W = displayW;
    H = displayH;
  }

  window.addEventListener("resize", () => {
    resizeCanvasToDisplaySize();
    layout();
  });

  function loadImage(url, cb) {
    const img = new Image();
    img.onload = () => cb(img);
    img.onerror = () => cb(null);
    img.src = url;
  }

  const clubs = {
    loko: { key: "loko", name: "ЛОКОМОТИВ ЯРОСЛАВЛЬ", short: "ЛЯ", primary: "#c81f2b", secondary: "#1a1a1a" },
    spartak: { key: "spartak", name: "СПАРТАК ПЯТИГОРСК", short: "СП", primary: "#f7f7f7", secondary: "#c81f2b" }
  };

  const state = {
    running: true,
    t0: performance.now(),
    speed: 1.0,
    logos: { loko: null, spartak: null },
    faces: { loko: null, spartak: null },

    score: { loko: 0, spartak: 0 },
    period: 1,
    timeLeft: 20 * 60,

    lastShotAt: 0,
    nextShotIn: 2.2,

    flashUntil: 0,
    msg: "",
    msgUntil: 0
  };

  // Layout-dependent
  let rink = null;
  let stands = null;
  let goals = null;
  const goalies = {
    left:  { side: "left",  phase: 0.0, skill: 0.52, y: 0 },
    right: { side: "right", phase: 1.2, skill: 0.52, y: 0 }
  };

  // Игроки хранят позиции как доли (чтобы корректно пересчитывать на мобиле)
  const players = [
    {
      club: clubs.loko,
      fracX: 0.22,
      fracY: 0.68,
      phase: 0.0,
      scaleDesktop: 1.35,
      scaleMobile: 1.18,
      vxDesktop: 250,
      vxMobile: 210,
      dir: 1,
      shootKick: 0,
      x: 0,
      baseY: 0,
      scale: 1.3,
      vx: 240
    },
    {
      club: clubs.spartak,
      fracX: 0.55,
      fracY: 0.40,
      phase: 1.7,
      scaleDesktop: 1.25,
      scaleMobile: 1.10,
      vxDesktop: 230,
      vxMobile: 200,
      dir: -1,
      shootKick: 0,
      x: 0,
      baseY: 0,
      scale: 1.2,
      vx: 220
    }
  ];

  const puck = { active: false, x: 0, y: 0, vx: 0, vy: 0, shooter: null, ttl: 0, trail: [] };

  function layout(){
    // адаптивные отступы и размеры
    const marginX = Math.max(18, Math.round(W * 0.06));
    const topY = Math.max(isMobileNow() ? 120 : 160, Math.round(H * (isMobileNow() ? 0.22 : 0.26)));
    const rinkH = Math.min(Math.round(H * (isMobileNow() ? 0.62 : 0.60)), isMobileNow() ? 420 : 460);

    rink = {
      x: marginX,
      y: topY,
      w: W - marginX*2,
      h: rinkH,
      r: Math.max(40, Math.round(Math.min(W, H) * 0.08)),
    };

    stands = { x: 0, y: 0, w: W, h: Math.max(140, Math.round(topY * 0.95)) };

    goals = {
      left:  { x: rink.x + Math.max(70, Math.round(rink.w*0.10)), y: rink.y + rink.h/2 },
      right: { x: rink.x + rink.w - Math.max(70, Math.round(rink.w*0.10)), y: rink.y + rink.h/2 },
      mouth: { w: Math.max(92, Math.round(rink.w * 0.10)), h: Math.max(64, Math.round(rink.h * 0.16)) }
    };

    goalies.left.y = goals.left.y;
    goalies.right.y = goals.right.y;

    // Подстройка игроков под размер сцены
    const mob = isMobileNow();
    for (const p of players){
      p.scale = mob ? p.scaleMobile : p.scaleDesktop;
      p.vx = mob ? p.vxMobile : p.vxDesktop;
      p.baseY = rink.y + rink.h * p.fracY;
      p.x = rink.x + rink.w * p.fracX;
    }
  }

  function reset(){
    for (const p of players){
      p.x = rink.x + rink.w * p.fracX;
      p.baseY = rink.y + rink.h * p.fracY;
      p.shootKick = 0;
      // направление оставим как задано
    }

    state.score.loko = 0;
    state.score.spartak = 0;
    state.period = 1;
    state.timeLeft = 20 * 60;

    state.lastShotAt = 0;
    state.nextShotIn = 2.2;
    state.flashUntil = 0;
    state.msg = "";
    state.msgUntil = 0;

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
    if (performance.now() < state.flashUntil) scoreboardEl.classList.add("flash");
    else scoreboardEl.classList.remove("flash");
  }

  function flashAndMessage(text){
    state.flashUntil = performance.now() + 900;
    state.msg = text;
    state.msgUntil = performance.now() + 900;
  }

  function goalScored(teamKey){
    state.score[teamKey] += 1;
    flashAndMessage("ГОЛ!");
    state.nextShotIn = 1.8 + Math.random()*2.2;
    state.lastShotAt = 0;
    puck.active = false;
    puck.trail = [];
    updateScoreboard();
  }

  function roundedRectPath(x, y, w, h, r){
    const rr = Math.min(r, w/2, h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr, y);
    ctx.arcTo(x+w, y, x+w, y+h, rr);
    ctx.arcTo(x+w, y+h, x, y+h, rr);
    ctx.arcTo(x, y+h, x, y, rr);
    ctx.arcTo(x, y, x+w, y, rr);
    ctx.closePath();
  }

  function drawIce(){
    roundedRectPath(rink.x, rink.y, rink.w, rink.h, rink.r);
    ctx.fillStyle = "#eaf6ff";
    ctx.fill();

    const g = ctx.createLinearGradient(0, rink.y, 0, rink.y + rink.h);
    g.addColorStop(0, "rgba(140,200,255,.16)");
    g.addColorStop(1, "rgba(20,60,110,.10)");
    ctx.fillStyle = g;
    ctx.fill();

    ctx.lineWidth = 8;
    ctx.strokeStyle = "#1d3a56";
    ctx.stroke();

    // Center red line
    ctx.beginPath();
    ctx.moveTo(rink.x, rink.y + rink.h/2);
    ctx.lineTo(rink.x + rink.w, rink.y + rink.h/2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(200,40,40,.55)";
    ctx.stroke();

    // Blue lines
    for(const k of [0.33, 0.67]){
      const xx = rink.x + rink.w * k;
      ctx.beginPath();
      ctx.moveTo(xx, rink.y);
      ctx.lineTo(xx, rink.y + rink.h);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(40,120,220,.50)";
      ctx.stroke();
    }

    // Circles
    function circle(cx, cy, r, col){
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = col;
      ctx.stroke();
    }
    circle(rink.x + rink.w*0.25, rink.y + rink.h*0.33, 38, "rgba(200,40,40,.45)");
    circle(rink.x + rink.w*0.75, rink.y + rink.h*0.33, 38, "rgba(200,40,40,.45)");
    circle(rink.x + rink.w*0.25, rink.y + rink.h*0.67, 38, "rgba(200,40,40,.45)");
    circle(rink.x + rink.w*0.75, rink.y + rink.h*0.67, 38, "rgba(200,40,40,.45)");
    circle(rink.x + rink.w*0.50, rink.y + rink.h*0.50, 56, "rgba(200,40,40,.45)");
  }

  function drawBanner(x, y, w, h, text, fill, stripe="rgba(20,20,20,.65)"){
    ctx.save();
    roundedRectPath(x, y, w, h, 14);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,.20)";
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = stripe;
    ctx.fillRect(x, y + h - 10, w, 10);

    ctx.globalAlpha = 1;
    ctx.font = "800 18px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = fill.startsWith("rgba(255") ? "rgba(10,10,10,.9)" : "rgba(255,255,255,.95)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w/2, y + h/2 - 2);
    ctx.restore();
  }

  function drawStands(){
    const g = ctx.createLinearGradient(0, 0, 0, stands.h);
    g.addColorStop(0, "#0a0f18");
    g.addColorStop(1, "#0b1928");
    ctx.fillStyle = g;
    ctx.fillRect(stands.x, stands.y, stands.w, stands.h);

    // crowd dots (на мобиле чуть меньше)
    const mob = isMobileNow();
    const dots = mob ? 780 : 1400;
    const stepX = mob ? 19 : 17;
    const stepY = 10;

    ctx.save();
    ctx.globalAlpha = 0.75;
    for(let i=0;i<dots;i++){
      const x = (i*stepX) % W;
      const y = (Math.floor(i*stepX / W) * stepY) + 34;
      if (y > stands.h - 22) break;
      const v = (i*37) % 100;
      ctx.fillStyle = v < 33 ? "rgba(240,240,255,.35)" : v < 66 ? "rgba(255,120,120,.25)" : "rgba(120,200,255,.22)";
      ctx.fillRect(x + (v%7), y + (v%3), 2, 2);
    }
    ctx.restore();

    // rail
    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.fillRect(0, stands.h - 24, W, 2);

    // banners (масштабируем под ширину)
    const bannerY = stands.h - 86;
    const bw = Math.min(470, Math.round(W * 0.42));
    const gap = Math.round(W * 0.06);
    const leftX = Math.max(14, Math.round(W * 0.08));
    const rightX = Math.min(W - leftX - bw, leftX + bw + gap);

    drawBanner(leftX, bannerY, bw, 54, clubs.loko.name, "rgba(200,31,43,.85)");
    drawBanner(rightX, bannerY, bw, 54, clubs.spartak.name, "rgba(255,255,255,.85)", "rgba(200,31,43,.95)");
  }

  // ворота
  function drawGoal(cx, cy, scale=1.0){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(0, 28, 66, 10, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // сетка
    ctx.save();
    ctx.strokeStyle = "rgba(120,140,160,.35)";
    ctx.lineWidth = 1;
    for (let x=-48; x<=48; x+=10){
      ctx.beginPath();
      ctx.moveTo(x, -10);
      ctx.lineTo(x-10, 30);
      ctx.stroke();
    }
    for (let y=-10; y<=30; y+=8){
      ctx.beginPath();
      ctx.moveTo(-48, y);
      ctx.lineTo(48, y);
      ctx.stroke();
    }
    ctx.restore();

    // рама
    ctx.strokeStyle = "rgba(220,40,40,.95)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-52, 22);
    ctx.lineTo(-52, -12);
    ctx.lineTo( 52, -12);
    ctx.lineTo( 52, 22);
    ctx.stroke();

    // полозья
    ctx.strokeStyle = "rgba(220,40,40,.75)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-52, 22); ctx.lineTo(-68, 36);
    ctx.moveTo( 52, 22); ctx.lineTo( 68, 36);
    ctx.stroke();

    ctx.restore();
  }

  function drawGoalie(side, t){
    const g = (side === "left") ? goalies.left : goalies.right;
    const gx = (side === "left") ? goals.left.x : goals.right.x;
    const gy0 = (side === "left") ? goals.left.y : goals.right.y;

    const sway = Math.sin(t*1.1 + g.phase) * (isMobileNow() ? 20 : 26);
    g.y = gy0 + sway;

    ctx.save();
    ctx.translate(gx, g.y);

    const offsetX = (side === "left") ? 18 : -18;
    ctx.translate(offsetX, 18);

    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 48, 26, 8, 0, 0, Math.PI*2);
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
    const logo = (club === clubs.loko) ? state.logos.loko : state.logos.spartak;
    if (logo){
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.clip();
      const iw = logo.width, ih = logo.height;
      const side = Math.min(iw, ih);
      const sx = (iw - side) / 2;
      const sy = (ih - side) / 2;
      ctx.drawImage(logo, sx, sy, side, side, cx - r, cy - r, r*2, r*2);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI*2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.stroke();
      return;
    }

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI*2);
    ctx.fillStyle = "rgba(10,10,10,.25)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = club.secondary === "#f7f7f7" ? "rgba(200,31,43,.95)" : "rgba(255,255,255,.85)";
    ctx.stroke();
    ctx.font = "900 12px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = club.secondary === "#f7f7f7" ? "rgba(200,31,43,.95)" : "rgba(255,255,255,.92)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(club.short, cx, cy+0.5);
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
    const sx = (iw - side) / 2;
    const sy = (ih - side) / 2;
    ctx.drawImage(faceImg, sx, sy, side, side, -15, -38, 30, 30);

    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, -23, 15, 0, Math.PI*2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.stroke();
    return true;
  }

  function getStickBladeWorld(p, tSec){
    const bob = Math.sin(tSec*2.2 + p.phase) * 2.2;
    const x = p.x;
    const y = p.baseY + bob;
    const ahead = 72 * p.scale * p.dir;
    const down = 70 * p.scale;
    return { x: x + ahead, y: y + down };
  }

  function maybeShoot(tSec){
    if (puck.active) return;
    if (state.lastShotAt === 0) state.lastShotAt = tSec;

    const since = tSec - state.lastShotAt;
    if (since < state.nextShotIn) return;

    const shooter = players[Math.random() < 0.5 ? 0 : 1];
    const target = (shooter.dir === 1) ? goals.right : goals.left;
    const goalie = (shooter.dir === 1) ? goalies.right : goalies.left;

    const spawn = getStickBladeWorld(shooter, tSec);

    const ty = target.y + (Math.random()*120 - 60);
    const tx = target.x + (shooter.dir === 1 ? -6 : 6);

    const speed = (isMobileNow() ? 780 : 860) + Math.random()*(isMobileNow() ? 280 : 320);
    const dx = (tx - spawn.x);
    const dy = (ty - spawn.y);
    const len = Math.max(1, Math.hypot(dx, dy));

    puck.active = true;
    puck.x = spawn.x;
    puck.y = spawn.y;
    puck.vx = dx / len * speed;
    puck.vy = dy / len * speed;
    puck.shooter = shooter;
    puck.ttl = 2.2;
    puck.trail = [];

    shooter.shootKick = 0.35;
    goalie.skill = 0.48 + Math.random()*0.18;

    state.lastShotAt = tSec;
    state.nextShotIn = (isMobileNow() ? 2.2 : 2.0) + Math.random()*(isMobileNow() ? 2.8 : 2.6);
  }

  function updatePuck(dt){
    if (!puck.active) return;

    puck.ttl -= dt;
    if (puck.ttl <= 0){
      puck.active = false;
      puck.trail = [];
      return;
    }

    const TRAIL_MAX = isMobileNow() ? 10 : 18;
    puck.trail.push({x: puck.x, y: puck.y});
    if (puck.trail.length > TRAIL_MAX) puck.trail.shift();

    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;

    const drag = Math.max(0.0, 1.0 - dt * 0.22);
    puck.vx *= drag;
    puck.vy *= drag;

    const top = rink.y + 18;
    const bottom = rink.y + rink.h - 18;
    if (puck.y < top){ puck.y = top; puck.vy = Math.abs(puck.vy) * 0.85; }
    if (puck.y > bottom){ puck.y = bottom; puck.vy = -Math.abs(puck.vy) * 0.85; }

    checkGoalOrSave("left");
    checkGoalOrSave("right");

    if (puck.x < rink.x - 240 || puck.x > rink.x + rink.w + 240){
      puck.active = false;
      puck.trail = [];
    }
  }

  function checkGoalOrSave(side){
    if (!puck.active) return;

    const gpos = (side === "left") ? goals.left : goals.right;
    const goalie = (side === "left") ? goalies.left : goalies.right;

    const gx = gpos.x;
    const gy = goalie.y;
    const mh = goals.mouth.h;

    const nearX = (side === "left")
      ? (puck.x <= gx + 18 && puck.x >= gx - 26)
      : (puck.x >= gx - 18 && puck.x <= gx + 26);

    if (!nearX) return;

    const inY = Math.abs(puck.y - gy) <= mh/2;
    if (!inY){
      puck.vx *= -0.55;
      puck.vy = (Math.random()*2 - 1) * 260;
      return;
    }

    const dist = Math.abs(puck.y - gy);
    const centerBonus = 1.0 - Math.min(1.0, dist / (mh/2));
    const saveChance = Math.min(0.92, goalie.skill * (0.55 + 0.45*centerBonus));

    if (Math.random() < saveChance){
      flashAndMessage("СЭЙВ!");
      const out = (side === "left") ? 1 : -1;
      puck.vx = Math.abs(puck.vx) * out * (0.65 + Math.random()*0.25);
      puck.vy = (Math.random()*2 - 1) * 320;
      puck.ttl = Math.min(puck.ttl, 1.15);
      return;
    }

    goalScored(puck.shooter.club.key);
  }

  function drawPuck(){
    if (!puck.active) return;

    ctx.save();
    for (let i=0;i<puck.trail.length;i++){
      const a = i / puck.trail.length;
      ctx.globalAlpha = 0.05 + a*0.16;
      ctx.beginPath();
      ctx.arc(puck.trail[i].x, puck.trail[i].y, 3.5 + a*2.5, 0, Math.PI*2);
      ctx.fillStyle = "rgba(20,20,30,1)";
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.96;
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, 7.2, 0, Math.PI*2);
    ctx.fillStyle = "rgba(15,15,20,1)";
    ctx.fill();

    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(puck.x-2.2, puck.y-2.2, 2.8, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(p, t){
    const bob = Math.sin(t*2.2 + p.phase) * 2.2;
    const lean = Math.sin(t*1.4 + p.phase) * 0.06;
    const push = (Math.sin(t*2.8 + p.phase) * 0.5 + 0.5);

    if (p.shootKick > 0) p.shootKick = Math.max(0, p.shootKick - 1/60);
    const kick = p.shootKick;

    const x = p.x;
    const y = p.baseY + bob;
    const faceImg = (p.club === clubs.loko) ? state.faces.loko : state.faces.spartak;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.scale * p.dir, p.scale);
    ctx.rotate(lean - kick*0.10);

    // shadow
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 70, 58, 14, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    // ice trail
    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = "rgba(160,220,255,.40)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-54, 76);
    ctx.lineTo(-10, 76);
    ctx.stroke();
    ctx.restore();

    // stick
    ctx.save();
    const baseAngle = -0.30;
    const stickAngle = baseAngle - kick*0.55;
    ctx.rotate(stickAngle);
    ctx.translate(36, 36 + kick*8);

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

    // torso
    ctx.save();
    roundedRectPath(-34, -10, 68, 82, 18);
    ctx.fillStyle = p.club.primary;
    ctx.fill();

    const hg = ctx.createLinearGradient(-34, -10, 34, 70);
    hg.addColorStop(0, "rgba(255,255,255,.20)");
    hg.addColorStop(0.35, "rgba(255,255,255,.06)");
    hg.addColorStop(1, "rgba(0,0,0,.12)");
    ctx.fillStyle = hg;
    ctx.fill();

    if (p.club === clubs.spartak){
      ctx.fillStyle = "rgba(200,31,43,.95)";
      ctx.fillRect(-34, 20, 68, 12);
      ctx.fillRect(-34, 48, 68, 10);
    } else {
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.fillRect(-34, 62, 68, 7);
    }

    ctx.fillStyle = p.club.secondary;
    roundedRectPath(-40, -10, 24, 24, 10);
    ctx.fill();
    roundedRectPath(16, -10, 24, 24, 10);
    ctx.fill();

    drawEmblem(0, 28, 16, p.club);
    ctx.restore();

    // head
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -28, 24, 0, Math.PI*2);
    ctx.fillStyle = p.club.secondary;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, -23, 15, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,224,189,.95)";
    ctx.fill();

    const usedFace = drawFaceOnHead(faceImg);
    if (!usedFace){
      ctx.fillStyle = "rgba(20,20,20,.7)";
      ctx.beginPath();
      ctx.arc(-5, -25, 1.8, 0, Math.PI*2);
      ctx.arc( 5, -25, 1.8, 0, Math.PI*2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, -18, 2.4, 0, Math.PI);
      ctx.strokeStyle = "rgba(20,20,20,.55)";
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    ctx.restore();

    // arms
    ctx.save();
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.strokeStyle = p.club.secondary;
    ctx.beginPath(); ctx.moveTo(-22, 14); ctx.lineTo(-44, 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 22, 14); ctx.lineTo( 44, 30); ctx.stroke();
    ctx.restore();

    // pants
    ctx.save();
    roundedRectPath(-28, 64-28, 56, 30, 12);
    ctx.fillStyle = "rgba(20,20,20,.92)";
    ctx.fill();
    ctx.restore();

    // legs + skates
    ctx.save();
    drawLegAndSkate(-12, 54, -0.05);
    const pushX = 12 + (push * 10);
    const pushRot = 0.15 + push * 0.25;
    drawLegAndSkate(pushX, 54, pushRot);
    ctx.restore();

    ctx.restore();
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

    ctx.fillStyle = "rgba(240,240,240,.22)";
    ctx.fillRect(-12, -9, 24, 2);

    ctx.strokeStyle = "rgba(200,200,200,.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 3); ctx.lineTo(-8, 10);
    ctx.moveTo( 8, 3); ctx.lineTo( 8, 10);
    ctx.stroke();

    ctx.strokeStyle = "rgba(230,230,230,.95)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-16, 12);
    ctx.lineTo( 16, 12);
    ctx.stroke();

    ctx.strokeStyle = "rgba(230,230,230,.75)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 12);
    ctx.lineTo(18, 11);
    ctx.stroke();

    ctx.restore();
    ctx.restore();
  }

  function drawVignette(){
    ctx.save();
    const g1 = ctx.createLinearGradient(0, 0, 0, H);
    g1.addColorStop(0, "rgba(0,0,0,.55)");
    g1.addColorStop(0.25, "rgba(0,0,0,.0)");
    g1.addColorStop(0.75, "rgba(0,0,0,.0)");
    g1.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawCenterMessage(){
    if (performance.now() > state.msgUntil) return;
    ctx.save();
    ctx.font = `900 ${isMobileNow() ? 32 : 40}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,.90)";
    ctx.shadowColor = "rgba(0,0,0,.55)";
    ctx.shadowBlur = 12;
    ctx.fillText(state.msg, W/2, H*0.60);
    ctx.restore();
  }

  let lastNow = performance.now();

  function tick(now){
    const dt = Math.min(0.05, (now - lastNow) / 1000);
    lastNow = now;

    state.speed = Number(speedSlider.value);

    if (state.running){
      state.timeLeft -= dt * state.speed;
      if (state.timeLeft <= 0){
        state.period += 1;
        if (state.period > 3) state.period = 1;
        state.timeLeft = 20 * 60;
      }
    }

    const t = ((now - state.t0) / 1000) * (state.running ? state.speed : 0);

    // Ресайз + лэйаут (на всякий случай: например при изменении адресной строки браузера на мобиле)
    resizeCanvasToDisplaySize();
    layout();

    ctx.clearRect(0, 0, W, H);

    drawStands();
    drawIce();

    drawGoal(goals.left.x, goals.left.y, isMobileNow() ? 0.95 : 1.05);
    drawGoal(goals.right.x, goals.right.y, isMobileNow() ? 0.95 : 1.05);

    drawGoalie("left", t);
    drawGoalie("right", t);

    if (state.running){
      const leftBound = rink.x + Math.max(120, Math.round(rink.w * 0.14));
      const rightBound = rink.x + rink.w - Math.max(120, Math.round(rink.w * 0.14));

      for (const p of players){
        p.x += p.vx * p.dir * state.speed * dt;
        if (p.x > rightBound){ p.x = rightBound; p.dir = -1; }
        else if (p.x < leftBound){ p.x = leftBound; p.dir = 1; }
      }

      maybeShoot(t);
      updatePuck(dt * state.speed);
    }

    // дальний первым
    drawPlayer(players[1], t);
    drawPlayer(players[0], t + 0.25);

    drawPuck();
    drawCenterMessage();
    drawVignette();

    updateScoreboard();
    requestAnimationFrame(tick);
  }

  pauseBtn.addEventListener("click", () => {
    state.running = !state.running;
    pauseBtn.textContent = state.running ? "Пауза" : "Продолжить";
  });

  resetBtn.addEventListener("click", () => reset());

  // Load assets from folder
  loadImage("assets/loko.png", (img) => state.logos.loko = img);
  loadImage("assets/spartak.png", (img) => state.logos.spartak = img);
  loadImage("assets/face_loko.png", (img) => state.faces.loko = img);
  loadImage("assets/face_spartak.png", (img) => state.faces.spartak = img);

  // Start
  resizeCanvasToDisplaySize();
  layout();
  reset();
  requestAnimationFrame(tick);
})();
