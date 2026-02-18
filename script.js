const view = document.getElementById("view");
const ctx = view.getContext("2d");
ctx.imageSmoothingEnabled = true;

const minimap = document.getElementById("minimap");
const minimapCtx = minimap.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const resumeBtn = document.getElementById("resumeBtn");
const restartBtn = document.getElementById("restartBtn");

const levelNameEl = document.getElementById("levelName");
const objectiveEl = document.getElementById("objectiveText");
const killsEl = document.getElementById("killsValue");
const scoreEl = document.getElementById("scoreValue");
const healthValueEl = document.getElementById("healthValue");
const armorValueEl = document.getElementById("armorValue");
const ammoValueEl = document.getElementById("ammoValue");
const keyValueEl = document.getElementById("keyValue");
const healthBar = document.getElementById("healthBar");
const armorBar = document.getElementById("armorBar");
const ammoBar = document.getElementById("ammoBar");
const toastEl = document.getElementById("toast");
const crosshairEl = document.getElementById("crosshair");
const damageVignette = document.getElementById("damageVignette");

const WALLS = new Set(["#", "%", "@"]);

const TAU = Math.PI * 2;
const FOV = Math.PI / 3;
const HALF_FOV = FOV / 2;
const MAX_DEPTH = 26;
const RAY_STRIDE = 2;
const PLAYER_RADIUS = 0.2;
const MOVE_SPEED = 2.9;
const TURN_SPEED = 2.35;
const SPRINT_MULT = 1.58;
const MOUSE_SENS = 0.0022;

const LEVELS = [
  {
    name: "BREACH 01",
    requireKey: true,
    requireClear: false,
    startAngle: 0.03,
    entryText: "Sector 01: find blue keycard and extract.",
    map: `
      ####################
      #S...E..E.#....M..X#
      #.####.##.#.##.##..#
      #....#....#..#..#..#
      #.##.#.##.#..#..#..#
      #..#.#....#..##.#..#
      ##.#.##.#.#.....#..#
      #..#..#.#.#####.#F.#
      #..##.#.#...E.#.#..#
      #.....#..###.#.#...#
      #.#####.#####.#.#..#
      #...T...#.....#.#K.#
      #.#####.#.#####.##.#
      #..E..H.#...R..E...#
      ####################
    `,
  },
  {
    name: "BREACH 02",
    requireKey: true,
    requireClear: true,
    startAngle: -0.08,
    entryText: "Sector 02: neutralize resistance before extraction.",
    map: `
      %%%%%%%%%%%%%%%%%%%%%%
      %S..E#..E.E..F.#....X%
      %.%%.#.%%%%%%%.#.%%..%
      %....#.....#...#..#..%
      %.######.#.#.###..#..%
      %..M...#.#.#...#..#..%
      %%%###.#.#.###.#.##..%
      %....#.#.#...#.#.....%
      %.##.#.#.###.#.###.#.%
      %..#.#...#...#...#.#.%
      %..#.#####.#####.#.#.%
      %..#..B..F..E..#.#.#.%
      %..#####.#####.#.#.#.%
      %..#..H..#..R..#.#K#.%
      %..#E.E..#..F..#..E.#%
      %%%%%%%%%%%%%%%%%%%%%%
    `,
  },
  {
    name: "BREACH 03",
    requireKey: true,
    requireClear: true,
    startAngle: 0.1,
    entryText: "Final sector: wipe all hostiles and escape.",
    map: `
      @@@@@@@@@@@@@@@@@@@@@@
      @S..E.E...#..F.B....X@
      @.#######.#.######.#.@
      @...#.....#......#.#.@
      @.#.#.##########.#.#.@
      @.#.#..E.F..E.#..#.#.@
      @.#.####.####.#.##.#.@
      @.#....#....#.#....#.@
      @.####.####.#.####.#.@
      @..E.#.F..#.#..E..#..@
      @.##.####.#.#####.##.@
      @..#..T...#.....#..#.@
      @@.#.#####.###.#.##.#@
      @E.#...H..B..#.#.R#K.@
      @..######.####.#....#@
      @@@@@@@@@@@@@@@@@@@@@@
    `,
  },
];

const ENEMY_STATS = {
  grunt: { hp: 70, speed: 1.3, damage: 10, cooldown: 1.0, range: 1.05, radius: 0.25, score: 120 },
  fiend: { hp: 52, speed: 1.75, damage: 8, cooldown: 0.75, range: 0.95, radius: 0.23, score: 145 },
  brute: { hp: 130, speed: 0.85, damage: 18, cooldown: 1.32, range: 1.2, radius: 0.33, score: 210 },
};

const game = {
  mode: "menu",
  levelIndex: 0,
  levelKills: 0,
  totalKillsInLevel: 0,
  totalScore: 0,
  totalKillsRun: 0,
  shots: 0,
  hits: 0,
  combo: 0,
  comboTimer: 0,
  toastTimer: 0,
  mapVisible: false,
  shake: 0,
  mouseDelta: 0,
  interactQueued: false,
  promptCooldown: 0,
  timeInRun: 0,
  lastTime: performance.now(),
};

const player = {
  x: 1.5,
  y: 1.5,
  angle: 0,
  health: 100,
  armor: 40,
  clipAmmo: 12,
  reserveAmmo: 72,
  maxClip: 12,
  reloadTimer: 0,
  reloadTransfer: 0,
  keycard: false,
  fireCooldown: 0,
  muzzle: 0,
  bob: 0,
  weaponKick: 0,
  hurt: 0,
  dead: false,
};

const keyState = Object.create(null);
const pointerActionCount = {
  forward: 0,
  backward: 0,
  left: 0,
  right: 0,
  turnLeft: 0,
  turnRight: 0,
  shoot: 0,
};
const touchState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  turnLeft: false,
  turnRight: false,
  shoot: false,
};
const activePointers = new Map();

let currentLevel = null;
let audioCtx = null;
let noisePattern = null;
let ambientNodes = null;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

function normalizeAngle(angle) {
  let value = angle % TAU;
  if (value < 0) value += TAU;
  return value;
}

function parseMap(text) {
  const rows = text
    .trim()
    .split("\n")
    .map((row) => row.trim())
    .filter(Boolean);
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0);
  return rows.map((row) => row.padEnd(width, "#").split(""));
}

function spawnEnemy(type, x, y) {
  const stats = ENEMY_STATS[type];
  return {
    x,
    y,
    type,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    attackCooldownBase: stats.cooldown,
    attackRange: stats.range,
    radius: stats.radius,
    score: stats.score,
    attackCooldown: randomRange(0.2, 0.9),
    alertTime: 0,
    wanderAngle: randomRange(0, TAU),
    wanderTimer: randomRange(0.4, 2.2),
    hitFlash: 0,
    alive: true,
    phase: randomRange(0, TAU),
  };
}

function spawnPickup(type, x, y) {
  return {
    type,
    x,
    y,
    active: true,
    phase: randomRange(0, TAU),
  };
}

function buildLevel(levelDef) {
  const grid = parseMap(levelDef.map);
  let spawn = { x: 1.5, y: 1.5 };
  let exit = { x: grid[0].length - 1.5, y: 1.5 };
  const enemies = [];
  const pickups = [];

  for (let y = 0; y < grid.length; y += 1) {
    for (let x = 0; x < grid[y].length; x += 1) {
      const ch = grid[y][x];
      if (WALLS.has(ch) || ch === ".") continue;
      if (ch === "S") {
        spawn = { x: x + 0.5, y: y + 0.5 };
      } else if (ch === "X") {
        exit = { x: x + 0.5, y: y + 0.5 };
      } else if (ch === "E") {
        enemies.push(spawnEnemy("grunt", x + 0.5, y + 0.5));
      } else if (ch === "F") {
        enemies.push(spawnEnemy("fiend", x + 0.5, y + 0.5));
      } else if (ch === "B") {
        enemies.push(spawnEnemy("brute", x + 0.5, y + 0.5));
      } else if (ch === "M") {
        pickups.push(spawnPickup("ammo", x + 0.5, y + 0.5));
      } else if (ch === "H") {
        pickups.push(spawnPickup("health", x + 0.5, y + 0.5));
      } else if (ch === "R") {
        pickups.push(spawnPickup("armor", x + 0.5, y + 0.5));
      } else if (ch === "K") {
        pickups.push(spawnPickup("key", x + 0.5, y + 0.5));
      } else if (ch === "T") {
        pickups.push(spawnPickup("treasure", x + 0.5, y + 0.5));
      }
      grid[y][x] = ".";
    }
  }

  return {
    name: levelDef.name,
    requireKey: levelDef.requireKey,
    requireClear: levelDef.requireClear,
    startAngle: levelDef.startAngle,
    entryText: levelDef.entryText,
    width: grid[0].length,
    height: grid.length,
    grid,
    spawn,
    exit,
    enemies,
    pickups,
    totalEnemies: enemies.length,
  };
}

function ensureAudio() {
  if (!audioCtx) {
    const AudioApi = window.AudioContext || window.webkitAudioContext;
    if (!AudioApi) return;
    audioCtx = new AudioApi();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
}

function beep({ freq = 240, duration = 0.08, gain = 0.03, type = "square", slide = 0 }) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const amp = audioCtx.createGain();
  const t0 = audioCtx.currentTime;

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide !== 0) {
    osc.frequency.linearRampToValueAtTime(freq + slide, t0 + duration);
  }

  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  osc.connect(amp);
  amp.connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function playShot() {
  beep({ freq: 145, duration: 0.07, gain: 0.052, type: "square", slide: 75 });
  beep({ freq: 92, duration: 0.05, gain: 0.032, type: "triangle", slide: -40 });
}

function playHit() {
  beep({ freq: 410, duration: 0.04, gain: 0.03, type: "triangle", slide: -90 });
}

function playPickup() {
  beep({ freq: 590, duration: 0.05, gain: 0.03, type: "sine", slide: 150 });
}

function playDamage() {
  beep({ freq: 115, duration: 0.12, gain: 0.035, type: "sawtooth", slide: -55 });
}

function playEmpty() {
  beep({ freq: 210, duration: 0.03, gain: 0.015, type: "square", slide: -25 });
}

function playReloadStart() {
  beep({ freq: 240, duration: 0.06, gain: 0.02, type: "triangle", slide: 70 });
  beep({ freq: 120, duration: 0.09, gain: 0.015, type: "square", slide: -20 });
}

function playReloadEnd() {
  beep({ freq: 690, duration: 0.04, gain: 0.02, type: "sine", slide: 110 });
}

function playKill() {
  beep({ freq: 180, duration: 0.06, gain: 0.028, type: "sawtooth", slide: 180 });
}

function playGate() {
  beep({ freq: 420, duration: 0.08, gain: 0.02, type: "triangle", slide: 120 });
}

function startAmbientLoop() {
  if (!audioCtx || ambientNodes) return;
  const oscA = audioCtx.createOscillator();
  const oscB = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  oscA.type = "sawtooth";
  oscB.type = "triangle";
  oscA.frequency.value = 47;
  oscB.frequency.value = 83;
  filter.type = "lowpass";
  filter.frequency.value = 320;
  gain.gain.value = 0.0055;

  oscA.connect(filter);
  oscB.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  oscA.start();
  oscB.start();
  ambientNodes = { oscA, oscB, gain, filter };
}

function stopAmbientLoop() {
  if (!ambientNodes) return;
  const { oscA, oscB, gain, filter } = ambientNodes;
  try {
    oscA.stop();
    oscB.stop();
  } catch (_) {
    // ignore stop errors
  }
  oscA.disconnect();
  oscB.disconnect();
  gain.disconnect();
  filter.disconnect();
  ambientNodes = null;
}

function showToast(text, duration = 1.6) {
  game.toastTimer = duration;
  toastEl.textContent = text;
  toastEl.classList.add("visible");
}

function hideToast() {
  game.toastTimer = 0;
  toastEl.classList.remove("visible");
}

function fillRoundedRect(x, y, w, h, r) {
  const radius = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

function isWallTile(tx, ty) {
  if (!currentLevel) return true;
  if (tx < 0 || ty < 0 || tx >= currentLevel.width || ty >= currentLevel.height) return true;
  return WALLS.has(currentLevel.grid[ty][tx]);
}

function isBlocked(x, y) {
  const checks = [
    [x - PLAYER_RADIUS, y - PLAYER_RADIUS],
    [x + PLAYER_RADIUS, y - PLAYER_RADIUS],
    [x - PLAYER_RADIUS, y + PLAYER_RADIUS],
    [x + PLAYER_RADIUS, y + PLAYER_RADIUS],
  ];
  for (const [px, py] of checks) {
    if (isWallTile(Math.floor(px), Math.floor(py))) return true;
  }
  return false;
}

function movePlayer(dx, dy) {
  const nx = player.x + dx;
  if (!isBlocked(nx, player.y)) player.x = nx;
  const ny = player.y + dy;
  if (!isBlocked(player.x, ny)) player.y = ny;
}

function lineOfSight(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / 0.12));
  for (let i = 1; i < steps; i += 1) {
    const x = ax + (dx * i) / steps;
    const y = ay + (dy * i) / steps;
    if (isWallTile(Math.floor(x), Math.floor(y))) return false;
  }
  return true;
}
function castRay(rayAngle, maxDepth = MAX_DEPTH) {
  const rayDirX = Math.cos(rayAngle);
  const rayDirY = Math.sin(rayAngle);
  let mapX = Math.floor(player.x);
  let mapY = Math.floor(player.y);

  const deltaDistX = Math.abs(1 / (Math.abs(rayDirX) < 1e-9 ? 1e-9 : rayDirX));
  const deltaDistY = Math.abs(1 / (Math.abs(rayDirY) < 1e-9 ? 1e-9 : rayDirY));

  let stepX;
  let stepY;
  let sideDistX;
  let sideDistY;

  if (rayDirX < 0) {
    stepX = -1;
    sideDistX = (player.x - mapX) * deltaDistX;
  } else {
    stepX = 1;
    sideDistX = (mapX + 1 - player.x) * deltaDistX;
  }

  if (rayDirY < 0) {
    stepY = -1;
    sideDistY = (player.y - mapY) * deltaDistY;
  } else {
    stepY = 1;
    sideDistY = (mapY + 1 - player.y) * deltaDistY;
  }

  let hit = false;
  let side = 0;
  let dist = 0;
  let wallType = "#";
  let steps = 0;

  while (!hit && dist < maxDepth && steps < 2048) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    if (mapX < 0 || mapY < 0 || mapX >= currentLevel.width || mapY >= currentLevel.height) {
      hit = true;
      wallType = "#";
      break;
    }

    if (WALLS.has(currentLevel.grid[mapY][mapX])) {
      hit = true;
      wallType = currentLevel.grid[mapY][mapX];
    }

    dist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
    steps += 1;
  }

  if (hit) {
    if (side === 0) {
      dist = (mapX - player.x + (1 - stepX) / 2) / (Math.abs(rayDirX) < 1e-9 ? 1e-9 : rayDirX);
    } else {
      dist = (mapY - player.y + (1 - stepY) / 2) / (Math.abs(rayDirY) < 1e-9 ? 1e-9 : rayDirY);
    }
  } else {
    dist = maxDepth;
  }

  if (!Number.isFinite(dist) || dist <= 0) dist = 0.001;
  dist = Math.min(dist, maxDepth);

  let wallX = side === 0 ? player.y + dist * rayDirY : player.x + dist * rayDirX;
  wallX -= Math.floor(wallX);

  return { dist, wallType, side, wallX };
}

function countAliveEnemies() {
  return currentLevel.enemies.filter((enemy) => enemy.alive).length;
}

function updateObjective() {
  if (!currentLevel) return;
  const tasks = [];
  if (currentLevel.requireKey && !player.keycard) tasks.push("Find keycard");
  if (currentLevel.requireClear && game.levelKills < game.totalKillsInLevel) {
    tasks.push(`Eliminate hostiles (${game.levelKills}/${game.totalKillsInLevel})`);
  }
  tasks.push("Reach extraction gate");
  objectiveEl.textContent = tasks.join(" | ");
}

function updateHud() {
  healthValueEl.textContent = String(Math.max(0, Math.ceil(player.health)));
  armorValueEl.textContent = String(Math.max(0, Math.ceil(player.armor)));
  ammoValueEl.textContent = `${Math.max(0, player.clipAmmo)} / ${Math.max(0, player.reserveAmmo)}`;
  scoreEl.textContent = String(game.totalScore);
  killsEl.textContent = `${game.levelKills} / ${game.totalKillsInLevel}`;
  keyValueEl.textContent = player.keycard ? "Yes" : "No";
  keyValueEl.style.color = player.keycard ? "#9bff74" : "#ff8aa5";
  healthBar.style.width = `${clamp(player.health, 0, 100)}%`;
  armorBar.style.width = `${clamp(player.armor, 0, 100)}%`;
  ammoBar.style.width = `${clamp((player.clipAmmo / player.maxClip) * 100, 0, 100)}%`;
}

function setOverlay(options) {
  overlayTitle.textContent = options.title;
  overlayText.textContent = options.text;
  startBtn.textContent = options.startLabel || "Start Mission";
  startBtn.classList.toggle("hidden", options.showStart === false);
  resumeBtn.classList.toggle("hidden", !options.showResume);
  overlay.classList.add("visible");
}

function hideOverlay() {
  overlay.classList.remove("visible");
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function resetRunState() {
  game.levelIndex = 0;
  game.levelKills = 0;
  game.totalKillsInLevel = 0;
  game.totalScore = 0;
  game.totalKillsRun = 0;
  game.shots = 0;
  game.hits = 0;
  game.combo = 0;
  game.comboTimer = 0;
  game.timeInRun = 0;
  player.health = 100;
  player.armor = 40;
  player.clipAmmo = 12;
  player.reserveAmmo = 72;
  player.maxClip = 12;
  player.reloadTimer = 0;
  player.reloadTransfer = 0;
  player.keycard = false;
  player.dead = false;
}

function loadLevel(index, freshRun = false) {
  const def = LEVELS[index];
  currentLevel = buildLevel(def);
  game.levelIndex = index;
  game.levelKills = 0;
  game.totalKillsInLevel = currentLevel.totalEnemies;
  game.promptCooldown = 0;

  if (!freshRun && index > 0) {
    player.health = clamp(player.health + 18, 1, 100);
    player.armor = clamp(player.armor + 12, 0, 100);
    player.reserveAmmo = clamp(player.reserveAmmo + 24, 0, 240);
  }

  player.keycard = false;
  player.x = currentLevel.spawn.x;
  player.y = currentLevel.spawn.y;
  player.angle = currentLevel.startAngle || 0;
  player.fireCooldown = 0;
  player.weaponKick = 0;
  player.muzzle = 0;
  player.bob = 0;
  player.hurt = 0;

  levelNameEl.textContent = def.name;
  updateObjective();
  updateHud();
  showToast(def.entryText, 2.2);
}

function beginRun() {
  ensureAudio();
  startAmbientLoop();
  resetRunState();
  loadLevel(0, true);
  game.mode = "running";
  hideOverlay();
}

function resumeRun() {
  if (game.mode !== "paused") return;
  ensureAudio();
  startAmbientLoop();
  game.mode = "running";
  hideOverlay();
}

function pauseRun() {
  if (game.mode !== "running") return;
  stopAmbientLoop();
  game.mode = "paused";
  setOverlay({
    title: "Paused",
    text: "Press Resume to continue your mission.",
    showStart: false,
    showResume: true,
  });
}

function finishRun() {
  stopAmbientLoop();
  game.mode = "win";
  const accuracy = game.shots > 0 ? Math.round((game.hits / game.shots) * 100) : 0;
  setOverlay({
    title: "Operation Complete",
    text: `Score ${game.totalScore} | Kills ${game.totalKillsRun} | Accuracy ${accuracy}% | Time ${formatTime(game.timeInRun)}`,
    showStart: true,
    startLabel: "Start New Run",
    showResume: false,
  });
}

function failRun() {
  stopAmbientLoop();
  game.mode = "dead";
  player.dead = true;
  setOverlay({
    title: "Mission Failed",
    text: `Final score ${game.totalScore}. Restart and breach again.`,
    showStart: true,
    startLabel: "Retry Run",
    showResume: false,
  });
}

function completeLevel() {
  playGate();
  const bonus = 180 + Math.max(0, Math.round(player.health * 1.6));
  game.totalScore += bonus;
  if (game.levelIndex >= LEVELS.length - 1) {
    finishRun();
    return;
  }
  loadLevel(game.levelIndex + 1);
}

function queueInteract() {
  game.interactQueued = true;
}

function applyDamage(amount) {
  if (player.dead) return;
  const absorbed = Math.min(player.armor, Math.ceil(amount * 0.55));
  player.armor -= absorbed;
  const net = amount - absorbed;
  player.health -= net;
  player.hurt = clamp(player.hurt + 0.65, 0, 1);
  game.shake = clamp(game.shake + 0.32, 0, 1.3);
  playDamage();
  updateHud();
  if (player.health <= 0) {
    player.health = 0;
    updateHud();
    failRun();
  }
}

function handleEnemyKilled(enemy) {
  enemy.alive = false;
  game.levelKills += 1;
  game.totalKillsRun += 1;
  playKill();

  if (game.comboTimer > 0) {
    game.combo += 1;
  } else {
    game.combo = 1;
  }
  game.comboTimer = 2.1;

  const comboBonus = game.combo > 1 ? game.combo * 11 : 0;
  game.totalScore += enemy.score + comboBonus;
  if (comboBonus > 0) showToast(`Combo x${game.combo} +${comboBonus}`, 1.1);

  if (Math.random() < 0.23) {
    const drop = Math.random() < 0.5 ? "ammo" : "health";
    currentLevel.pickups.push(spawnPickup(drop, enemy.x, enemy.y));
  }

  updateObjective();
  updateHud();
}

function startReload() {
  if (game.mode !== "running") return false;
  if (player.reloadTimer > 0) return false;
  if (player.clipAmmo >= player.maxClip) return false;
  if (player.reserveAmmo <= 0) {
    playEmpty();
    showToast("No reserve ammo", 0.8);
    return false;
  }

  const need = player.maxClip - player.clipAmmo;
  player.reloadTransfer = Math.min(need, player.reserveAmmo);
  if (player.reloadTransfer <= 0) return false;

  ensureAudio();
  player.reloadTimer = 1.0;
  playReloadStart();
  showToast("Reloading...", 0.75);
  return true;
}

function tryShoot() {
  if (game.mode !== "running") return;
  if (player.fireCooldown > 0) return;
  if (player.reloadTimer > 0) return;

  player.fireCooldown = 0.16;
  player.weaponKick = 1;
  player.muzzle = 0.09;
  game.shake = clamp(game.shake + 0.12, 0, 1.3);
  game.shots += 1;

  if (player.clipAmmo <= 0) {
    playEmpty();
    showToast("Clip empty (R to reload)", 0.8);
    return;
  }

  ensureAudio();
  player.clipAmmo -= 1;
  playShot();

  const spread = randomRange(-0.018, 0.018);
  const rayAngle = player.angle + spread;
  const rayDirX = Math.cos(rayAngle);
  const rayDirY = Math.sin(rayAngle);
  const wallHit = castRay(rayAngle).dist;

  let bestEnemy = null;
  let bestDist = wallHit;

  for (const enemy of currentLevel.enemies) {
    if (!enemy.alive) continue;
    const vx = enemy.x - player.x;
    const vy = enemy.y - player.y;
    const t = vx * rayDirX + vy * rayDirY;
    if (t <= 0 || t >= bestDist) continue;
    const perp = Math.abs(vx * rayDirY - vy * rayDirX);
    if (perp <= enemy.radius + 0.02) {
      bestDist = t;
      bestEnemy = enemy;
    }
  }

  if (bestEnemy) {
    game.hits += 1;
    const base = randomInt(26, 42);
    const damage = bestEnemy.type === "brute" ? Math.round(base * 0.82) : base;
    bestEnemy.hp -= damage;
    bestEnemy.hitFlash = 0.15;
    game.totalScore += 8;
    playHit();
    if (bestEnemy.hp <= 0) handleEnemyKilled(bestEnemy);
  }

  updateHud();
}
function updatePickups() {
  for (const pickup of currentLevel.pickups) {
    if (!pickup.active) continue;
    const dist = Math.hypot(player.x - pickup.x, player.y - pickup.y);
    if (dist > 0.58) continue;

    pickup.active = false;
    if (pickup.type === "health") {
      if (player.health < 100) {
        player.health = clamp(player.health + 28, 0, 100);
        showToast("Med kit +28");
      } else {
        game.totalScore += 35;
        showToast("Bonus +35");
      }
    } else if (pickup.type === "armor") {
      player.armor = clamp(player.armor + 26, 0, 100);
      showToast("Armor +26");
    } else if (pickup.type === "ammo") {
      player.reserveAmmo = clamp(player.reserveAmmo + 24, 0, 240);
      showToast("Ammo +24");
    } else if (pickup.type === "key") {
      player.keycard = true;
      showToast("Blue keycard acquired");
      updateObjective();
    } else if (pickup.type === "treasure") {
      game.totalScore += 220;
      showToast("Artifact secured +220");
    }
    playPickup();
    updateHud();
  }
}

function updateEnemies(dt) {
  for (const enemy of currentLevel.enemies) {
    if (!enemy.alive) continue;

    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);

    const toPlayerX = player.x - enemy.x;
    const toPlayerY = player.y - enemy.y;
    const dist = Math.hypot(toPlayerX, toPlayerY);
    const seesPlayer = dist < 11.5 && lineOfSight(enemy.x, enemy.y, player.x, player.y);

    if (seesPlayer) {
      enemy.alertTime = 1.5;
    } else {
      enemy.alertTime = Math.max(0, enemy.alertTime - dt);
    }

    if (enemy.alertTime > 0) {
      const angle = Math.atan2(toPlayerY, toPlayerX);
      const speedMult = dist > enemy.attackRange ? 1 : 0;
      const step = enemy.speed * speedMult * dt;
      const mx = Math.cos(angle) * step;
      const my = Math.sin(angle) * step;

      const ex = enemy.x + mx;
      if (!isWallTile(Math.floor(ex), Math.floor(enemy.y))) enemy.x = ex;
      const ey = enemy.y + my;
      if (!isWallTile(Math.floor(enemy.x), Math.floor(ey))) enemy.y = ey;

      if (dist <= enemy.attackRange && enemy.attackCooldown <= 0 && seesPlayer) {
        enemy.attackCooldown = enemy.attackCooldownBase;
        applyDamage(enemy.damage + randomInt(-2, 2));
      }
    } else {
      enemy.wanderTimer -= dt;
      if (enemy.wanderTimer <= 0) {
        enemy.wanderTimer = randomRange(0.6, 2.1);
        enemy.wanderAngle += randomRange(-1.1, 1.1);
      }
      const step = enemy.speed * 0.22 * dt;
      const mx = Math.cos(enemy.wanderAngle) * step;
      const my = Math.sin(enemy.wanderAngle) * step;

      const ex = enemy.x + mx;
      if (!isWallTile(Math.floor(ex), Math.floor(enemy.y))) enemy.x = ex;
      const ey = enemy.y + my;
      if (!isWallTile(Math.floor(enemy.x), Math.floor(ey))) enemy.y = ey;
    }
  }
}

function tryExit() {
  const ex = currentLevel.exit.x;
  const ey = currentLevel.exit.y;
  const dist = Math.hypot(player.x - ex, player.y - ey);
  if (dist > 1.05) return;

  if (!game.interactQueued) {
    if (game.promptCooldown <= 0) {
      showToast("Press E to use extraction gate", 0.7);
      game.promptCooldown = 1.1;
    }
    return;
  }

  if (currentLevel.requireKey && !player.keycard) {
    showToast("Extraction locked: keycard required");
    return;
  }

  if (currentLevel.requireClear && countAliveEnemies() > 0) {
    showToast("Extraction denied: hostiles remain");
    return;
  }

  completeLevel();
}

function updatePlayer(dt) {
  const turnInput =
    (keyState.ArrowRight ? 1 : 0) -
    (keyState.ArrowLeft ? 1 : 0) +
    (touchState.turnRight ? 1 : 0) -
    (touchState.turnLeft ? 1 : 0);

  player.angle += turnInput * TURN_SPEED * dt + game.mouseDelta * MOUSE_SENS;
  player.angle = normalizeAngle(player.angle);
  game.mouseDelta = 0;

  const forward = (keyState.KeyW || touchState.forward ? 1 : 0) - (keyState.KeyS || touchState.backward ? 1 : 0);
  const strafe = (keyState.KeyD || touchState.right ? 1 : 0) - (keyState.KeyA || touchState.left ? 1 : 0);
  const sprint = keyState.ShiftLeft || keyState.ShiftRight;

  let movement = Math.hypot(forward, strafe);
  if (movement > 0) {
    const speed = MOVE_SPEED * (sprint ? SPRINT_MULT : 1);
    const nx = forward / movement;
    const ny = strafe / movement;
    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const sideX = Math.cos(player.angle + Math.PI / 2);
    const sideY = Math.sin(player.angle + Math.PI / 2);
    const moveX = (dirX * nx + sideX * ny) * speed * dt;
    const moveY = (dirY * nx + sideY * ny) * speed * dt;
    movePlayer(moveX, moveY);
    player.bob += dt * (sprint ? 12.5 : 9);
  }
}

function projectSprite(x, y) {
  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  const planeX = -dirY * Math.tan(HALF_FOV);
  const planeY = dirX * Math.tan(HALF_FOV);
  const relX = x - player.x;
  const relY = y - player.y;
  const invDet = 1 / (planeX * dirY - dirX * planeY);
  const transformX = invDet * (dirY * relX - dirX * relY);
  const transformY = invDet * (-planeY * relX + planeX * relY);
  if (transformY <= 0.05) return null;
  const screenX = (view.width / 2) * (1 + transformX / transformY);
  return { transformX, transformY, screenX };
}

function wallColor(type, side, dist, wallX, time) {
  let base = [95, 90, 125];
  if (type === "%") base = [74, 110, 150];
  if (type === "@") base = [135, 65, 120];

  let shade = 1 / (1 + dist * 0.16);
  if (side === 1) shade *= 0.74;
  shade *= 0.95 + Math.sin(time * 0.0009 + wallX * 9) * 0.05;
  shade = clamp(shade, 0.12, 1);

  const r = Math.floor(base[0] * shade);
  const g = Math.floor(base[1] * shade);
  const b = Math.floor(base[2] * shade);
  return `rgb(${r}, ${g}, ${b})`;
}

function drawBackground(time) {
  const horizon = view.height * 0.5;
  const skyGradient = ctx.createLinearGradient(0, 0, 0, horizon);
  skyGradient.addColorStop(0, "#0d1024");
  skyGradient.addColorStop(0.7, "#1e1632");
  skyGradient.addColorStop(1, "#2f1d35");
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, view.width, horizon);

  const floorGradient = ctx.createLinearGradient(0, horizon, 0, view.height);
  floorGradient.addColorStop(0, "#28151f");
  floorGradient.addColorStop(1, "#090a12");
  ctx.fillStyle = floorGradient;
  ctx.fillRect(0, horizon, view.width, view.height - horizon);

  ctx.fillStyle = "rgba(255, 80, 128, 0.16)";
  ctx.fillRect(0, horizon - 6, view.width, 12);

  if (noisePattern) {
    ctx.globalAlpha = 0.07;
    const ox = (time * 0.012) % 64;
    const oy = (time * 0.009) % 64;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = noisePattern;
    ctx.fillRect(0, 0, view.width + 64, view.height + 64);
    ctx.translate(ox, oy);
    ctx.globalAlpha = 1;
  }
}

function drawWalls(time) {
  const depthBuffer = new Float32Array(Math.ceil(view.width / RAY_STRIDE));
  for (let x = 0, i = 0; x < view.width; x += RAY_STRIDE, i += 1) {
    const cameraX = (2 * (x + RAY_STRIDE * 0.5)) / view.width - 1;
    const rayAngle = player.angle + Math.atan(cameraX * Math.tan(HALF_FOV));
    const hit = castRay(rayAngle);
    const correctedDist = Math.max(0.001, hit.dist * Math.cos(rayAngle - player.angle));
    depthBuffer[i] = correctedDist;

    const lineHeight = Math.min(view.height * 1.8, view.height / correctedDist);
    const drawStart = view.height * 0.5 - lineHeight * 0.5;
    const color = wallColor(hit.wallType, hit.side, correctedDist, hit.wallX, time);

    ctx.fillStyle = color;
    ctx.fillRect(x, drawStart, RAY_STRIDE + 1, lineHeight);

    if ((Math.floor(hit.wallX * 14) + i) % 2 === 0) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
      ctx.fillRect(x, drawStart, RAY_STRIDE + 1, lineHeight);
    }

    ctx.fillStyle = `rgba(255, 255, 255, ${clamp(0.18 - correctedDist * 0.012, 0, 0.18)})`;
    ctx.fillRect(x, drawStart, RAY_STRIDE + 1, 1);
  }
  return depthBuffer;
}
function drawPickupSprite(pickup, depthBuffer, time) {
  const projection = projectSprite(pickup.x, pickup.y);
  if (!projection) return;

  const depthIndex = clamp(Math.floor(projection.screenX / RAY_STRIDE), 0, depthBuffer.length - 1);
  if (projection.transformY > depthBuffer[depthIndex] + 0.06) return;

  const size = clamp((view.height / projection.transformY) * 0.25, 10, 76);
  const x = projection.screenX;
  const y = view.height * 0.56 + Math.sin(time * 0.005 + pickup.phase) * 6 / projection.transformY;
  const glow = ctx.createRadialGradient(x, y, 2, x, y, size * 0.95);

  let core = "#ffd96a";
  let outer = "rgba(255, 217, 106, 0.1)";
  if (pickup.type === "health") {
    core = "#ff6688";
    outer = "rgba(255, 102, 136, 0.12)";
  } else if (pickup.type === "armor") {
    core = "#57d6ff";
    outer = "rgba(87, 214, 255, 0.12)";
  } else if (pickup.type === "ammo") {
    core = "#ffb25f";
    outer = "rgba(255, 178, 95, 0.12)";
  } else if (pickup.type === "key") {
    core = "#92ff72";
    outer = "rgba(146, 255, 114, 0.12)";
  }

  glow.addColorStop(0, core);
  glow.addColorStop(1, outer);
  ctx.globalAlpha = clamp(1 - projection.transformY / 18, 0.25, 0.95);
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, size, 0, TAU);
  ctx.fill();

  ctx.fillStyle = core;
  if (pickup.type === "key") {
    fillRoundedRect(x - size * 0.5, y - size * 0.16, size * 0.72, size * 0.34, 4);
    ctx.beginPath();
    ctx.arc(x + size * 0.28, y, size * 0.15, 0, TAU);
    ctx.fill();
  } else if (pickup.type === "health") {
    ctx.fillRect(x - 3, y - size * 0.3, 6, size * 0.6);
    ctx.fillRect(x - size * 0.3, y - 3, size * 0.6, 6);
  } else if (pickup.type === "armor") {
    fillRoundedRect(x - size * 0.34, y - size * 0.32, size * 0.68, size * 0.64, 5);
  } else {
    fillRoundedRect(x - size * 0.3, y - size * 0.24, size * 0.6, size * 0.48, 5);
  }

  ctx.globalAlpha = 1;
}

function drawEnemySprite(enemy, depthBuffer, time) {
  const projection = projectSprite(enemy.x, enemy.y);
  if (!projection) return;

  const depthIndex = clamp(Math.floor(projection.screenX / RAY_STRIDE), 0, depthBuffer.length - 1);
  if (projection.transformY > depthBuffer[depthIndex] + 0.08) return;

  const scale = enemy.type === "brute" ? 0.95 : 0.82;
  const size = clamp((view.height / projection.transformY) * scale, 24, view.height * 1.05);
  const x = projection.screenX;
  const y = view.height * 0.57 - size * 0.76 + Math.sin(time * 0.006 + enemy.phase) * 3;
  const bodyW = size * (enemy.type === "brute" ? 0.62 : 0.52);
  const bodyH = size * (enemy.type === "brute" ? 0.95 : 0.82);
  const bodyX = x - bodyW * 0.5;
  const bodyY = y;

  let c1 = "#ff4b61";
  let c2 = "#9f163a";
  if (enemy.type === "fiend") {
    c1 = "#ff9a4f";
    c2 = "#9f4313";
  } else if (enemy.type === "brute") {
    c1 = "#d453ff";
    c2 = "#5e1a7f";
  }
  if (enemy.hitFlash > 0) {
    c1 = "#ffffff";
    c2 = "#ff9db0";
  }

  const grad = ctx.createLinearGradient(bodyX, bodyY, bodyX, bodyY + bodyH);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.globalAlpha = clamp(1 - projection.transformY / 20, 0.25, 1);
  ctx.fillStyle = grad;
  fillRoundedRect(bodyX, bodyY, bodyW, bodyH, Math.max(6, bodyW * 0.1));

  const eyeY = bodyY + bodyH * 0.28;
  const eyeSpacing = bodyW * 0.2;
  ctx.fillStyle = "#ffeef3";
  ctx.beginPath();
  ctx.arc(x - eyeSpacing, eyeY, bodyW * 0.09, 0, TAU);
  ctx.arc(x + eyeSpacing, eyeY, bodyW * 0.09, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#111";
  ctx.beginPath();
  ctx.arc(x - eyeSpacing, eyeY, bodyW * 0.04, 0, TAU);
  ctx.arc(x + eyeSpacing, eyeY, bodyW * 0.04, 0, TAU);
  ctx.fill();

  if (projection.transformY < 7) {
    const hpRatio = clamp(enemy.hp / enemy.maxHp, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    fillRoundedRect(bodyX, bodyY - 10, bodyW, 5, 3);
    ctx.fillStyle = "#7dff87";
    fillRoundedRect(bodyX, bodyY - 10, bodyW * hpRatio, 5, 3);
  }

  ctx.globalAlpha = 1;
}

function drawExitBeacon(depthBuffer, time) {
  const projection = projectSprite(currentLevel.exit.x, currentLevel.exit.y);
  if (!projection) return;
  const depthIndex = clamp(Math.floor(projection.screenX / RAY_STRIDE), 0, depthBuffer.length - 1);
  if (projection.transformY > depthBuffer[depthIndex] + 0.2) return;

  const ready = (!currentLevel.requireKey || player.keycard) && (!currentLevel.requireClear || countAliveEnemies() === 0);
  const size = clamp((view.height / projection.transformY) * 0.5, 20, 180);
  const x = projection.screenX;
  const y = view.height * 0.57 - size * 0.75;
  const col = ready ? "102, 255, 146" : "255, 96, 96";

  ctx.globalAlpha = clamp(0.16 + Math.sin(time * 0.006) * 0.06, 0.06, 0.28);
  ctx.fillStyle = `rgba(${col}, 1)`;
  fillRoundedRect(x - size * 0.16, y - size * 0.26, size * 0.32, size * 1.5, size * 0.2);
  ctx.globalAlpha = 1;
}

function drawSprites(depthBuffer, time) {
  const enemies = currentLevel.enemies
    .filter((enemy) => enemy.alive)
    .sort((a, b) => Math.hypot(b.x - player.x, b.y - player.y) - Math.hypot(a.x - player.x, a.y - player.y));
  for (const enemy of enemies) drawEnemySprite(enemy, depthBuffer, time);

  for (const pickup of currentLevel.pickups) {
    if (pickup.active) drawPickupSprite(pickup, depthBuffer, time);
  }
  drawExitBeacon(depthBuffer, time);
}

function drawWeapon(time) {
  const baseX = view.width * 0.5 + Math.sin(player.bob * 0.75) * 8;
  const baseY = view.height * 0.86 + Math.abs(Math.cos(player.bob * 0.75)) * 6 + player.weaponKick * 15;

  const gunW = 210;
  const gunH = 120;
  const x = baseX - gunW / 2;
  const y = baseY - gunH / 2;

  const body = ctx.createLinearGradient(x, y, x, y + gunH);
  body.addColorStop(0, "#58647d");
  body.addColorStop(1, "#212839");
  ctx.fillStyle = body;
  fillRoundedRect(x, y + 22, gunW, gunH, 14);

  ctx.fillStyle = "#3a4459";
  fillRoundedRect(baseX - 42, y - 20, 84, 62, 8);
  ctx.fillStyle = "#141923";
  fillRoundedRect(baseX - 16, y - 52, 32, 58, 8);
  ctx.fillStyle = "#f7c36a";
  fillRoundedRect(baseX - 10, y - 54, 20, 14, 4);

  if (player.muzzle > 0) {
    const radius = 40 + player.muzzle * 160;
    const flash = ctx.createRadialGradient(baseX, y - 58, 0, baseX, y - 58, radius);
    flash.addColorStop(0, "rgba(255, 246, 180, 0.95)");
    flash.addColorStop(0.42, "rgba(255, 157, 66, 0.75)");
    flash.addColorStop(1, "rgba(255, 121, 66, 0)");
    ctx.fillStyle = flash;
    ctx.beginPath();
    ctx.arc(baseX, y - 58, radius, 0, TAU);
    ctx.fill();
  }
}

function drawMinimap() {
  if (!game.mapVisible || !currentLevel) return;

  minimapCtx.clearRect(0, 0, minimap.width, minimap.height);
  minimapCtx.fillStyle = "rgba(6, 10, 20, 0.94)";
  minimapCtx.fillRect(0, 0, minimap.width, minimap.height);

  const sx = minimap.width / currentLevel.width;
  const sy = minimap.height / currentLevel.height;

  for (let y = 0; y < currentLevel.height; y += 1) {
    for (let x = 0; x < currentLevel.width; x += 1) {
      const tile = currentLevel.grid[y][x];
      if (!WALLS.has(tile)) continue;
      minimapCtx.fillStyle = tile === "#" ? "#3d4560" : tile === "%" ? "#355577" : "#5f3d68";
      minimapCtx.fillRect(x * sx, y * sy, sx, sy);
    }
  }

  for (const pickup of currentLevel.pickups) {
    if (!pickup.active) continue;
    minimapCtx.fillStyle = pickup.type === "key" ? "#9bff74" : "#ffbe55";
    minimapCtx.fillRect((pickup.x - 0.16) * sx, (pickup.y - 0.16) * sy, sx * 0.32, sy * 0.32);
  }

  for (const enemy of currentLevel.enemies) {
    if (!enemy.alive) continue;
    minimapCtx.fillStyle = "#ff5f74";
    minimapCtx.beginPath();
    minimapCtx.arc(enemy.x * sx, enemy.y * sy, Math.max(2, sx * 0.16), 0, TAU);
    minimapCtx.fill();
  }

  minimapCtx.fillStyle = "#6dff9f";
  minimapCtx.fillRect((currentLevel.exit.x - 0.2) * sx, (currentLevel.exit.y - 0.2) * sy, sx * 0.4, sy * 0.4);

  minimapCtx.fillStyle = "#5dc7ff";
  minimapCtx.beginPath();
  minimapCtx.arc(player.x * sx, player.y * sy, Math.max(3, sx * 0.2), 0, TAU);
  minimapCtx.fill();

  const endX = (player.x + Math.cos(player.angle) * 0.75) * sx;
  const endY = (player.y + Math.sin(player.angle) * 0.75) * sy;
  minimapCtx.strokeStyle = "#9fe6ff";
  minimapCtx.lineWidth = 2;
  minimapCtx.beginPath();
  minimapCtx.moveTo(player.x * sx, player.y * sy);
  minimapCtx.lineTo(endX, endY);
  minimapCtx.stroke();
}

function render(time) {
  ctx.save();
  if (game.shake > 0) {
    const s = game.shake * 7;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawBackground(time);
  const depthBuffer = drawWalls(time);
  drawSprites(depthBuffer, time);
  drawWeapon(time);
  ctx.restore();

  damageVignette.style.opacity = clamp(player.hurt * 0.9 + (game.mode === "dead" ? 0.65 : 0), 0, 0.85).toFixed(3);
  crosshairEl.style.transform = `scale(${1 + player.weaponKick * 0.22})`;
  drawMinimap();
}

function toggleMap() {
  game.mapVisible = !game.mapVisible;
  minimap.classList.toggle("hidden", !game.mapVisible);
}

function update(dt) {
  game.timeInRun += dt;
  game.promptCooldown = Math.max(0, game.promptCooldown - dt);
  if (game.toastTimer > 0) {
    game.toastTimer -= dt;
    if (game.toastTimer <= 0) hideToast();
  }

  game.comboTimer = Math.max(0, game.comboTimer - dt);
  if (game.comboTimer <= 0) game.combo = 0;

  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  const prevReload = player.reloadTimer;
  player.reloadTimer = Math.max(0, player.reloadTimer - dt);
  if (prevReload > 0 && player.reloadTimer <= 0 && player.reloadTransfer > 0) {
    player.clipAmmo += player.reloadTransfer;
    player.reserveAmmo -= player.reloadTransfer;
    player.reloadTransfer = 0;
    playReloadEnd();
    updateHud();
  }
  player.muzzle = Math.max(0, player.muzzle - dt * 2.8);
  player.weaponKick = lerp(player.weaponKick, 0, clamp(dt * 15, 0, 1));
  player.hurt = Math.max(0, player.hurt - dt * 1.95);
  game.shake = Math.max(0, game.shake - dt * 1.8);

  updatePlayer(dt);

  if (keyState.Space || touchState.shoot || keyState.Mouse0) {
    tryShoot();
  }

  updateEnemies(dt);
  updatePickups();
  tryExit();

  game.interactQueued = false;
}
function isMovementKey(code) {
  return (
    code === "KeyW" ||
    code === "KeyA" ||
    code === "KeyS" ||
    code === "KeyD" ||
    code === "ArrowLeft" ||
    code === "ArrowRight" ||
    code === "ShiftLeft" ||
    code === "ShiftRight" ||
    code === "Space" ||
    code === "KeyE" ||
    code === "KeyM" ||
    code === "KeyR"
  );
}

function addTouchControlListeners() {
  for (const button of document.querySelectorAll("#touchControls button")) {
    const action = button.dataset.action;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      activePointers.set(event.pointerId, action);
      if (action === "interact") {
        queueInteract();
      } else {
        pointerActionCount[action] += 1;
        touchState[action] = pointerActionCount[action] > 0;
      }
      button.classList.add("active");
    });

    const release = (event) => {
      if (!activePointers.has(event.pointerId)) return;
      const mapped = activePointers.get(event.pointerId);
      activePointers.delete(event.pointerId);
      if (mapped !== "interact") {
        pointerActionCount[mapped] = Math.max(0, pointerActionCount[mapped] - 1);
        touchState[mapped] = pointerActionCount[mapped] > 0;
      }
      button.classList.remove("active");
    };

    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("pointerleave", release);
  }
}

function setupInput() {
  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      if (game.mode === "running") pauseRun();
      else if (game.mode === "paused") resumeRun();
      return;
    }

    if (event.code === "KeyM") {
      toggleMap();
      event.preventDefault();
      return;
    }

    if (event.code === "KeyE") {
      queueInteract();
      event.preventDefault();
    }

    if (event.code === "KeyR") {
      startReload();
      event.preventDefault();
      return;
    }

    if (isMovementKey(event.code)) {
      keyState[event.code] = true;
      event.preventDefault();
    } else {
      keyState[event.code] = true;
    }
  });

  window.addEventListener("keyup", (event) => {
    keyState[event.code] = false;
    if (isMovementKey(event.code)) event.preventDefault();
  });

  view.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    keyState.Mouse0 = true;
    if (game.mode === "running" && document.pointerLockElement !== view) {
      view.requestPointerLock();
    }
  });

  window.addEventListener("mouseup", (event) => {
    if (event.button === 0) keyState.Mouse0 = false;
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement === view && game.mode === "running") {
      game.mouseDelta += event.movementX;
    }
  });

  window.addEventListener("blur", () => {
    for (const key of Object.keys(keyState)) keyState[key] = false;
    for (const action of Object.keys(pointerActionCount)) {
      pointerActionCount[action] = 0;
      touchState[action] = false;
    }
    activePointers.clear();
  });
}

function createNoisePattern() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const cctx = c.getContext("2d");
  const image = cctx.createImageData(c.width, c.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = randomInt(10, 70);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = randomInt(20, 70);
  }
  cctx.putImageData(image, 0, 0);
  noisePattern = ctx.createPattern(c, "repeat");
}

function frame(now) {
  const dt = Math.min(0.05, (now - game.lastTime) / 1000);
  game.lastTime = now;

  if (game.mode === "running") {
    update(dt);
  }
  render(now);
  requestAnimationFrame(frame);
}

startBtn.addEventListener("click", () => {
  beginRun();
});

resumeBtn.addEventListener("click", () => {
  resumeRun();
});

restartBtn.addEventListener("click", () => {
  beginRun();
});

setupInput();
addTouchControlListeners();
createNoisePattern();
loadLevel(0, true);
game.mode = "menu";
setOverlay({
  title: "HELLGRID: BREACH",
  text: "Infiltrate sectors, collect keycards, eliminate hostiles, and extract alive.",
  showStart: true,
  startLabel: "Start Mission",
  showResume: false,
});
minimap.classList.add("hidden");
updateHud();
requestAnimationFrame(frame);
