from pathlib import Path

OUT_DIR = Path(".")
(OUT_DIR / "assets").mkdir(exist_ok=True)

INDEX_HTML = """<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Хоккейная сцена: Локомотив vs Спартак</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <header class="topbar">
    <div class="title">
      <div class="matchline">
        <div class="team left">
          <div class="team-row">
            <img class="team-logo" src="assets/loko.png" alt="Эмблема Локомотив Ярославль"
                 onerror="this.style.display='none'">
            <div class="team-name">Локомотив Ярославль</div>
          </div>
          <div class="team-sub">красные</div>
        </div>

        <div class="scoreboard" id="scoreboard" aria-label="Табло">
          <div class="score" id="score">0 : 0</div>
          <div class="score-sub" id="scoreSub">1 период • 20:00</div>
        </div>

        <div class="team right">
          <div class="team-row">
            <div class="team-name">Спартак Пятигорск</div>
            <img class="team-logo" src="assets/spartak.png" alt="Эмблема Спартак Пятигорск"
                 onerror="this.style.display='none'">
          </div>
          <div class="team-sub">бело-красные</div>
        </div>
      </div>
    </div>

    <div class="controls">
      <div class="ctrl row">
        <button id="pauseBtn" class="btn">Пауза</button>
        <button id="resetBtn" class="btn ghost">Сброс</button>
      </div>

      <div class="ctrl">
        <label class="lbl">Скорость</label>
        <input id="speed" type="range" min="0.4" max="2.2" step="0.05" value="1.0" />
      </div>
    </div>
  </header>

  <main class="stage">
    <canvas id="scene" width="1280" height="720" aria-label="Хоккейная анимация"></canvas>
  </main>

  <script src="app.js"></script>
</body>
</html>
"""

STYLE_CSS = """
:root{
  --bg:#0b0f14;
  --panel:#101826;
  --panel2:#0e1521;
  --text:#e8eef8;
  --muted:#a7b3c6;
  --border:rgba(255,255,255,.10);
}

*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  background:radial-gradient(1200px 600px at 50% -50%, rgba(97,218,251,.18), transparent 60%),
             radial-gradient(900px 500px at 10% 0%, rgba(255,90,90,.15), transparent 55%),
             var(--bg);
  color:var(--text);
  font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif;
}

.topbar{
  display:flex;
  gap:16px;
  justify-content:space-between;
  padding:16px;
  border-bottom:1px solid var(--border);
  background:linear-gradient(180deg, rgba(16,24,38,.92), rgba(16,24,38,.65));
  position:sticky;
  top:0;
  backdrop-filter: blur(10px);
  z-index:5;
}

.title{min-width:320px; flex: 1 1 auto;}

.matchline{
  display:grid;
  grid-template-columns: 1fr auto 1fr;
  gap:14px;
  align-items:center;
}

.team{
  display:flex;
  flex-direction:column;
  gap:2px;
}

.team-row{
  display:flex;
  align-items:center;
  gap:10px;
}

.team.left{ align-items:flex-start; }
.team.right{ align-items:flex-end; }
.team.right .team-row{ justify-content:flex-end; }

.team-logo{
  width:32px;
  height:32px;
  border-radius:10px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);
  object-fit:contain;
  padding:3px;
  box-shadow: 0 6px 18px rgba(0,0,0,.25);
}

.team-name{ font-size:16px; font-weight:800; letter-spacing:.2px; white-space:nowrap; }
.team-sub{ font-size:12px; color:var(--muted); }

.scoreboard{
  min-width:160px;
  padding:10px 14px;
  border-radius:14px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(14,21,33,.80), rgba(14,21,33,.45));
  text-align:center;
  box-shadow: 0 10px 25px rgba(0,0,0,.25);
}
.score{
  font-size:22px;
  font-weight:900;
  letter-spacing:1px;
}
.score-sub{
  margin-top:2px;
  font-size:12px;
  color:var(--muted);
}
.scoreboard.flash{
  animation: flash 420ms ease-in-out 0s 2;
}
@keyframes flash {
  0%{ transform: translateY(0); filter:brightness(1); }
  50%{ transform: translateY(-1px); filter:brightness(1.35); }
  100%{ transform: translateY(0); filter:brightness(1); }
}

.controls{
  display:flex;
  gap:12px;
  align-items:flex-end;
  flex-wrap:wrap;
  justify-content:flex-end;
}

.ctrl{
  display:flex;
  flex-direction:column;
  gap:6px;
  padding:10px 12px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(14,21,33,.75), rgba(14,21,33,.45));
  border-radius:14px;
  min-width:190px;
}

.ctrl.row{ min-width:auto; flex-direction:row; align-items:center; gap:10px; }

.lbl{ font-size:12px; color:var(--muted); }
input[type="range"]{ width: 220px; }

.btn{
  cursor:pointer;
  border:1px solid var(--border);
  background:rgba(97,218,251,.16);
  color:var(--text);
  padding:10px 12px;
  border-radius:12px;
  font-weight:650;
}
.btn:hover{ filter: brightness(1.08); }
.btn.ghost{ background:transparent; }

.stage{ padding:18px 16px 18px; display:flex; justify-content:center; }

canvas#scene{
  width:min(1280px, 96vw);
  height:auto;
  border-radius:18px;
  border:1px solid var(--border);
  background:#07121d;
  box-shadow: 0 20px 60px rgba(0,0,0,.55);
}
"""

APP_JS = r"""
(() => {
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  const pauseBtn = document.getElementById("pauseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const speedSlider = document.getElementById("speed");

  const scoreEl = document.getElementById("score");
  const scoreSubEl = document.getElementById("scoreSub");
  const scoreboardEl = document.getElementById("scoreboard");

  const W = canvas.width;
  const H = canvas.height;

  function loadImage(url, cb) {
    const img = new Image();
    img.onload = () => cb(img);
    img.onerror = () => cb(null);
    img.src = url;
  }

  const rink = { x: 90, y: 190, w: W - 180, h: 430, r: 70 };
  const stands = { x: 0, y: 0, w: W, h: 210 };

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

  const goals = {
    left:  { x: rink.x + 100, y: rink.y + rink.h/2 },
    right: { x: rink.x + rink.w - 100, y: rink.y + rink.h/2 },
    mouth: { w: 112, h: 74 }
  };

  const goalies = {
    left:  { side: "left",  phase: 0.0, skill: 0.52, y: goals.left.y },
    right: { side: "right", phase: 1.2, skill: 0.52, y: goals.right.y }
  };

  const players = [
    { club: clubs.loko, x: rink.x + rink.w*0.22, baseY: rink.y + rink.h * 0.68, phase: 0.0, scale: 1.35, vx: 250, dir: 1,  shootKick: 0 },
    { club: clubs.spartak, x: rink.x + rink.w*0.55, baseY: rink.y + rink.h * 0.40, phase: 1.7, scale: 1.25, vx: 230, dir: -1, shootKick: 0 }
  ];

  const puck = { active: false, x: 0, y: 0, vx: 0, vy: 0, shooter: null, ttl: 0, trail: [] };

  function reset(){
    players[0].x = rink.x + rink.w*0.22;
    players[1].x = rink.x + rink.w*0.55;
    players[0].dir = 1;
    players[1].dir = -1;
    players[0].shootKick = 0;
    players[1].shootKick = 0;

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

    ctx.beginPath();
    ctx.moveTo(rink.x, rink.y + rink.h/2);
    ctx.lineTo(rink.x + rink.w, rink.y + rink.h/2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(200,40,40,.55)";
    ctx.stroke();

    for(const k of [0.33, 0.67]){
      const xx = rink.x + rink.w * k;
      ctx.beginPath();
      ctx.moveTo(xx, rink.y);
      ctx.lineTo(xx, rink.y + rink.h);
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(40,120,220,.50)";
      ctx.stroke();
    }

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

    ctx.save();
    ctx.globalAlpha = 0.75;
    for(let i=0;i<1400;i++){
      const x = (i*17) % W;
      const y = (Math.floor(i*17 / W) * 10) + 36;
      if (y > stands.h - 22) break;
      const v = (i*37) % 100;
      ctx.fillStyle = v < 33 ? "rgba(240,240,255,.35)" : v < 66 ? "rgba(255,120,120,.25)" : "rgba(120,200,255,.22)";
      ctx.fillRect(x + (v%7), y + (v%3), 2, 2);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(255,255,255,.10)";
    ctx.fillRect(0, stands.h - 24, W, 2);

    const bannerY = stands.h - 86;
    drawBanner(120, bannerY, 470, 54, clubs.loko.name, "rgba(200,31,43,.85)");
    drawBanner(W - 590, bannerY, 470, 54, clubs.spartak.name, "rgba(255,255,255,.85)", "rgba(200,31,43,.95)");
  }

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

    ctx.strokeStyle = "rgba(220,40,40,.95)";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-52, 22);
    ctx.lineTo(-52, -12);
    ctx.lineTo( 52, -12);
    ctx.lineTo( 52, 22);
    ctx.stroke();

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

    const sway = Math.sin(t*1.1 + g.phase) * 26;
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

    const speed = 860 + Math.random()*320;
    const dx = (tx - spawn.x);
    const dy = (ty - spawn.y);
    const len = Math.max(1, Math.hypot(dx, dy));

    puck.active = true;
    puck.x = spawn.x;
    puck.y = spawn.y;
    puck.vx = dx / len * speed;
    puck.vy = dy / len * speed;
    puck.shooter = shooter;
    puck.ttl = 2.4;
    puck.trail = [];

    shooter.shootKick = 0.35;
    goalie.skill = 0.48 + Math.random()*0.18;

    state.lastShotAt = tSec;
    state.nextShotIn = 2.0 + Math.random()*2.6;
  }

  function updatePuck(dt){
    if (!puck.active) return;

    puck.ttl -= dt;
    if (puck.ttl <= 0){
      puck.active = false;
      puck.trail = [];
      return;
    }

    puck.trail.push({x: puck.x, y: puck.y});
    if (puck.trail.length > 18) puck.trail.shift();

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
      puck.ttl = Math.min(puck.ttl, 1.2);
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

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 70, 58, 14, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.30;
    ctx.strokeStyle = "rgba(160,220,255,.40)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-54, 76);
    ctx.lineTo(-10, 76);
    ctx.stroke();
    ctx.restore();

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

    ctx.save();
    ctx.lineWidth = 14;
    ctx.lineCap = "round";
    ctx.strokeStyle = p.club.secondary;
    ctx.beginPath(); ctx.moveTo(-22, 14); ctx.lineTo(-44, 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 22, 14); ctx.lineTo( 44, 30); ctx.stroke();
    ctx.restore();

    ctx.save();
    roundedRectPath(-28, 64-28, 56, 30, 12);
    ctx.fillStyle = "rgba(20,20,20,.92)";
    ctx.fill();
    ctx.restore();

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
    ctx.font = "900 40px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
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

    ctx.clearRect(0, 0, W, H);
    drawStands();
    drawIce();

    drawGoal(goals.left.x, goals.left.y, 1.05);
    drawGoal(goals.right.x, goals.right.y, 1.05);

    drawGoalie("left", t);
    drawGoalie("right", t);

    if (state.running){
      const leftBound = rink.x + 150;
      const rightBound = rink.x + rink.w - 150;

      for (const p of players){
        p.x += p.vx * p.dir * state.speed * dt;
        if (p.x > rightBound){ p.x = rightBound; p.dir = -1; }
        else if (p.x < leftBound){ p.x = leftBound; p.dir = 1; }
      }

      maybeShoot(t);
      updatePuck(dt * state.speed);
    }

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

  loadImage("assets/loko.png", (img) => state.logos.loko = img);
  loadImage("assets/spartak.png", (img) => state.logos.spartak = img);
  loadImage("assets/face_loko.png", (img) => state.faces.loko = img);
  loadImage("assets/face_spartak.png", (img) => state.faces.spartak = img);

  reset();
  requestAnimationFrame(tick);
})();
"""

def write(path: Path, content: str):
    path.write_text(content, encoding="utf-8")
    print(f"✓ wrote {path}")

def main():
    write(OUT_DIR / "index.html", INDEX_HTML)
    write(OUT_DIR / "style.css", STYLE_CSS)
    write(OUT_DIR / "app.js", APP_JS)

    # README в assets (не показывается на странице)
    readme = OUT_DIR / "assets" / "README.txt"
    if not readme.exists():
        readme.write_text(
            "Положи сюда файлы:\n"
            "  loko.png\n"
            "  spartak.png\n"
            "  face_loko.png\n"
            "  face_spartak.png\n",
            encoding="utf-8",
        )

    print("\nГотово. Эмблемы в табло добавлены (берутся из assets).")

if __name__ == "__main__":
    main()
