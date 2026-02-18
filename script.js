const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const pauseBtn = document.getElementById("pauseBtn");

const levelValue = document.getElementById("levelValue");
const scoreValue = document.getElementById("scoreValue");
const livesValue = document.getElementById("livesValue");

const keyboard = { left: false, right: false, jump: false };
const touch = { left: false, right: false, jump: false };
const touchCounts = { left: 0, right: 0, jump: 0 };
const activePointers = new Map();

const levels = [
  {
    start: { x: 56, y: 448 },
    platforms: [
      { x: 0, y: 500, w: 960, h: 40 },
      { x: 130, y: 430, w: 150, h: 20 },
      { x: 350, y: 360, w: 180, h: 20 },
      { x: 610, y: 300, w: 150, h: 20 },
      { x: 790, y: 236, w: 120, h: 20 },
    ],
    coins: [
      { x: 200, y: 395, r: 10, collected: false },
      { x: 430, y: 325, r: 10, collected: false },
      { x: 680, y: 265, r: 10, collected: false },
      { x: 847, y: 202, r: 10, collected: false },
    ],
    enemies: [{ x: 455, y: 468, w: 34, h: 32, minX: 350, maxX: 690, speed: 120, dir: 1 }],
    flag: { x: 904, y: 166, w: 20, h: 70 },
  },
  {
    start: { x: 42, y: 448 },
    platforms: [
      { x: 0, y: 500, w: 960, h: 40 },
      { x: 130, y: 430, w: 120, h: 20 },
      { x: 280, y: 350, w: 140, h: 20 },
      { x: 470, y: 420, w: 150, h: 20 },
      { x: 650, y: 330, w: 120, h: 20 },
      { x: 810, y: 260, w: 130, h: 20 },
    ],
    coins: [
      { x: 185, y: 394, r: 10, collected: false },
      { x: 350, y: 314, r: 10, collected: false },
      { x: 545, y: 384, r: 10, collected: false },
      { x: 715, y: 294, r: 10, collected: false },
      { x: 872, y: 224, r: 10, collected: false },
    ],
    enemies: [
      { x: 220, y: 468, w: 34, h: 32, minX: 100, maxX: 360, speed: 140, dir: 1 },
      { x: 552, y: 388, w: 34, h: 32, minX: 470, maxX: 620, speed: 100, dir: -1 },
    ],
    flag: { x: 918, y: 190, w: 20, h: 70 },
  },
  {
    start: { x: 42, y: 448 },
    platforms: [
      { x: 0, y: 500, w: 960, h: 40 },
      { x: 110, y: 425, w: 120, h: 20 },
      { x: 255, y: 365, w: 120, h: 20 },
      { x: 400, y: 305, w: 120, h: 20 },
      { x: 545, y: 245, w: 120, h: 20 },
      { x: 690, y: 305, w: 120, h: 20 },
      { x: 835, y: 245, w: 120, h: 20 },
    ],
    coins: [
      { x: 170, y: 390, r: 10, collected: false },
      { x: 315, y: 330, r: 10, collected: false },
      { x: 460, y: 270, r: 10, collected: false },
      { x: 605, y: 210, r: 10, collected: false },
      { x: 750, y: 270, r: 10, collected: false },
      { x: 895, y: 210, r: 10, collected: false },
    ],
    enemies: [
      { x: 300, y: 468, w: 34, h: 32, minX: 40, maxX: 360, speed: 160, dir: -1 },
      { x: 470, y: 273, w: 34, h: 32, minX: 400, maxX: 520, speed: 120, dir: 1 },
      { x: 865, y: 213, w: 34, h: 32, minX: 835, maxX: 955, speed: 90, dir: -1 },
    ],
    flag: { x: 932, y: 175, w: 20, h: 70 },
  },
];

const state = {
  running: false,
  paused: false,
  finished: false,
  hasStarted: false,
  score: 0,
  lives: 3,
  currentLevel: 0,
};

const player = {
  x: 0,
  y: 0,
  w: 38,
  h: 50,
  vx: 0,
  vy: 0,
  onGround: false,
  jumpHeld: false,
  facing: 1,
  speed: 280,
  jumpForce: 670,
  gravity: 1700,
  invuln: 0,
};

let level = cloneLevel(0);
let lastTime = performance.now();

function cloneLevel(index) {
  const base = levels[index];
  return {
    start: { ...base.start },
    platforms: base.platforms.map((p) => ({ ...p })),
    coins: base.coins.map((c) => ({ ...c })),
    enemies: base.enemies.map((e) => ({ ...e })),
    flag: { ...base.flag },
  };
}

function isDown(key) {
  return keyboard[key] || touch[key];
}

function resetTouchKey(key) {
  touchCounts[key] = 0;
  touch[key] = false;
}

function applyTouchButtonHandlers(button) {
  const key = button.dataset.key;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    activePointers.set(event.pointerId, key);
    touchCounts[key] += 1;
    touch[key] = true;
    button.classList.add("active");
  });

  const release = (event) => {
    if (!activePointers.has(event.pointerId)) return;
    const mappedKey = activePointers.get(event.pointerId);
    activePointers.delete(event.pointerId);
    touchCounts[mappedKey] = Math.max(0, touchCounts[mappedKey] - 1);
    touch[mappedKey] = touchCounts[mappedKey] > 0;
    button.classList.remove("active");
  };

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("pointerleave", release);
}

function setOverlay(title, text, buttonLabel) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startBtn.textContent = buttonLabel;
  overlay.classList.add("visible");
}

function hideOverlay() {
  overlay.classList.remove("visible");
}

function updateHud() {
  levelValue.textContent = String(state.currentLevel + 1);
  scoreValue.textContent = String(state.score);
  livesValue.textContent = String(state.lives);
}

function loadLevel(index, resetPlayerStats = false) {
  level = cloneLevel(index);
  if (resetPlayerStats) {
    player.vx = 0;
    player.vy = 0;
  }
  player.x = level.start.x;
  player.y = level.start.y;
  player.onGround = false;
  player.jumpHeld = false;
  player.invuln = 0;
}

function startGame() {
  state.running = true;
  state.paused = false;
  state.finished = false;
  state.hasStarted = true;
  state.currentLevel = 0;
  state.score = 0;
  state.lives = 3;
  loadLevel(0, true);
  updateHud();
  hideOverlay();
}

function respawn() {
  player.x = level.start.x;
  player.y = level.start.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.jumpHeld = false;
  player.invuln = 1.2;
}

function loseLife() {
  if (player.invuln > 0) return;
  state.lives -= 1;
  updateHud();
  if (state.lives <= 0) {
    state.running = false;
    state.finished = true;
    setOverlay("Game Over", `Final score: ${state.score}`, "Play Again");
    return;
  }
  respawn();
}

function winGame() {
  state.running = false;
  state.finished = true;
  setOverlay("You Win!", `Total score: ${state.score}`, "Play Again");
}

function nextLevel() {
  state.currentLevel += 1;
  if (state.currentLevel >= levels.length) {
    winGame();
    return;
  }
  loadLevel(state.currentLevel, true);
  updateHud();
}

function togglePause() {
  if (state.finished || !state.hasStarted) return;
  state.paused = !state.paused;
  state.running = !state.paused;
  if (state.paused) {
    setOverlay("Paused", "Press Continue to keep playing.", "Continue");
  } else {
    hideOverlay();
  }
}

function keyToControl(key) {
  const lower = key.toLowerCase();
  if (lower === "a" || key === "ArrowLeft") return "left";
  if (lower === "d" || key === "ArrowRight") return "right";
  if (lower === "w" || key === "ArrowUp" || key === " ") return "jump";
  return null;
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRectOverlap(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  return dx * dx + dy * dy <= circle.r * circle.r;
}

function resolveHorizontal(previousX) {
  for (const platform of level.platforms) {
    const overlapY = player.y + player.h > platform.y && player.y < platform.y + platform.h;
    const overlapX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
    if (!overlapX || !overlapY) continue;
    if (previousX + player.w <= platform.x) {
      player.x = platform.x - player.w;
      player.vx = 0;
    } else if (previousX >= platform.x + platform.w) {
      player.x = platform.x + platform.w;
      player.vx = 0;
    }
  }
}

function resolveVertical(previousY) {
  player.onGround = false;
  for (const platform of level.platforms) {
    const overlapX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
    const overlapY = player.y + player.h > platform.y && player.y < platform.y + platform.h;
    if (!overlapX || !overlapY) continue;
    if (previousY + player.h <= platform.y) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
    } else if (previousY >= platform.y + platform.h) {
      player.y = platform.y + platform.h;
      player.vy = 0;
    }
  }
}

function update(dt) {
  if (player.invuln > 0) {
    player.invuln = Math.max(0, player.invuln - dt);
  }

  const move = (isDown("left") ? -1 : 0) + (isDown("right") ? 1 : 0);
  const targetVx = move * player.speed;
  player.vx += (targetVx - player.vx) * Math.min(1, dt * 16);
  if (Math.abs(player.vx) < 0.5) player.vx = 0;
  if (move !== 0) player.facing = Math.sign(move);

  if (isDown("jump") && player.onGround && !player.jumpHeld) {
    player.vy = -player.jumpForce;
    player.onGround = false;
    player.jumpHeld = true;
  }
  if (!isDown("jump")) {
    player.jumpHeld = false;
  }

  player.vy += player.gravity * dt;
  if (player.vy > 1300) player.vy = 1300;

  const prevX = player.x;
  player.x += player.vx * dt;
  resolveHorizontal(prevX);

  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }
  if (player.x + player.w > canvas.width) {
    player.x = canvas.width - player.w;
    player.vx = 0;
  }

  const prevY = player.y;
  player.y += player.vy * dt;
  resolveVertical(prevY);

  if (player.y > canvas.height + 140) {
    loseLife();
    return;
  }

  for (const enemy of level.enemies) {
    enemy.x += enemy.dir * enemy.speed * dt;
    if (enemy.x < enemy.minX) {
      enemy.x = enemy.minX;
      enemy.dir = 1;
    }
    if (enemy.x + enemy.w > enemy.maxX) {
      enemy.x = enemy.maxX - enemy.w;
      enemy.dir = -1;
    }
    if (rectsOverlap(player, enemy)) {
      loseLife();
      return;
    }
  }

  for (const coin of level.coins) {
    if (coin.collected) continue;
    if (circleRectOverlap(coin, player)) {
      coin.collected = true;
      state.score += 10;
      updateHud();
    }
  }

  if (rectsOverlap(player, level.flag)) {
    nextLevel();
  }
}

function drawRoundedRect(x, y, w, h, r) {
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
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  const hue = 200 + state.currentLevel * 12;
  gradient.addColorStop(0, `hsl(${hue}, 84%, 81%)`);
  gradient.addColorStop(1, `hsl(${hue - 22}, 80%, 63%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.38)";
  for (let i = 0; i < 5; i += 1) {
    const x = 80 + i * 190;
    const y = 70 + (i % 2) * 14;
    drawRoundedRect(x, y, 120, 34, 16);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(17, 38, 70, 0.2)";
  for (let i = 0; i < 12; i += 1) {
    const w = 42 + (i % 3) * 22;
    const h = 90 + (i % 4) * 34;
    const x = i * 86;
    const y = canvas.height - 40 - h;
    ctx.fillRect(x, y, w, h);
  }
}

function drawPlatforms() {
  for (const p of level.platforms) {
    const platformGradient = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    platformGradient.addColorStop(0, "#4f98ff");
    platformGradient.addColorStop(1, "#1f5ec0");
    ctx.fillStyle = platformGradient;
    drawRoundedRect(p.x, p.y, p.w, p.h, 7);
    ctx.fill();
  }
}

function drawCoins(time) {
  for (const coin of level.coins) {
    if (coin.collected) continue;
    const bob = Math.sin(time * 0.005 + coin.x * 0.03) * 2;
    const y = coin.y + bob;

    ctx.fillStyle = "#ffd652";
    ctx.beginPath();
    ctx.arc(coin.x, y, coin.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffefb8";
    ctx.beginPath();
    ctx.arc(coin.x - 2, y - 2, coin.r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const enemy of level.enemies) {
    ctx.fillStyle = "#fb5f56";
    drawRoundedRect(enemy.x, enemy.y, enemy.w, enemy.h, 8);
    ctx.fill();

    ctx.fillStyle = "#121212";
    ctx.fillRect(enemy.x + 7, enemy.y + 8, 5, 5);
    ctx.fillRect(enemy.x + enemy.w - 12, enemy.y + 8, 5, 5);
  }
}

function drawFlag() {
  const pole = level.flag;
  ctx.fillStyle = "#24354f";
  ctx.fillRect(pole.x + pole.w * 0.5, pole.y, 4, pole.h);

  ctx.fillStyle = "#ff9d2f";
  ctx.beginPath();
  ctx.moveTo(pole.x + pole.w * 0.5 + 4, pole.y + 8);
  ctx.lineTo(pole.x + pole.w * 0.5 + 36, pole.y + 19);
  ctx.lineTo(pole.x + pole.w * 0.5 + 4, pole.y + 30);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer(time) {
  if (player.invuln > 0 && Math.floor(time * 0.03) % 2 === 0) return;

  const bodyGradient = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.h);
  bodyGradient.addColorStop(0, "#ffb048");
  bodyGradient.addColorStop(1, "#e4761f");
  ctx.fillStyle = bodyGradient;
  drawRoundedRect(player.x, player.y, player.w, player.h, 10);
  ctx.fill();

  ctx.fillStyle = "#fff";
  const eyeOffset = player.facing === 1 ? 20 : 11;
  ctx.beginPath();
  ctx.arc(player.x + eyeOffset, player.y + 16, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#1c1c1c";
  ctx.beginPath();
  ctx.arc(player.x + eyeOffset + (player.facing === 1 ? 1 : -1), player.y + 16, 2.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawLevelLabel() {
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  drawRoundedRect(18, 14, 164, 35, 9);
  ctx.fill();
  ctx.fillStyle = "#0d2748";
  ctx.font = "700 16px Sora";
  ctx.fillText(`Level ${state.currentLevel + 1}`, 32, 37);
}

function render(time = performance.now()) {
  drawBackground();
  drawPlatforms();
  drawCoins(time);
  drawEnemies();
  drawFlag();
  drawPlayer(time);
  drawLevelLabel();
}

function frame(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  if (state.running) {
    update(dt);
  }
  render(now);
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    togglePause();
    return;
  }
  const control = keyToControl(event.key);
  if (!control) return;
  keyboard[control] = true;
  event.preventDefault();
});

window.addEventListener("keyup", (event) => {
  const control = keyToControl(event.key);
  if (!control) return;
  keyboard[control] = false;
  event.preventDefault();
});

startBtn.addEventListener("click", () => {
  if (state.finished || !state.running) {
    if (state.paused) {
      state.paused = false;
      state.running = true;
      hideOverlay();
      return;
    }
    startGame();
  }
});

pauseBtn.addEventListener("click", togglePause);
restartBtn.addEventListener("click", startGame);

for (const button of document.querySelectorAll(".touch-btn")) {
  applyTouchButtonHandlers(button);
}

window.addEventListener("blur", () => {
  keyboard.left = false;
  keyboard.right = false;
  keyboard.jump = false;
  resetTouchKey("left");
  resetTouchKey("right");
  resetTouchKey("jump");
});

updateHud();
setOverlay("Skyline Runner", "Collect coins, avoid bots, and reach the flag.", "Start Game");
render();
requestAnimationFrame(frame);
