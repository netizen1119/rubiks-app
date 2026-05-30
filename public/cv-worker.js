// OpenCV.js Web Worker (plain JS, public 호스팅).
//
// Next.js 14 turbo 의 `new Worker(new URL("./*.ts", import.meta.url))` 패턴은 worker 를
// 정적 asset 으로 emit 하고 .ts MIME(video/mp2t) 로 서빙해 브라우저가 실행 거부.
// 우회: 번들러를 거치지 않고 public/ 에 plain JS 로 호스팅 → main 에서 `new Worker("/cv-worker.js")`.
//
// 같은 origin → importScripts CORS 안전. 정확한 MIME(text/javascript).
//
// 통신:
//   main → worker: { type: "init" } 한 번
//                  { type: "frame", frameId, buffer, width, height } 반복 (buffer 는 transferable)
//   worker → main: { type: "ready" }
//                  { type: "load-failed", error }
//                  { type: "result", frameId, edges, width, height, roi, stickers, side, quads }
//                    - edges 는 transferable Uint8Array buffer (raw Canny, 디버그 overlay 용)
//                    - roi: { x, y, w, h } | null — 9 sticker lattice 의 bbox (시각화 + fallback 제한)
//                    - stickers: {x,y}[9] | null — 면의 9 sticker 중심 row-major (0=좌상,4=중앙,8=우하)
//                    - side: number — sticker 한 변 추정 px (sampling 반경 파생용)
//                    - quads: {x,y}[][] | null — 디버그용 candidate 사각형 corners (DEBUG_QUADS off 면 null)
//                  { type: "error", frameId, error }
//
// ROI 검출 전략 (v13 — contour + 9-neighbor):
//   edge-density grid 접근은 폐기 (큐브 grid 가 구멍 뚫린 mesh 로 흩어져 cluster 가 면 일부만 잡음).
//   실제 출시 스캐너(qbr/dwalton76/kociemba) 검증 파이프라인으로 전환:
//     gray → blur → Canny → DILATE → findContours → quad 필터 → median 크기 게이트 → 9-neighbor.
//   dilation 이 핵심 트릭 — 스티커 검은 테두리를 닫아 findContours 가 사각형(스티커 구멍)을 잡게 함.
//   9-neighbor 구조 제약이 최강 anti-clutter — 면 중심 스티커는 8 이웃을 가지고, 손/배경의
//   고립된 false 사각형은 이웃을 못 만들어 자동 탈락.

const OPENCV_CDN = "https://docs.opencv.org/4.10.0/opencv.js";

let cv = null;
let initStarted = false;

const post = (msg, transfer) => {
  self.postMessage(msg, transfer || []);
};

const tryInit = () => {
  if (initStarted) return;
  initStarted = true;
  try {
    self.importScripts(OPENCV_CDN);
    const w = self.cv;
    if (!w) {
      post({ type: "load-failed", error: "self.cv missing after importScripts" });
      return;
    }
    if (w.Mat) {
      // WASM 이미 초기화됨 (캐시된 경우).
      cv = w;
      post({ type: "ready" });
      return;
    }
    // WASM 비동기 초기화 대기.
    w.onRuntimeInitialized = () => {
      cv = w;
      post({ type: "ready" });
    };
  } catch (e) {
    post({ type: "load-failed", error: e instanceof Error ? e.message : String(e) });
  }
};

// --- contour quad 필터 상수 (480×270 처리 해상도 기준) ---
const APPROX_EPS_RATIO = 0.1; // approxPolyDP epsilon = 0.1 * perimeter — 사각형으로 단순화.
const QUAD_ASPECT_MIN = 0.75; // 사각형 w/h 하한 (스티커 ≒ 정사각).
const QUAD_ASPECT_MAX = 1.35; // 사각형 w/h 상한.
const QUAD_FILL_MIN = 0.4; // area / (bboxW·bboxH) — 사각형은 bbox 를 잘 채움 (회전/사다리꼴 거름).
const QUAD_MIN_AREA = 50; // 절대 면적 하한 (노이즈 점 제거).
// median 상대 크기 게이트 — 카메라 거리 자동 적응 (절대 px 하드코딩 금지, v13 §3-4).
const SIZE_MED_MIN = 0.5; // median side 의 0.5× 미만 거름.
const SIZE_MED_MAX = 2.0; // median side 의 2.0× 초과 거름.
// 9-neighbor 구조 제약 — 면 중심 스티커는 인접 8 스티커를 거리 NEIGHBOR_DIST_RATIO×side 안에 둔다.
const NEIGHBOR_DIST_RATIO = 1.8; // anchor 기준 이웃 판정 반경 = 이 배수 × anchor.side.
const FACE_MIN_NEIGHBORS = 4; // anchor 의 최소 이웃 수 (부분 가림 허용; 완전 9면이면 중심=8).
// dilate kernel — Canny edge(스티커 검은 테두리)를 닫아 사각형 contour 형성.
const DILATE_KERNEL = 7;
// 디버그: candidate 사각형들을 main 으로 회신해 overlay 로 시각화. 튜닝 끝나면 false.
const DEBUG_QUADS = true;

// 이진 마스크(dilated Canny)에서 큐브 한 면의 9 sticker 좌표를 산출.
// 반환: { roi, stickers, side, quads }. 면 미검출 시 stickers=null (roi/quads 도 가능한 만큼만).
const detectCubeFace = (cv, bin) => {
  const result = { roi: null, stickers: null, side: 0, quads: null };
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.findContours(bin, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

    // 1) per-contour quad 필터 → candidate 사각형 수집.
    const cands = []; // { cx, cy, side, corners:[{x,y}×4] }
    const n = contours.size();
    for (let i = 0; i < n; i++) {
      const cnt = contours.get(i);
      const approx = new cv.Mat();
      // try/finally — arcLength/approxPolyDP/contourArea 가 throw 해도 cnt·approx WASM 해제 보장.
      try {
        const peri = cv.arcLength(cnt, true);
        cv.approxPolyDP(cnt, approx, APPROX_EPS_RATIO * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const d = approx.data32S; // [x0,y0, x1,y1, x2,y2, x3,y3]
          const xs = [d[0], d[2], d[4], d[6]];
          const ys = [d[1], d[3], d[5], d[7]];
          const minX = Math.min(xs[0], xs[1], xs[2], xs[3]);
          const maxX = Math.max(xs[0], xs[1], xs[2], xs[3]);
          const minY = Math.min(ys[0], ys[1], ys[2], ys[3]);
          const maxY = Math.max(ys[0], ys[1], ys[2], ys[3]);
          const bw = maxX - minX;
          const bh = maxY - minY;
          const area = Math.abs(cv.contourArea(approx));
          const aspect = bh > 0 ? bw / bh : 0;
          const fill = bw > 0 && bh > 0 ? area / (bw * bh) : 0;
          if (
            bw > 0 &&
            bh > 0 &&
            area >= QUAD_MIN_AREA &&
            aspect >= QUAD_ASPECT_MIN &&
            aspect <= QUAD_ASPECT_MAX &&
            fill >= QUAD_FILL_MIN
          ) {
            cands.push({
              cx: (minX + maxX) / 2,
              cy: (minY + maxY) / 2,
              side: (bw + bh) / 2,
              corners: [
                { x: d[0], y: d[1] },
                { x: d[2], y: d[3] },
                { x: d[4], y: d[5] },
                { x: d[6], y: d[7] },
              ],
            });
          }
        }
      } finally {
        approx.delete();
        cnt.delete();
      }
    }
    if (cands.length === 0) return result;

    // 2) median 상대 크기 게이트 — 비슷한 크기 사각형만 남겨 큐브 grid 와 무관한 잡음 제거.
    const sortedSides = cands.map((c) => c.side).sort((a, b) => a - b);
    const medSide = sortedSides[sortedSides.length >> 1];
    const sized = cands.filter(
      (c) => c.side >= medSide * SIZE_MED_MIN && c.side <= medSide * SIZE_MED_MAX,
    );
    result.quads = DEBUG_QUADS ? sized.map((c) => c.corners) : null;
    if (sized.length === 0) return result;

    // 3) 9-neighbor anchor — 이웃이 가장 많은 사각형 = 면 중심 스티커 (3×3 정중앙은 8 이웃).
    let bestIdx = -1;
    let bestCount = -1;
    for (let i = 0; i < sized.length; i++) {
      const a = sized[i];
      const thr = NEIGHBOR_DIST_RATIO * a.side;
      let cnt = 0;
      for (let j = 0; j < sized.length; j++) {
        if (i === j) continue;
        const dx = sized[j].cx - a.cx;
        const dy = sized[j].cy - a.cy;
        if (Math.hypot(dx, dy) <= thr) cnt++;
      }
      if (cnt > bestCount) {
        bestCount = cnt;
        bestIdx = i;
      }
    }
    if (bestIdx < 0 || bestCount < FACE_MIN_NEIGHBORS) return result; // 고립 → 면 아님.

    // 4) face set = anchor + 반경 내 이웃. spacing = set 내 최근접 이웃 거리의 median (sticker pitch).
    const anchor = sized[bestIdx];
    const thr = NEIGHBOR_DIST_RATIO * anchor.side;
    const faceSet = sized.filter((c) => {
      const dx = c.cx - anchor.cx;
      const dy = c.cy - anchor.cy;
      return Math.hypot(dx, dy) <= thr;
    });
    let spacing = medSide;
    if (faceSet.length >= 2) {
      const nn = [];
      for (let i = 0; i < faceSet.length; i++) {
        let m = Infinity;
        for (let j = 0; j < faceSet.length; j++) {
          if (i === j) continue;
          const dx = faceSet[j].cx - faceSet[i].cx;
          const dy = faceSet[j].cy - faceSet[i].cy;
          const dd = Math.hypot(dx, dy);
          if (dd < m) m = dd;
        }
        if (Number.isFinite(m)) nn.push(m);
      }
      nn.sort((a, b) => a - b);
      if (nn.length) spacing = nn[nn.length >> 1];
    }

    // 5) anchor 중심 기준 3×3 lattice → 9 sticker 좌표 row-major (0=좌상, 4=중앙, 8=우하).
    //    front-facing 가정 (축 정렬). perspective 강할 땐 다음 iteration warpPerspective 로 보정.
    const stickers = [];
    for (let r = -1; r <= 1; r++) {
      for (let c = -1; c <= 1; c++) {
        stickers.push({ x: anchor.cx + c * spacing, y: anchor.cy + r * spacing });
      }
    }
    result.stickers = stickers;
    result.side = anchor.side;

    // 6) roi bbox = lattice 범위 + 반 sticker 여백 (시각화 + connected-component fallback 제한용).
    const half = anchor.side / 2;
    const minX = anchor.cx - spacing - half;
    const maxX = anchor.cx + spacing + half;
    const minY = anchor.cy - spacing - half;
    const maxY = anchor.cy + spacing + half;
    result.roi = {
      x: Math.max(0, minX),
      y: Math.max(0, minY),
      w: maxX - minX,
      h: maxY - minY,
    };
    return result;
  } catch {
    return result;
  } finally {
    contours.delete();
    hierarchy.delete();
  }
};

const processFrame = (frameId, buffer, width, height) => {
  if (!cv) {
    post({ type: "error", frameId, error: "cv not ready" });
    return;
  }
  let src = null;
  let gray = null;
  let edges = null;
  let closed = null;
  let kernel = null;
  try {
    const data = new Uint8ClampedArray(buffer);
    const img = new ImageData(data, width, height);
    src = cv.matFromImageData(img);
    gray = new cv.Mat();
    edges = new cv.Mat();
    closed = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    // blur 3×3 — qbr 기준. 약한 스티커 grid edge 보존하며 노이즈만 억제.
    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0, 0);
    // Canny 30/60 — 스티커 검은 grid 선의 약한 edge 도 잡게 낮춤.
    cv.Canny(gray, edges, 30, 60);
    // dilate — 끊긴 스티커 테두리를 닫아 findContours 가 사각형(구멍)을 잡게 하는 핵심 트릭.
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(DILATE_KERNEL, DILATE_KERNEL));
    cv.dilate(edges, closed, kernel);

    const { roi, stickers, side, quads } = detectCubeFace(cv, closed);

    // overlay 는 raw Canny(edges) 회신 — dilated(closed) 가 아닌 얇은 선이 시각 디버그에 유리.
    const out = new Uint8Array(edges.data.length);
    out.set(edges.data);
    post(
      {
        type: "result",
        frameId,
        edges: out.buffer,
        width,
        height,
        roi,
        stickers,
        side,
        quads,
      },
      [out.buffer],
    );
  } catch (e) {
    post({ type: "error", frameId, error: e instanceof Error ? e.message : String(e) });
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (edges) edges.delete();
    if (closed) closed.delete();
    if (kernel) kernel.delete();
  }
};

self.addEventListener("message", (ev) => {
  const msg = ev.data;
  if (!msg || typeof msg !== "object") return;
  if (msg.type === "init") {
    tryInit();
  } else if (msg.type === "frame") {
    processFrame(msg.frameId, msg.buffer, msg.width, msg.height);
  }
});
