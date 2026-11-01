// 展厅：向下滚动时，整面墙向左移，人就像在往右走
// 只在宽屏上启用；手机上是普通的上下排列（文字太长，横着看会很挤）

const hall = document.querySelector(".hall");
const track = document.querySelector(".hall-track");
const progress = document.querySelector(".hall-progress");
const wide = window.matchMedia("(min-width: 761px) and (min-height: 560px)");

let distance = 0;  // 墙需要横移的总距离

function measure() {
  if (!wide.matches) {
    hall.classList.remove("horizontal");
    hall.style.height = "";
    track.style.transform = "";
    return;
  }
  hall.classList.add("horizontal");
  distance = Math.max(0, track.scrollWidth - window.innerWidth);
  // 横移多少像素，页面就要多出多少像素的竖向滚动距离
  hall.style.height = `${distance + window.innerHeight}px`;
  update();
}

function update() {
  if (!wide.matches) return;
  const start = hall.offsetTop;
  const p = Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, distance)));
  track.style.transform = `translate3d(${-p * distance}px, 0, 0)`;
  progress.style.transform = `scaleX(${p})`;
}

let ticking = false;
window.addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { update(); ticking = false; });
}, { passive: true });

window.addEventListener("resize", measure);
wide.addEventListener("change", measure);

// 图片还没放进文件夹时，显示一个写着文件路径的浅绿占位块
document.querySelectorAll(".work-art img").forEach((img) => {
  const mark = () => {
    const fig = img.closest(".work-art");
    fig.classList.add("missing");
    fig.dataset.src = img.getAttribute("src");
  };
  if (img.complete && img.naturalWidth === 0) mark();
  img.addEventListener("error", mark);
  img.addEventListener("load", measure);  // 图片尺寸到了以后重新算墙有多长
});

measure();
document.addEventListener("langchange", measure);  // 换语言后文字长度变了
if (document.fonts) document.fonts.ready.then(measure);
