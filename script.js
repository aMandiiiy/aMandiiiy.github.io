// 照片上的移动马赛克：从 DIG5 HW2 的 Processing 草图移植并改造
//  - 鼠标在照片上：马赛克区域缓缓跟着鼠标走（MouseVersion）
//  - 鼠标不在照片上：区域自己慢慢漂移（HW2 的随机游走，放慢了）
//  - 区域不是方块，而是边缘参差、会缓慢变形的一团
//  - 系统开启"减弱动态效果"时：不自己动，只在鼠标经过时出现

const img = document.getElementById("portrait");
const canvas = document.getElementById("mosaic");
const ctx = canvas.getContext("2d");

// ---- 可以调的参数（相对照片大小的比例，照片多大都适配）----
const PIX = 0.032;      // 格子大小，占照片宽度的比例；越小越细
const RADIUS = 0.24;    // 马赛克区域的大致半径
const WOBBLE = 0.35;    // 边缘的不规则程度，0 就是规整的椭圆
const RAGGED = 0.35;    // 边缘那一圈有多"碎"（格子零星缺失），0 就是边缘整齐
const WANDER = 0.18;    // 自己漂移时，每次换方向最远走多远
const DRIFT = 0.012;    // 自己漂移的速度，越小越慢
const FOLLOW = 0.08;    // 跟随鼠标的速度，越小越慢、越"拖"
const TRAIL = 0.12;     // 每帧盖回原图的透明度，越小残影越长（≈ tint(190, 60)）

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let size, pix, radius;
let source;             // 裁成正方形、和画布同尺寸的照片
let pixels;             // 照片像素，用来取格子颜色（相当于 img.get(i, j)）
let x, y, tx, ty;       // 当前位置、目标位置
let hovering = false;
let frame = 0;

function setup() {
  const dpr = window.devicePixelRatio || 1;
  size = Math.round(img.clientWidth * dpr);  // canvas 还没显示时宽度是 0，所以按照片量
  canvas.width = canvas.height = size;

  pix = Math.max(3, Math.round(size * PIX));
  radius = size * RADIUS;

  // 按 object-fit: cover 的方式把照片裁成正方形
  source = document.createElement("canvas");
  source.width = source.height = size;
  const s = source.getContext("2d");
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  s.drawImage(img, sx, sy, side, side, 0, 0, size, size);

  try {
    pixels = s.getImageData(0, 0, size, size).data;
  } catch (e) {
    // 直接双击打开 html（file://）时浏览器不让读像素；用 Live Server 或上线后就正常
    return false;
  }

  ctx.drawImage(source, 0, 0);
  if (x === undefined) { x = tx = size / 2; y = ty = size / 2; }
  return true;
}

function constrain(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// 每个格子一个固定的随机数，让边缘的"碎块"稳定，不会每帧乱闪
function hash(i, j) {
  const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// 随角度和时间缓慢变化的边缘半径，形成不规则、会呼吸的轮廓
function edge(angle, t) {
  return 1 + WOBBLE * (
    0.5 * Math.sin(angle * 3 + t * 0.7) +
    0.3 * Math.sin(angle * 5 - t * 0.5 + 1.3) +
    0.2 * Math.sin(angle * 2 + t * 0.3 + 2.1)
  );
}

function draw() {
  // 半透明地盖一层原图，旧的马赛克慢慢褪掉，形成残影
  ctx.globalAlpha = TRAIL;
  ctx.drawImage(source, 0, 0);
  ctx.globalAlpha = 1;

  const moving = !reduceMotion.matches;
  if (!hovering) {
    if (!moving) return;  // 减弱动态效果：不自己动
    // 走到目标附近就换一个新的随机目标（HW2 的 random(-80, 80)，但改成缓慢滑过去）
    if (Math.hypot(tx - x, ty - y) < size * 0.02) {
      tx = x + (Math.random() * 2 - 1) * size * WANDER;
      ty = y + (Math.random() * 2 - 1) * size * WANDER;
    }
    x += (tx - x) * DRIFT;
    y += (ty - y) * DRIFT;
  } else {
    x += (tx - x) * FOLLOW;
    y += (ty - y) * FOLLOW;
  }
  const margin = radius * 0.6;
  x = constrain(x, margin, size - margin); tx = constrain(tx, margin, size - margin);
  y = constrain(y, margin, size - margin); ty = constrain(ty, margin, size - margin);

  const t = frame / 60;
  const reach = radius * (1 + WOBBLE) + pix;

  // 格子对齐在整张照片的固定网格上，所以区域移动时格子本身不抖
  const i0 = Math.max(0, Math.floor((x - reach) / pix));
  const i1 = Math.min(Math.ceil(size / pix), Math.ceil((x + reach) / pix));
  const j0 = Math.max(0, Math.floor((y - reach) / pix));
  const j1 = Math.min(Math.ceil(size / pix), Math.ceil((y + reach) / pix));

  for (let gi = i0; gi < i1; gi++) {
    for (let gj = j0; gj < j1; gj++) {
      const cx = gi * pix + pix / 2, cy = gj * pix + pix / 2;
      const dx = cx - x, dy = cy - y;
      const d = Math.hypot(dx, dy) / (radius * edge(Math.atan2(dy, dx), t));
      if (d > 1) continue;
      // 靠近边缘的格子按概率留下，边缘就是碎的、不齐的
      if (d > 1 - RAGGED && hash(gi, gj) > (1 - d) / RAGGED) continue;

      const px = Math.min(size - 1, Math.floor(cx));
      const py = Math.min(size - 1, Math.floor(cy));
      const k = (py * size + px) * 4;
      ctx.fillStyle = `rgb(${pixels[k]}, ${pixels[k + 1]}, ${pixels[k + 2]})`;
      ctx.fillRect(gi * pix, gj * pix, pix, pix);
    }
  }
}

function loop() {
  frame++;
  draw();
  requestAnimationFrame(loop);
}

canvas.parentElement.addEventListener("pointermove", (e) => {
  const r = canvas.getBoundingClientRect();
  hovering = true;
  tx = (e.clientX - r.left) / r.width * size;
  ty = (e.clientY - r.top) / r.height * size;
});
canvas.parentElement.addEventListener("pointerleave", () => {
  hovering = false;
  tx = x; ty = y;  // 离开后从当前位置继续慢慢漂
});

function start() {
  if (!setup()) return;  // 读不到像素就只显示普通照片
  canvas.classList.add("ready");
  requestAnimationFrame(loop);
}

window.addEventListener("resize", () => { if (pixels) setup(); });

if (img.complete && img.naturalWidth) start();
else img.addEventListener("load", start);
