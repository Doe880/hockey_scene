from pathlib import Path
from datetime import datetime

OUT_DIR = Path(".")
ASSETS_DIR = OUT_DIR / "assets"
ASSETS_DIR.mkdir(exist_ok=True)

BUILD = datetime.now().strftime("%Y%m%d%H%M%S")
CSS_NAME = f"style.{BUILD}.css"
JS_NAME = f"app.{BUILD}.js"

INDEX_HTML = f"""<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <title>Хоккей: Локомотив vs Спартак</title>
  <link rel="stylesheet" href="{CSS_NAME}" />
</head>
<body>
  <header class="topbar" id="topbar">
    <div class="title">
      <div class="matchline">
        <div class="team left">
          <div class="team-row">
            <img class="team-logo" src="assets/loko.png" alt="Локомотив" onerror="this.style.display='none'">
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
            <img class="team-logo" src="assets/spartak.png" alt="Спартак" onerror="this.style.display='none'">
          </div>
          <div class="team-sub">бело-красные</div>
        </div>
      </div>
    </div>
  </header>

  <main class="stage">
    <canvas id="scene" width="900" height="1200"></canvas>
  </main>

  <script src="{JS_NAME}"></script>
</body>
</html>
"""

STYLE_CSS = """
:root{
  --bg:#0b0f14;
  --text:#e8eef8;
  --muted:#a7b3c6;
  --border:rgba(255,255,255,.10);
  --vh: 1vh;
  --header-h: 0px;
  --stage-gap: 10px;
}
*{box-sizing:border-box}
html,body{height:100%}
body{
  margin:0;
  background:radial-gradient(1200px 600px at 50% -50%, rgba(97,218,251,.18), transparent 60%),
             radial-gradient(900px 500px at 10% 0%, rgba(255,90,90,.15), transparent 55%),
             var(--bg);
  color:var(--text);
  font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial;
}
.topbar{
  display:flex;
  gap:10px;
  justify-content:space-between;
  padding:12px;
  border-bottom:1px solid var(--border);
  background:linear-gradient(180deg, rgba(16,24,38,.92), rgba(16,24,38,.65));
  position:sticky;
  top:0;
  backdrop-filter: blur(10px);
  z-index:5;
}
.title{min-width:280px; flex: 1 1 auto;}
.matchline{
  display:grid;
  grid-template-columns: 1fr auto 1fr;
  gap:12px;
  align-items:center;
}
.team{display:flex; flex-direction:column; gap:2px;}
.team-row{display:flex; align-items:center; gap:8px;}
.team.left{align-items:flex-start;}
.team.right{align-items:flex-end;}
.team.right .team-row{justify-content:flex-end;}
.team-logo{
  width:26px;height:26px;
  border-radius:9px;
  border:1px solid rgba(255,255,255,.14);
  background:rgba(255,255,255,.06);
  object-fit:contain;
  padding:2px;
  box-shadow: 0 6px 18px rgba(0,0,0,.25);
}
.team-name{font-size:14px;font-weight:800;white-space:nowrap;}
.team-sub{font-size:11px;color:var(--muted);}
.scoreboard{
  min-width:130px;
  padding:8px 10px;
  border-radius:12px;
  border:1px solid var(--border);
  background:linear-gradient(180deg, rgba(14,21,33,.80), rgba(14,21,33,.45));
  text-align:center;
  box-shadow: 0 10px 25px rgba(0,0,0,.25);
}
.score{font-size:18px;font-weight:900;letter-spacing:1px;}
.score-sub{margin-top:2px;font-size:11px;color:var(--muted);}
.stage{
  padding: var(--stage-gap);
  display:flex;
  justify-content:center;
}
canvas#scene{
  width:100%;
  max-width:100vw;
  border-radius:14px;
  border:1px solid var(--border);
  background:#07121d;
  box-shadow: 0 20px 60px rgba(0,0,0,.55);
  touch-action: none;
}
@media (max-width: 720px){
  canvas#scene{
    aspect-ratio: 3 / 4;
    height:auto;
    max-height: calc((var(--vh) * 100) - var(--header-h) - (var(--stage-gap) * 2) - 6px);
  }
}
@media (min-width: 721px){
  canvas#scene{
    aspect-ratio: 16 / 9;
    height:auto;
    max-height: calc(100vh - 140px);
  }
}
"""

APP_JS = r"""
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

  const goalies = {
    top:    { x:0, baseX:0, y:0 },
    bottom: { x:0, baseX:0, y:0 }
  };

  // Игроки стоят на центральной красной линии (строго центр)
  const players = [
    { id:0, club:clubs.loko,    scale:0.84, x:0, y:0, dir:1,  shootKick:0 },
    { id:1, club:clubs.spartak, scale:0.80, x:0, y:0, dir:-1, shootKick:0 }
  ];

  // Шайба + lastTouch (кто бил)
  const puck = {
    x:0, y:0, vx:0, vy:0,
    owner:null, ttl:999,
    trail:[],
    lastTouch:"loko",
    justBouncedUntil: 0, // анти-дребезг для ударов о вратаря
  };

  const touch = {
    active:false, id:null,
    startX:0, startY:0,
    x:0, y:0,
    startT:0,
    moved:false,
  };

  const MOVE_THRESHOLD = 18;
  const SHOT_THRESHOLD = 70;

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function dist(ax,ay,bx,by){ return Math.hypot(ax-bx, ay-by); }
  function getControlled(){ return players.find(p => p.id === state.controlledId) || players[0]; }

  function flashMessage(text){
    state.msg = text;
    state.msgUntil = performance.now() + 700;
    state.flashUntil = performance.now() + 550;
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

  function layout(rescale){
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

    const goalInsetY = Math.max(54, Math.round(rink.h * 0.10));
    const centerX = rink.x + rink.w/2;

    goals = {
      top:    { x: centerX, y: rink.y + goalInsetY },
      bottom: { x: centerX, y: rink.y + rink.h - goalInsetY },
      mouthW: Math.max(120, Math.round(rink.w * 0.30)),
      lineYPad: Math.max(18, Math.round(rink.h * 0.02))
    };

    // нижний вратарь перед воротами (выше ворот)
    goalies.top.y = goals.top.y + 36;
    goalies.bottom.y = goals.bottom.y - 36;

    goalies.top.baseX = centerX;
    goalies.bottom.baseX = centerX;
    goalies.top.x = centerX;
    goalies.bottom.x = centerX;

    // === СТРОГО центр красной линии ===
    const centerY = rink.y + (rink.h / 2);

    // расстояние между игроками
    const spread = rink.w * 0.22; // было 0.12 — теперь заметно дальше

    players[0].x = centerX - spread;
    players[0].y = centerY;

    players[1].x = centerX + spread;
    players[1].y = centerY;

    // шайба у выбранного игрока
    const c = getControlled();
    puck.owner = c;
    puck.lastTouch = c.club.key;
    syncPuckToOwner();

    touch.active = false;
    touch.id = null;
  }

  function reset(){
    state.score.loko = 0;
    state.score.spartak = 0;
    state.period = 1;
    state.timeLeft = 20*60;
    state.msg = ""; state.msgUntil = 0;
    state.flashUntil = 0;
    state.controlledId = 0;

    puck.owner = players[0];
    puck.lastTouch = "loko";
    puck.trail = [];
    syncPuckToOwner();

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

    // зоны (синие линии — более лёгкие, чтобы красная была очевидной)
    for (const k of [0.33, 0.67]){
      const yy = rink.y + rink.h * k;
      ctx.beginPath();
      ctx.moveTo(rink.x, yy);
      ctx.lineTo(rink.x + rink.w, yy);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(40,120,220,.35)";
      ctx.stroke();
    }

    // центральная красная линия (чётче/ярче)
    const cy = rink.y + rink.h/2;
    ctx.beginPath();
    ctx.moveTo(rink.x, cy);
    ctx.lineTo(rink.x + rink.w, cy);
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(220,45,45,.75)";
    ctx.stroke();

    // небольшой центр-круг, чтобы визуально было понятно “центр”
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(220,45,45,.9)";
    ctx.beginPath();
    ctx.arc(rink.x + rink.w/2, cy, Math.max(32, rink.w*0.08), 0, Math.PI*2);
    ctx.stroke();
    ctx.restore();

    // гол-линии
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(200,40,40,.35)";
    ctx.beginPath();
    ctx.moveTo(rink.x, rink.y + goals.lineYPad);
    ctx.lineTo(rink.x + rink.w, rink.y + goals.lineYPad);
    ctx.moveTo(rink.x, rink.y + rink.h - goals.lineYPad);
    ctx.lineTo(rink.x + rink.w, rink.y + rink.h - goals.lineYPad);
    ctx.stroke();
  }

  function drawGoalHorizontal(cx, cy, faceDown){
    ctx.save();
    ctx.translate(cx, cy);
    if (!faceDown) ctx.scale(1, -1);

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
    const sway = Math.sin(t*0.9) * (goals.mouthW * 0.18);
    goalies.top.x = goalies.top.baseX + sway;
    goalies.bottom.x = goalies.bottom.baseX - sway;
  }

  function drawGoalie(side){
    const g = side === "top" ? goalies.top : goalies.bottom;

    ctx.save();
    ctx.translate(g.x, g.y);

    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 46, 24, 7, 0, 0, Math.PI*2);
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
    const bob = Math.sin(t*2.2 + (p.id*1.3)) * 2.0;
    if (p.shootKick > 0) p.shootKick = Math.max(0, p.shootKick - 1/60);
    const kick = p.shootKick;

    const faceImg = (p.club.key === "loko") ? state.faces.loko : state.faces.spartak;

    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.scale(p.scale * p.dir, p.scale);
    ctx.rotate(-kick*0.10);

    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.ellipse(0, 70, 52, 13, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

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

    if (p.id === state.controlledId){
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = "rgba(255,255,255,.9)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(0, 70, 62, 16, 0, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

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

    function leg(offX, offY){
      ctx.save();
      ctx.translate(offX, offY);
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
    leg(-12, 54);
    leg(12, 54);

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

  // Цели:
  // loko -> нижние ворота
  // spartak -> верхние ворота
  function shootBySwipe(fromPlayer, sx, sy, ex, ey){
    if (puck.owner !== fromPlayer) return;

    const swipeLen = Math.hypot(ex - sx, ey - sy);
    if (swipeLen < SHOT_THRESHOLD) return;

    const target = (fromPlayer.club.key === "loko") ? goals.bottom : goals.top;

    // сила по длине свайпа
    const speed = clamp(swipeLen * 14.0, 520, 1300);

    const ahead = 54 * fromPlayer.scale * fromPlayer.dir;
    const down  = 58 * fromPlayer.scale;
    const startX = fromPlayer.x + ahead;
    const startY = fromPlayer.y + down;

    // небольшой разброс по X внутри створа
    const aimX = target.x + (Math.random()*goals.mouthW - goals.mouthW/2) * 0.22;
    const aimY = target.y;

    let vx = aimX - startX;
    let vy = aimY - startY;
    const len = Math.max(1, Math.hypot(vx, vy));
    vx = (vx/len) * speed;
    vy = (vy/len) * speed;

    puck.owner = null;
    puck.lastTouch = fromPlayer.club.key;
    puck.trail = [];

    puck.x = startX;
    puck.y = startY;
    puck.vx = vx;
    puck.vy = vy;
    puck.ttl = 2.2;

    fromPlayer.shootKick = 0.45;
  }

  function goalieBox(side){
    const g = side === "top" ? goalies.top : goalies.bottom;
    // чуть больше хитбокс — чтобы “ощущалось”, что отбивает
    return { x:g.x, y:g.y, rx:26, ry:30 };
  }

  function puckHitsGoalie(side){
    const b = goalieBox(side);
    return (Math.abs(puck.x - b.x) <= b.rx) && (Math.abs(puck.y - b.y) <= b.ry);
  }

  // === Отбивание шайбы вратарём (рикошет) ===
  function bounceFromGoalie(side){
    const now = performance.now();
    if (now < puck.justBouncedUntil) return false;

    const b = goalieBox(side);

    // Отскок по Y: от верхнего — вниз, от нижнего — вверх
    const speed = Math.hypot(puck.vx, puck.vy);
    const minSpeed = Math.max(420, speed * 0.75);

    // боковой импульс в зависимости от точки попадания
    const dx = puck.x - b.x;
    const sideKick = clamp(dx * 16, -520, 520);

    if (side === "top"){
      puck.vy = Math.abs(puck.vy);
    } else {
      puck.vy = -Math.abs(puck.vy);
    }
    puck.vx += sideKick;

    // нормализуем примерно к minSpeed
    const n = Math.max(1, Math.hypot(puck.vx, puck.vy));
    puck.vx = (puck.vx / n) * minSpeed;
    puck.vy = (puck.vy / n) * minSpeed;

    // чтобы не дребезжало внутри хитбокса
    puck.justBouncedUntil = now + 160;

    flashMessage("СЭЙВ!");
    return true;
  }

  function awardGoal(){
    if (puck.lastTouch === "loko") state.score.loko += 1;
    else if (puck.lastTouch === "spartak") state.score.spartak += 1;
    flashMessage("ГОЛ!");
    puck.owner = getControlled();
    syncPuckToOwner();
  }

  function awardStop(text="СЭЙВ!"){
    flashMessage(text);
    puck.owner = getControlled();
    syncPuckToOwner();
  }

  function checkGoalOrOut(){
    const goalLineTopY    = rink.y + goals.lineYPad;
    const goalLineBottomY = rink.y + rink.h - goals.lineYPad;

    const inTopMouth    = Math.abs(puck.x - goals.top.x) <= goals.mouthW/2;
    const inBottomMouth = Math.abs(puck.x - goals.bottom.x) <= goals.mouthW/2;

    // пересечение верхней линии
    if (puck.y <= goalLineTopY){
      if (inTopMouth){
        // если попал во вратаря — рикошет
        if (puckHitsGoalie("top")) bounceFromGoalie("top");
        else awardGoal();
      } else {
        // мимо створа — просто “останов”
        awardStop("СЭЙВ!");
      }
      return true;
    }

    // пересечение нижней линии
    if (puck.y >= goalLineBottomY){
      if (inBottomMouth){
        if (puckHitsGoalie("bottom")) bounceFromGoalie("bottom");
        else awardGoal();
      } else {
        awardStop("СЭЙВ!");
      }
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

    // трейл
    const TRAIL_MAX = 12;
    puck.trail.push({x:puck.x, y:puck.y});
    if (puck.trail.length > TRAIL_MAX) puck.trail.shift();

    // шаг
    puck.x += puck.vx * dt;
    puck.y += puck.vy * dt;

    // === Отбивание до линии ворот: если шайба “влетела” в вратаря — рикошет ===
    // Проверяем по направлению: к верхнему только если летит вверх, к нижнему если летит вниз.
    if (puck.vy < 0 && puckHitsGoalie("top")){
      bounceFromGoalie("top");
    } else if (puck.vy > 0 && puckHitsGoalie("bottom")){
      bounceFromGoalie("bottom");
    }

    // сопротивление
    const drag = Math.max(0.0, 1.0 - dt*0.10);
    puck.vx *= drag;
    puck.vy *= drag;

    // борта по X
    const left = rink.x + 18;
    const right = rink.x + rink.w - 18;
    if (puck.x < left){ puck.x = left; puck.vx = Math.abs(puck.vx) * 0.85; }
    if (puck.x > right){ puck.x = right; puck.vx = -Math.abs(puck.vx) * 0.85; }

    checkGoalOrOut();
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

  // управление: тап=выбор, свайп=бросок
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

    if (dist(touch.startX, touch.startY, x, y) > MOVE_THRESHOLD) touch.moved = true;
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
    const heldMs = performance.now() - touch.startT;

    const controlled = getControlled();

    // тап: выбор игрока
    if (!touch.moved && heldMs < 260){
      const picked = playerAt(x,y);
      if (picked){
        state.controlledId = picked.id;
        puck.owner = picked;
        puck.lastTouch = picked.club.key;
        syncPuckToOwner();
      }
    }

    // свайп: бросок
    if (touch.moved){
      const swipeLen = dist(touch.startX, touch.startY, x, y);
      if (swipeLen >= SHOT_THRESHOLD){
        shootBySwipe(controlled, touch.startX, touch.startY, x, y);
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

  function tickGoalies(t){
    const sway = Math.sin(t*0.9) * (goals.mouthW * 0.18);
    goalies.top.x = goalies.top.baseX + sway;
    goalies.bottom.x = goalies.bottom.baseX - sway;
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

    tickGoalies(t);

    if (puck.owner){
      syncPuckToOwner();
    } else {
      updateShotPuck(dt);
    }

    ctx.clearRect(0,0,W,H);
    drawStands();
    drawIce();

    // top “смотрит вниз”, bottom “смотрит вверх”
    drawGoalHorizontal(goals.top.x, goals.top.y, true);
    drawGoalHorizontal(goals.bottom.x, goals.bottom.y, false);

    drawGoalie("top");
    drawGoalie("bottom");

    drawPuckTrail();
    drawPuckNow();

    drawPlayer(players[1], t);
    drawPlayer(players[0], t + 0.25);

    drawCenterMessage();
    updateScoreboard();

    requestAnimationFrame(tick);
  }

  loadImage("assets/loko.png", img => state.logos.loko = img);
  loadImage("assets/spartak.png", img => state.logos.spartak = img);
  loadImage("assets/face_loko.png", img => state.faces.loko = img);
  loadImage("assets/face_spartak.png", img => state.faces.spartak = img);

  resizeCanvas();
  layout(false);
  reset();
  requestAnimationFrame(tick);
})();
"""

def write(path: Path, content: str):
    path.write_text(content, encoding="utf-8")
    print(f"✓ wrote {path.name}")

def cleanup_old(prefix: str, keep: int = 6):
    files = sorted(OUT_DIR.glob(f"{prefix}.*.*"))
    if len(files) > keep:
        for p in files[:-keep]:
            try:
                p.unlink()
            except Exception:
                pass

def main():
    write(OUT_DIR / "index.html", INDEX_HTML)
    write(OUT_DIR / CSS_NAME, STYLE_CSS)
    write(OUT_DIR / JS_NAME, APP_JS)

    readme = ASSETS_DIR / "README.txt"
    if not readme.exists():
        readme.write_text(
            "Положи сюда файлы:\n"
            "  loko.png\n"
            "  spartak.png\n"
            "  face_loko.png\n"
            "  face_spartak.png\n",
            encoding="utf-8",
        )

    cleanup_old("style", keep=6)
    cleanup_old("app", keep=6)

    print(f"\nBUILD={BUILD}")
    print(f"Подключены: {CSS_NAME} и {JS_NAME}")

if __name__ == "__main__":
    main()
