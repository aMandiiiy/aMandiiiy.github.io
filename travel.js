// =====================================================================
//  Hello World：点云地球 + 绕着它转的照片卫星
// =====================================================================

// ---------------- 照片列表：在这里加地点或照片 ----------------
// key：照片文件名的前缀，比如 "japan-tokyo" 对应 japan-tokyo-1.jpg、japan-tokyo-2.jpg …
// photos：编号列表；只有一张且文件名没有编号时写 [""]
// coords：[经度, 纬度]（经度在前）
// 网页用的图在 images/web/travel/（大图）和 images/web/travel/thumb/（小图）
const PLACES = [
  { key: "china-shanghai", en: "Shanghai", zh: "上海", country: ["China", "中国"], coords: [121.47, 31.23], photos: [1, 2, 3] },
  { key: "china-lijiang", en: "Lijiang", zh: "丽江", country: ["China", "中国"], coords: [100.23, 26.87], photos: [1, 2, 3, 4, 5] },
  { key: "korea-seoul", en: "Seoul", zh: "首尔", country: ["Korea", "韩国"], coords: [126.98, 37.57], photos: [1, 2, 3] },
  { key: "japan-tokyo", en: "Tokyo", zh: "东京", country: ["Japan", "日本"], coords: [139.69, 35.69], photos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { key: "japan-kamakura", en: "Kamakura", zh: "镰仓", country: ["Japan", "日本"], coords: [139.55, 35.32], photos: [""] },
  { key: "japan-hakuba", en: "Hakuba", zh: "白马", country: ["Japan", "日本"], coords: [137.86, 36.7], photos: [1, 6, 7, 8, 9, 10] },
  { key: "japan-suwa", en: "Suwa", zh: "诹访", country: ["Japan", "日本"], coords: [138.11, 36.04], photos: [1, 2, 3, 4] },
  { key: "japan-hokkaido", en: "Hokkaido", zh: "北海道", country: ["Japan", "日本"], coords: [141.35, 43.06], photos: [1, 2, 3, 4, 5, 6] },
  { key: "singapore", en: "Singapore", zh: "新加坡", country: null, coords: [103.85, 1.29], photos: [1, 2] },
  { key: "usa-boston", en: "Boston", zh: "波士顿", country: ["USA", "美国"], coords: [-71.06, 42.36], photos: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { key: "usa-ny", en: "New York", zh: "纽约", country: ["USA", "美国"], coords: [-74.0, 40.71], photos: [1, 2, 3] },
  { key: "usa-chicago", en: "Chicago", zh: "芝加哥", country: ["USA", "美国"], coords: [-87.63, 41.88], photos: [1, 2, 3, 4, 5, 6, 7, 8] },
  { key: "usa-la", en: "Los Angeles", zh: "洛杉矶", country: ["USA", "美国"], coords: [-118.24, 34.05], photos: [1, 2] },
];
const DIR = "images/web/travel/";

// ---------------- 可以调的参数 ----------------
const ORBIT_SECONDS = 200;  // 照片绕一圈要多少秒，越大越慢
const SPIN = 0.04;          // 地球自转速度（度/帧）
const GLOBE_DOTS = 42000;   // 点云的点数，越多越细密

// =====================================================================

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const narrow = window.matchMedia("(max-width: 760px)");
const lang = () => (window.siteLang ? window.siteLang() : "en");

function placeName(p, l = lang()) {
  if (!p.country) return l === "zh" ? p.zh : p.en;
  return l === "zh" ? `${p.country[1]} · ${p.zh}` : `${p.en}, ${p.country[0]}`;
}

// 展开成一张张照片
const PHOTOS = [];
PLACES.forEach((p) => p.photos.forEach((n) => {
  const file = n === "" ? `${p.key}.jpg` : `${p.key}-${n}.jpg`;
  PHOTOS.push({ place: p, full: DIR + file, thumb: DIR + "thumb/" + file, aspect: 4 / 3 });
}));

const stage = document.getElementById("stage");
const canvas = document.getElementById("globe");
const ctx = canvas.getContext("2d");
const pinLabel = document.getElementById("pin-label");
const pinText = document.getElementById("pin-text");
const srStatus = document.getElementById("sr-status");

// =====================================================================
//  点云地球
// =====================================================================
const dots = [];  // { cl, sl, lon, land }
(function makeDots() {
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < GLOBE_DOTS; i++) {
    const y = 1 - (i / (GLOBE_DOTS - 1)) * 2;
    const lat = Math.asin(y);
    const lon = ((i * golden) % (2 * Math.PI)) - Math.PI;
    const h = (v) => { const x = Math.sin((i + v) * 91.345) * 47453.5453; return x - Math.floor(x); };
    dots.push({
      cl: Math.cos(lat), sl: Math.sin(lat), lon, land: false, deg: [lon * 180 / Math.PI, lat * 180 / Math.PI],
      jx: (h(1) - 0.5) * 1.6, jy: (h(2) - 0.5) * 1.6,   // 让点阵不那么整齐
      sz: 0.85 + 1.5 * Math.pow(h(3), 2),                // 大部分是小点，少数大点
      tone: h(4),                                        // 颜色深浅
      tw: h(5) * Math.PI * 2,                            // 闪烁相位
    });
  }
})();

// 把陆地轮廓画到一张看不见的世界地图上，再看每个点落在陆地还是海里
fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json")
  .then((r) => r.json())
  .then((topo) => {
    const land = topojson.feature(topo, topo.objects.land);
    const W = 1440, H = 720;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d");
    const proj = d3.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);
    o.fillStyle = "#000";
    o.beginPath(); d3.geoPath(proj, o)(land); o.fill();
    const px = o.getImageData(0, 0, W, H).data;
    dots.forEach((d) => {
      const x = Math.min(W - 1, Math.floor((d.deg[0] + 180) / 360 * W));
      const y = Math.min(H - 1, Math.floor((90 - d.deg[1]) / 180 * H));
      d.land = px[(y * W + x) * 4 + 3] > 0;
    });
  })
  .catch(() => {});  // 加载失败时只显示一个点阵球

let yaw = -115, pitch = 22;          // 当前朝向（度）
let yawT = null, pitchT = null;      // 要转到的朝向
let R = 200, cx = 0, cy = 0, dpr = 1;
let selectedPlace = null;            // 选中的地点
let selectedSat = null;              // 选中的照片
const pinScreen = PLACES.map(() => ({ x: 0, y: 0, visible: false }));  // 发光点在屏幕上的位置

// 画布比地球大一圈，留出大气光晕和粒子的位置
function canvasSize() { return Math.ceil(R * 3); }

// 粒子：地球外面漂浮的微尘
const PARTICLE_COUNT = 950;
const PARTICLES = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const r1 = Math.sin(i * 12.9898) * 43758.5453, r = (v) => { const x = Math.sin((i + v) * 78.233) * 43758.5453; return x - Math.floor(x); };
  return {
    lon: r(1) * Math.PI * 2,
    lat: Math.asin(r(2) * 2 - 1),
    r: 1.04 + 0.4 * Math.pow(r(3), 1.6),       // 多数贴近地球，少数飘得远
    speed: (0.02 + 0.06 * r(4)) * (r(5) < 0.3 ? -1 : 1),
    a: 0.5 + 0.5 * r(6),
    s: 0.7 + 1.2 * r(7),
    tw: 0.6 + 1.6 * r(8),
    ph: r(9) * Math.PI * 2,
  };
});

// 球壳上的粒子：越靠近地球边缘越密、越亮，让球看起来是透明的
const SHELL = Array.from({ length: 9000 }, (_, i) => {
  const h = (v) => { const x = Math.sin((i + v) * 53.719) * 39183.913; return x - Math.floor(x); };
  const y = h(1) * 2 - 1, lon = h(2) * Math.PI * 2;
  return { cl: Math.sqrt(1 - y * y), sl: y, lon, s: 0.4 + 1.0 * h(3), r: 1 + (h(4) - 0.5) * 0.025 };
});

// 光晕粒子：围着地球边缘，越靠近越密越亮，往外越来越稀
const HALO = Array.from({ length: 6000 }, (_, i) => {
  const h = (v) => { const x = Math.sin((i + v) * 61.27) * 29871.331; return x - Math.floor(x); };
  return {
    ang: h(1) * Math.PI * 2,
    d: Math.pow(h(2), 2.2),                       // 0 = 贴着地球，1 = 最外面
    s: 0.6 + 1.6 * Math.pow(h(3), 2.5),
    a: 0.5 + 0.5 * h(4),
    sp: (0.01 + 0.04 * h(5)) * (h(6) < 0.5 ? -1 : 1),
    ph: h(7) * Math.PI * 2,
    light: h(8) < 0.45,                           // 一部分是浅薄荷色
  };
});

// 球体内侧边缘的粒子：代替渐变阴影
const RIM = Array.from({ length: 7000 }, (_, i) => {
  const h = (v) => { const x = Math.sin((i + v) * 37.719) * 51413.17; return x - Math.floor(x); };
  return {
    ang: h(1) * Math.PI * 2,
    d: 0.45 * Math.pow(h(2), 2.0),                // 离边缘往里多远（0 = 就在边缘）
    s: 0.6 + 1.5 * Math.pow(h(3), 2.2),
    a: 0.5 + 0.5 * h(4),
    sp: (0.005 + 0.02 * h(5)) * (h(6) < 0.5 ? -1 : 1),
    light: h(7) < 0.5,
  };
});

// 连线：从上海出发，到每个去过的地方
const HOME = 0;  // PLACES 里上海的序号

// 三维单位向量（地球坐标）
function vec(lon, lat) { return [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)]; }

// 把很多小圆点按"颜色 + 透明度"分组，每组一次画完，比一个个画快很多
const batch = new Map();
function addDot(rgb, a, x, y, s) {
  const k = rgb + "|" + Math.min(12, Math.max(1, Math.round(a * 12)));
  let arr = batch.get(k);
  if (!arr) { arr = []; batch.set(k, arr); }
  arr.push(x - s / 2, y - s / 2, s);
}
function flushDots() {
  for (const [k, arr] of batch) {
    if (!arr.length) continue;
    const [rgb, q] = k.split("|");
    ctx.fillStyle = `rgba(${rgb}, ${q / 12})`;
    ctx.beginPath();
    // 每个点都画成圆点（arr 里存的是左上角和直径）
    for (let i = 0; i < arr.length; i += 3) {
      const r = arr[i + 2] / 2, x = arr[i] + r, y = arr[i + 1] + r;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    arr.length = 0;
  }
}

function drawGlobe(t) {
  const size = canvasSize();
  ctx.clearRect(0, 0, size, size);
  const ox = size / 2, oy = size / 2;
  const tt = t / 1000;
  const still = reduceMotion ? 0 : 1;

  const ry = yaw * Math.PI / 180, rp = pitch * Math.PI / 180;
  const cy_ = Math.cos(ry), sy_ = Math.sin(ry);
  const cp = Math.cos(rp), sp = Math.sin(rp);
  // 地球坐标里的向量 → 画布坐标 [x, y, z]（z > 0 朝向镜头）
  const rot = (x, y, z, k = 1) => {
    const x1 = x * cy_ + z * sy_, z1 = z * cy_ - x * sy_;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    return [ox + R * k * x1, oy - R * k * y2, z2, x1 * k, y2 * k];
  };
  const proj = (lon, lat) => { const v = vec(lon, lat); return rot(v[0], v[1], v[2]); };

  // 1. 光晕：几千个粒子围着地球
  for (const p of HALO) {
    const th = p.ang + tt * p.sp * still;
    const r = R * (1.0 + 0.44 * p.d);
    const tw = still ? 0.6 + 0.4 * Math.sin(tt * 1.7 + p.ph) : 1;
    const a = p.a * Math.pow(1 - p.d, 1.6) * tw;
    if (a < 0.04) continue;
    addDot(p.light ? "166, 255, 227" : "116, 214, 198", a, ox + r * Math.cos(th), oy + r * Math.sin(th), p.s);
  }
  flushDots();

  // 漂浮的微尘
  const parts = PARTICLES.map((p) => {
    const lon = p.lon + tt * p.speed * still;
    const [x, y, z] = proj(lon, p.lat);
    return { x: ox + (x - ox) * p.r, y: oy + (y - oy) * p.r, z, a: p.a * (still ? 0.55 + 0.45 * Math.sin(tt * p.tw + p.ph) : 1), s: p.s };
  });
  const drawParts = (front) => {
    for (const q of parts) {
      if ((q.z > 0) !== front) continue;
      ctx.fillStyle = `rgba(116, 214, 198, ${q.a * (front ? 0.3 + 0.6 * q.z : 0.2 * (1 + q.z))})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.s, 0, Math.PI * 2); ctx.fill();
    }
  };
  drawParts(false);

  // 2. 球体：白色，挡住后面的照片
  ctx.fillStyle = "#ffffff";
  ctx.beginPath(); ctx.arc(ox, oy, R, 0, Math.PI * 2); ctx.fill();
  // 球体边缘的"阴影"也用粒子：越靠近边缘越密
  for (const p of RIM) {
    const th = p.ang + tt * p.sp * still;
    const r = R * (1 - p.d);
    addDot(p.light ? "166, 255, 227" : "116, 214, 198", p.a * Math.pow(1 - p.d / 0.45, 1.3), ox + r * Math.cos(th), oy + r * Math.sin(th), p.s);
  }
  flushDots();

  // 3. 球壳粒子：背面很淡（透过来），正面越靠边越密
  for (const p of SHELL) {
    const lam = p.lon + ry;
    const x = p.cl * Math.sin(lam), y0 = p.sl, z0 = p.cl * Math.cos(lam);
    const y = y0 * cp - z0 * sp, z = y0 * sp + z0 * cp;
    const edge = 1 - Math.abs(z);                      // 0 = 正对镜头，1 = 在边缘
    const a = z > 0 ? 0.04 + 0.7 * Math.pow(edge, 4) : 0.03 + 0.25 * Math.pow(edge, 5);
    if (a < 0.05) continue;
    addDot("69, 168, 156", a, ox + R * p.r * x, oy - R * p.r * y, p.s);
  }
  flushDots();

  // 4. 陆地：背面的很淡，正面的点大小、深浅不一，还会轻轻闪
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      if (!d.land) continue;
      const lam = d.lon + ry;
      const x = d.cl * Math.sin(lam), y0 = d.sl, z0 = d.cl * Math.cos(lam);
      const y = y0 * cp - z0 * sp, z = y0 * sp + z0 * cp;
      const sx = ox + R * x + d.jx, sy = oy - R * y + d.jy;
      if (pass === 0) {
        if (z > 0 || i % 2) continue;
        addDot("116, 214, 198", 0.04 + 0.08 * -z, sx, sy, 1);
        continue;
      }
      if (z <= 0) continue;
      const tw = still ? 0.8 + 0.2 * Math.sin(tt * 1.3 + d.tw) : 1;
      const s = d.sz * (0.55 + 0.75 * z);
      // 三种颜色：深绿、青绿、浅薄荷
      const c = d.tone < 0.7 ? "116, 214, 198" : "166, 255, 227";   // 两种颜色：青绿、浅薄荷
      addDot(c, (0.2 + 0.8 * z) * tw, sx, sy, s);
    }
    flushDots();
  }

  // 5. 连线：全部从上海出发，拉到每个去过的地方，弧线拱起离开地面
  const home = PLACES[HOME].coords.map((v) => v * Math.PI / 180);
  const A = vec(home[0], home[1]);
  PLACES.forEach((p, pi) => {
    if (pi === HOME) return;
    const B = vec(p.coords[0] * Math.PI / 180, p.coords[1] * Math.PI / 180);
    const dot = Math.max(-1, Math.min(1, A[0] * B[0] + A[1] * B[1] + A[2] * B[2]));
    const ang = Math.acos(dot);
    if (ang < 0.02) return;
    const lift = 0.06 + 0.22 * (ang / Math.PI);
    const N = 48, pts = [];
    for (let k = 0; k <= N; k++) {
      const u = k / N;
      const a1 = Math.sin((1 - u) * ang) / Math.sin(ang), b1 = Math.sin(u * ang) / Math.sin(ang);
      const k3 = 1 + lift * Math.sin(Math.PI * u);
      const v = rot(A[0] * a1 + B[0] * b1, A[1] * a1 + B[1] * b1, A[2] * a1 + B[2] * b1, k3);
      v.push(v[2] > 0 || Math.hypot(v[3], v[4]) > 1);   // 是否看得见
      pts.push(v);
    }
    const on = selectedPlace === null || p === selectedPlace;
    ctx.lineWidth = on ? 1 : 0.6;
    ctx.strokeStyle = on ? "rgba(116, 214, 198, 0.45)" : "rgba(116, 214, 198, 0.14)";
    ctx.beginPath();
    let pen = false;
    for (const q of pts) {
      if (q[5]) { pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true; } else pen = false;
    }
    ctx.stroke();
  });

  drawParts(true);

  // 6. 拍摄地：发光的点。没选中时都在闪；选中的变成暖金色，其他变暗
  const left = cx - size / 2, top = cy - size / 2;
  PLACES.forEach((p, i) => {
    const [sx, sy, z] = proj(p.coords[0] * Math.PI / 180, p.coords[1] * Math.PI / 180);
    pinScreen[i] = { x: left + sx, y: top + sy, visible: z > 0.08 };
    if (z <= 0) return;
    const fade = Math.min(1, z * 3);
    const wave = still ? (Math.sin(tt * 2.2 + i * 1.7) + 1) / 2 : 0.5;
    const isSel = p === selectedPlace;
    if (selectedPlace !== null && !isSel) {
      ctx.fillStyle = `rgba(72, 159, 148, ${0.45 * fade})`;
      ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const col = isSel ? [255, 149, 121] : [116, 214, 198];       // 选中：珊瑚橘 / 平时：青绿
    const glow = isSel ? 22 + 8 * wave : 10 + 5 * wave;
    // 光晕
    let gg = ctx.createRadialGradient(sx, sy, 0, sx, sy, glow);
    gg.addColorStop(0, `rgba(${col}, ${0.7 * fade})`);
    gg.addColorStop(0.35, `rgba(${col}, ${0.28 * fade})`);
    gg.addColorStop(1, `rgba(${col}, 0)`);
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.arc(sx, sy, glow, 0, Math.PI * 2); ctx.fill();
    // 亮芯
    ctx.fillStyle = isSel ? `rgba(242, 83, 50, ${fade})` : `rgba(69, 181, 161, ${fade})`;
    ctx.beginPath(); ctx.arc(sx, sy, isSel ? 3.6 : 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * fade})`;
    ctx.beginPath(); ctx.arc(sx, sy, isSel ? 1.5 : 1, 0, Math.PI * 2); ctx.fill();
  });
}

function aimAt(place) {
  yawT = -place.coords[0];
  pitchT = Math.max(-60, Math.min(60, place.coords[1]));
  if (reduceMotion) { yaw = yawT; pitch = pitchT; }
}

function selectPlace(place, sat = null) {
  selectedPlace = place;
  if (selectedSat) selectedSat.el.classList.remove("is-selected");
  selectedSat = sat;
  if (sat) sat.el.classList.add("is-selected");
  aimAt(place);
  srStatus.textContent = placeName(place);
}
function clearSelection() {
  selectedPlace = null;
  if (selectedSat) selectedSat.el.classList.remove("is-selected");
  selectedSat = null;
  yawT = pitchT = null;
}

// =====================================================================
//  照片卫星
// =====================================================================
// 固定的"随机数"：每次打开页面排布都一样
function rand(s) { const x = Math.sin(s * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
const ORDER = PHOTOS.map((_, i) => i).sort((a, b) => rand(a + 900) - rand(b + 900));
const sats = PHOTOS.map((ph, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "sat";
  const img = document.createElement("img");
  img.src = ph.thumb;
  img.alt = "";
  img.decoding = "async";
  img.addEventListener("load", () => {
    ph.aspect = Math.max(0.62, Math.min(1.7, img.naturalWidth / img.naturalHeight));
    sizeSat(i);
  });
  b.appendChild(img);
  stage.appendChild(b);

  // 每张照片在一个立体空间里有自己的位置：离地球远近不同、高低不同，
  // 整片照片云绕着地球慢慢转；靠近镜头的大而清楚，远处的小而像隐进雾里
  const k = ORDER[i], n = PHOTOS.length;
  return {
    el: b, ph, i,
    angle: k * 2.39996323,                          // 黄金角，水平方向均匀散开
    height: (1 - 2 * (k + 0.5) / n) * (0.75 + 0.25 * rand(i * 5 + 4)),  // 上下位置
    dist: rand(i * 5 + 1),                          // 0 = 贴近地球，1 = 离得最远
    speed: 0.8 + 0.4 * rand(i * 5 + 2),
    bob: rand(i * 5 + 3) * Math.PI * 2,             // 轻微上下浮动的相位
    turn: 0,                                         // 当前的转角（平滑过渡用）
    // 照片本身的大小：大部分中小，少数特别大或特别小，看起来错落有致
    sz: [0.5, 0.65, 0.8, 0.92, 1.0, 1.15, 1.35, 1.65, 2.0][Math.floor(Math.pow(rand(i * 5 + 7), 1.35) * 9)],
    w: 0, h: 0,
  };
});

// 镜头：P 是镜头到地球中心的距离（像素），越小透视越强、景深越明显
let baseH = 70, P = 1100, rMin = 0, rMax = 0, yMax = 0;

function sizeSat(i) {
  const s = sats[i];
  s.h = Math.round(baseH * s.sz);
  s.w = Math.round(s.h * s.ph.aspect);
  s.el.style.width = s.w + "px";
  s.el.style.height = s.h + "px";
}

function layout() {
  const W = stage.clientWidth, H = stage.clientHeight;
  dpr = window.devicePixelRatio || 1;
  R = Math.round(Math.min(W * 0.19, H * 0.3));
  if (narrow.matches) R = Math.round(Math.min(W * 0.4, H * 0.45));
  cx = W / 2; cy = H / 2;
  const size = canvasSize();
  canvas.width = canvas.height = Math.round(size * dpr);
  canvas.style.width = canvas.style.height = size + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  baseH = Math.round(Math.max(58, Math.min(104, H * 0.115)));   // 照片的基本高度
  P = Math.max(W, H) * 0.85;
  rMin = R * 1.35;                 // 最近的轨道：刚好在地球外面
  rMax = P * 0.82;                 // 最远/最近镜头的轨道
  yMax = H * 0.5;
  sats.forEach((s, i) => sizeSat(i));
}

let paused = false, hovered = null;
let orbitT = 0;

function placeSats(t) {
  if (narrow.matches) return;
  for (const s of sats) {
    const a = s.angle + orbitT * s.speed;
    const r = rMin + (rMax - rMin) * s.dist * s.dist;   // 多数照片靠近地球，少数飞得很远
    const x3 = r * Math.sin(a);
    const z3 = r * Math.cos(a);                          // 正 = 靠近镜头
    const y3 = s.height * yMax + Math.sin(t / 2600 + s.bob) * 6;
    // 透视：越靠近镜头越大
    const persp = P / (P - z3);
    const x = cx + x3 * persp;
    const y = cy + y3 * persp;
    let scale = persp;
    // 在地球后面的大照片缩小一些，不然"又大又清楚却在后面"，透视看起来会不对
    if (z3 < 0) scale *= 1 - (1 - 1 / s.sz) * Math.min(1, -z3 / rMin) * (s.sz > 1 ? 0.8 : 0);
    // 雾：远处更淡更模糊；太靠近镜头的也虚化，像从眼前飘过
    const far = Math.max(0, Math.min(1, (-z3) / rMax));            // 0 → 1 越来越远
    let opacity = 1 - 0.72 * far;
    let blur = far * 3.2;
    if (persp > 1.8) { blur = Math.max(blur, (persp - 1.8) * 2); opacity *= Math.max(0, 1 - (persp - 1.8) * 1.8); }
    // 从地球正前方经过时变淡，免得把地球整个挡住
    if (z3 > 0) {
      const f = Math.max(0, Math.min(1, (Math.hypot(x - cx, y - cy) - R * 0.9) / (R * 0.35)));
      opacity *= f;
    }
    let zi = Math.round(1000 + z3);
    // 透视：照片斜立着，朝里的一边近、朝外的一边远。
    // 用 sin(2a) 让转角连续变化：正前方和正侧面都朝向你，斜前方转得最多，不会突然跳一下
    // 按照片在屏幕上的左右位置决定朝向：中间正对你，越往两边越斜，
    // 而且都是朝里的一边近、朝外的一边远（像围着你的一圈墙）。位置是连续移动的，所以转角也连续变化
    const side = Math.max(-1, Math.min(1, (x - cx) / (stage.clientWidth / 2)));
    let turnT = 0.5 * side;
    const focus = s === hovered || s === selectedSat;
    if (focus) { scale = Math.max(scale, 1) * 1.3; opacity = 1; blur = 0; zi = 5000; turnT = 0; }
    s.turn += (turnT - s.turn) * (focus ? 0.15 : 1);     // 选中时慢慢转正
    s.el.style.transform = `translate3d(${x - s.w / 2}px, ${y - s.h / 2}px, 0) scale(${scale.toFixed(3)}) perspective(${Math.round(s.h * 10)}px) rotateY(${s.turn.toFixed(3)}rad)`;
    s.el.style.opacity = opacity.toFixed(3);
    s.el.style.filter = blur > 0.15 ? `blur(${blur.toFixed(1)}px)` : "";
    s.el.style.zIndex = zi;
    s.el.style.visibility = opacity < 0.04 ? "hidden" : "";
  }
}

// 鼠标停在照片上：所有照片暂停，方便点中
function focusSat(s) { hovered = s; paused = true; }
function blurSat(s) {
  if (hovered !== s) return;
  hovered = null;
  paused = lightboxOpen;
}

sats.forEach((s) => {
  s.el.setAttribute("aria-label", placeName(s.ph.place));
  s.el.addEventListener("pointerenter", () => focusSat(s));
  s.el.addEventListener("pointerleave", () => blurSat(s));
  s.el.addEventListener("focus", () => focusSat(s));
  s.el.addEventListener("blur", () => blurSat(s));
  // 第一次点：地球转到拍摄地；再点同一张：看大图
  s.el.addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectedSat === s) openPhoto(s.i);
    else selectPlace(s.ph.place, s);
  });
});

stage.addEventListener("click", (e) => {
  if (narrow.matches) return;
  const r = stage.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  let best = null, bd = 16;
  pinScreen.forEach((p, i) => {
    if (!p.visible) return;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) { bd = d; best = i; }
  });
  if (best !== null) selectPlace(PLACES[best]);
  else clearSelection();
});

// 地名标签：跟着选中的发光点走
function updateLabel() {
  const place = selectedPlace;
  const i = place ? PLACES.indexOf(place) : -1;
  if (i < 0 || !pinScreen[i].visible) { pinLabel.classList.remove("show"); return; }
  pinLabel.style.transform = `translate(${pinScreen[i].x}px, ${pinScreen[i].y}px)`;
  pinText.innerHTML = `<b></b>`;
  pinText.querySelector("b").textContent = placeName(place);
  pinLabel.classList.add("show");
}

// =====================================================================
//  动画循环
// =====================================================================
let last = performance.now();
function frame(t) {
  const dt = Math.min(50, t - last) / 1000;
  last = t;
  if (!reduceMotion && !paused) orbitT += dt * (2 * Math.PI / ORBIT_SECONDS);

  if (yawT !== null) {
    // 走最短的方向转过去
    let dy = ((yawT - yaw + 540) % 360) - 180;
    yaw += dy * 0.08;
    pitch += (pitchT - pitch) * 0.08;
  } else if (!reduceMotion) {
    yaw += SPIN;
    pitch += (22 - pitch) * 0.02;
  }

  placeSats(t);
  drawGlobe(t);
  updateLabel();
  requestAnimationFrame(frame);
}

// =====================================================================
//  手机：按地点排列的照片
// =====================================================================
const list = document.getElementById("world-list");
function buildList() {
  list.innerHTML = "";
  let idx = 0;
  PLACES.forEach((p) => {
    const h = document.createElement("h2");
    h.textContent = placeName(p);
    list.appendChild(h);
    const grid = document.createElement("div");
    grid.className = "grid";
    p.photos.forEach(() => {
      const i = idx++;
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", placeName(p));
      const img = document.createElement("img");
      img.src = PHOTOS[i].thumb;
      img.alt = "";
      img.loading = "lazy";
      b.appendChild(img);
      b.addEventListener("click", () => openPhoto(i));
      grid.appendChild(b);
    });
    list.appendChild(grid);
  });
}

// =====================================================================
//  大图
// =====================================================================
const lb = document.getElementById("lightbox");
const lbImg = document.getElementById("lb-img");
const lbPlace = document.getElementById("lb-place");
let lbIndex = 0, lightboxOpen = false;

function showPhoto(i) {
  lbIndex = (i + PHOTOS.length) % PHOTOS.length;
  const ph = PHOTOS[lbIndex];
  lbImg.src = ph.full;
  lbImg.alt = (lang() === "zh" ? "拍摄于 " : "Photo taken in ") + placeName(ph.place);
  lbPlace.textContent = placeName(ph.place);
  selectPlace(ph.place, sats[lbIndex]);
}
function openPhoto(i) {
  showPhoto(i);
  lightboxOpen = true;
  paused = true;
  if (lb.showModal) lb.showModal(); else lb.setAttribute("open", "");
}
function closePhoto() {
  if (lb.close) lb.close(); else lb.removeAttribute("open");
}
lb.addEventListener("close", () => { lightboxOpen = false; paused = !!hovered; });
document.getElementById("lb-prev").addEventListener("click", () => showPhoto(lbIndex - 1));
document.getElementById("lb-next").addEventListener("click", () => showPhoto(lbIndex + 1));
document.getElementById("lb-close").addEventListener("click", closePhoto);
lb.addEventListener("click", (e) => { if (e.target === lb) closePhoto(); });  // 点空白处关闭
lb.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") showPhoto(lbIndex - 1);
  if (e.key === "ArrowRight") showPhoto(lbIndex + 1);
});

// =====================================================================
//  文字（随语言切换）
// =====================================================================
function updateText() {
  sats.forEach((s) => s.el.setAttribute("aria-label", placeName(s.ph.place)));
  if (lightboxOpen) showPhoto(lbIndex);
  buildList();
}

document.addEventListener("langchange", updateText);
window.addEventListener("resize", layout);
narrow.addEventListener("change", () => { layout(); updateText(); });

layout();
updateText();
requestAnimationFrame(frame);
