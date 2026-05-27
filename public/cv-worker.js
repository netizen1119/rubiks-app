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
//                  { type: "result", frameId, edges, width, height, roi }
//                    - edges 는 transferable Uint8Array buffer
//                    - roi: { x, y, w, h } | null — 큐브 후보의 bbox (color 분류를 ROI 로 제한)
//                  { type: "error", frameId, error }
//
// ROI 검출 전략 (C-1):
//   Canny edges → findContours → 각 contour 에 대해 approxPolyDP 4-vertex 사각형 필터 +
//   area 임계 + aspect ratio in [0.6, 1.7] 필터. 후보 중 가장 큰 면적 채택.
//   이게 큐브의 한 면일 가능성 큼 (강한 grid edge + 사각형 윤곽). 손/벽/모니터의 곡면/직사각형은
//   대부분 4-vertex 사각형 필터에서 떨어지거나 aspect 가 벗어남.

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

// ROI 후보 필터링 임계값들 — 480×270 = 129,600 px 기준 튜닝.
// MIN_AREA: 큐브가 화면의 ~10% 이상은 차지해야 의미 있는 검출. 너무 작은 사각형은 노이즈.
const ROI_MIN_AREA = 480 * 270 * 0.04; // 약 5,200 px
// MAX_AREA: 화면 80% 이상은 책상 가장자리 같은 큰 사각형일 가능성 — 큐브는 가까이서도 그 정도 안 됨.
const ROI_MAX_AREA = 480 * 270 * 0.7;
// aspect ratio 가 정사각형에서 너무 멀면 큐브 면이 아님 (책장, 모니터 베젤 등).
const ROI_ASPECT_MIN = 0.6;
const ROI_ASPECT_MAX = 1.7;
// approxPolyDP epsilon = perimeter * 비율. 0.04 면 어느 정도 angular noise 허용하면서 사각형 잡힘.
const APPROX_EPSILON_RATIO = 0.04;

const detectCubeROI = (cv, edges) => {
  let closed = null;
  let kernel = null;
  let contours = null;
  let hierarchy = null;
  let approx = null;
  try {
    // Canny edges 가 큐브 grid 에서 끊긴 점선처럼 잡혀서 findContours 가 큐브 외곽을 하나의
    // 닫힌 contour 로 못 잡는 문제 → morphological CLOSE(dilate→erode) 로 작은 갭 메우기.
    // 5×5 kernel 이면 점선 같은 1~3px 갭은 잘 닫힘. 큐브 grid 끼리도 연결되긴 하지만
    // RETR_EXTERNAL 로 외곽만 받으니 무방.
    closed = new cv.Mat();
    kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);

    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    // RETR_EXTERNAL: 외곽 contour 만. 큐브 내부 grid 사각형들은 자동으로 무시.
    // CHAIN_APPROX_SIMPLE: 직선 구간 압축으로 점 수 감소 → 후속 approxPolyDP 부담 ↓.
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let bestArea = 0;
    let best = null;
    const n = contours.size();
    for (let i = 0; i < n; i++) {
      const c = contours.get(i);
      try {
        const area = cv.contourArea(c);
        if (area < ROI_MIN_AREA || area > ROI_MAX_AREA) continue;
        const peri = cv.arcLength(c, true);
        approx = new cv.Mat();
        cv.approxPolyDP(c, approx, APPROX_EPSILON_RATIO * peri, true);
        // 큐브가 한 면 보이면 quadrilateral(4), 두/세 면 보이면 perspective 로 hexagon(6) 까지.
        // approxPolyDP 노이즈로 점 1~2 더 끼는 경우 흡수해 4~10 허용.
        const verts = approx.rows;
        approx.delete();
        approx = null;
        if (verts < 4 || verts > 10) continue;
        const rect = cv.boundingRect(c);
        if (rect.width <= 0 || rect.height <= 0) continue;
        const aspect = rect.width / rect.height;
        if (aspect < ROI_ASPECT_MIN || aspect > ROI_ASPECT_MAX) continue;
        if (area > bestArea) {
          bestArea = area;
          best = { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
        }
      } finally {
        c.delete();
      }
    }
    return best;
  } catch {
    return null;
  } finally {
    if (approx) approx.delete();
    if (kernel) kernel.delete();
    if (closed) closed.delete();
    if (contours) contours.delete();
    if (hierarchy) hierarchy.delete();
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
  try {
    const data = new Uint8ClampedArray(buffer);
    const img = new ImageData(data, width, height);
    src = cv.matFromImageData(img);
    gray = new cv.Mat();
    edges = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0, 0);
    // Canny 임계 50/150 — OpenCV 튜토리얼 표준. 큐브 스티커 grid 검은 선은 강한 edge.
    cv.Canny(gray, edges, 50, 150);
    const roi = detectCubeROI(cv, edges);
    // edges.data 는 Mat 내부 view → 복사해서 transferable 로 반환.
    const out = new Uint8Array(edges.data.length);
    out.set(edges.data);
    post(
      { type: "result", frameId, edges: out.buffer, width, height, roi },
      [out.buffer],
    );
  } catch (e) {
    post({ type: "error", frameId, error: e instanceof Error ? e.message : String(e) });
  } finally {
    if (src) src.delete();
    if (gray) gray.delete();
    if (edges) edges.delete();
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
