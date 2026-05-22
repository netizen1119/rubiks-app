import { RGBToHSV } from "./rgb-to-hsv";

// 스캔 색 라벨 (W=흰, Y=노랑, G=초록, B=파랑, R=빨강, O=주황).
export type ScanColor = "W" | "Y" | "G" | "B" | "R" | "O";

type Chromatic = Exclude<ScanColor, "W">;

// 실제 큐브 색의 대표 Hue(0-360). 캘리브레이션 전 기본값.
// 빨강↔주황 구분이 가장 민감하므로 두 기준 Hue 를 충분히 떨어뜨려 둔다.
const DEFAULT_HUE: Record<Chromatic, number> = {
  R: 4,
  O: 22,
  Y: 52,
  G: 130,
  B: 220,
};

// 흰색 판정: 채도 낮고 명도 높음. D면 센터로 런타임 보정.
const DEFAULT_WHITE = { satMax: 26, valMin: 55 };
// 명도가 이보다 낮으면 배경/그림자로 보고 미인식(X) 처리.
const DARK_VAL_MIN = 16;

type Calib = {
  hue: Record<Chromatic, number>;
  white: { satMax: number; valMin: number };
};

const freshCalib = (): Calib => ({
  hue: { ...DEFAULT_HUE },
  white: { ...DEFAULT_WHITE },
});

// 모듈 단위 캘리브레이션 상태. 스캔 화면 진입 시 reset.
// (React 리렌더를 유발하지 않도록 store 대신 모듈 싱글톤으로 둔다.)
let calib: Calib = freshCalib();

export const resetColorCalibration = () => {
  calib = freshCalib();
};

// 디버깅/오버레이용 현재 캘리브레이션 스냅샷.
export const getColorCalibration = (): Calib => ({
  hue: { ...calib.hue },
  white: { ...calib.white },
});

// 원형(0-360) 지수이동평균.
const emaHue = (prev: number, next: number, alpha: number) => {
  const delta = ((next - prev + 540) % 360) - 180;
  return (prev + alpha * delta + 360) % 360;
};

// 두 Hue 사이 원형 거리(0-180).
const hueDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

/**
 * 알려진 면 센터 색의 실측 RGB 로 해당 색 기준을 보정한다.
 * 센터 색은 항상 정답이므로(F=빨강 등) 조명/화이트밸런스 차이를 흡수하는 닻 역할.
 */
export const calibrateFromCenter = (known: ScanColor, r: number, g: number, b: number) => {
  const [h, s, v] = RGBToHSV(r, g, b);
  if (known === "W") {
    // 흰 센터의 채도/명도로 흰색 임계를 이 조명에 맞춰 살짝 넓힌다.
    calib.white.satMax = Math.max(calib.white.satMax, Math.min(40, s + 10));
    calib.white.valMin = Math.min(calib.white.valMin, Math.max(35, v - 20));
    return;
  }
  // 신뢰하기 어려운(어둡거나 무채색에 가까운) 센터 표본은 무시.
  if (v < DARK_VAL_MIN || s < 12) return;
  calib.hue[known] = emaHue(calib.hue[known], h, 0.4);
};

/** 실측 RGB 한 점을 6색 중 하나(또는 미인식 X)로 분류. */
export const classifyColor = (r: number, g: number, b: number): ScanColor | "X" => {
  const [h, s, v] = RGBToHSV(r, g, b);
  if (v < DARK_VAL_MIN) return "X"; // 너무 어두움 → 배경/그림자
  if (s <= calib.white.satMax && v >= calib.white.valMin) return "W";

  let best: Chromatic = "R";
  let bestD = Infinity;
  (Object.keys(calib.hue) as Chromatic[]).forEach((c) => {
    const d = hueDist(h, calib.hue[c]);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  });
  return best;
};
