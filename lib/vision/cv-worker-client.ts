// OpenCV Worker 의 main-thread 측 wrapper.
// - 싱글톤 (HMR / 중복 mount 방어)
// - ready Promise (init 한 번만 송신)
// - computeEdges: back-pressure 적용 (in-flight 인 동안 새 frame drop)
// - terminate: 스테이지 종료 시 명시 해제
//
// Worker 파일은 `public/cv-worker.js` 에 plain JS 로 호스팅 (Next.js 번들 우회).
// Next.js 14 turbo 의 `new Worker(new URL("./*.ts", import.meta.url))` 패턴이 worker 를
// 정적 asset(MIME=video/mp2t) 으로 emit 해 브라우저가 실행 거부하는 문제 회피.

export type Pt = { x: number; y: number };

export type EdgesResult = {
  edges: Uint8Array;
  width: number;
  height: number;
  /** 9 sticker lattice 의 bbox. 손/벽/배경 잡음을 색 분류에서 빼주는 게이트 + 시각화. */
  roi: { x: number; y: number; w: number; h: number } | null;
  /** 면의 9 sticker 중심 row-major (0=좌상, 4=중앙, 8=우하). null = 면 미검출. */
  stickers: Pt[] | null;
  /** sticker 한 변 추정 px. sampling 반경 파생용. */
  side: number;
  /** 디버그 overlay: candidate 사각형들 (각 4 corner). DEBUG_QUADS off 시 null. */
  quads: Pt[][] | null;
};

export type CVWorkerClient = {
  /** worker 초기화 완료 시 resolve. 실패 시 reject. */
  ready: Promise<void>;
  /**
   * frame 을 worker 로 보내고 edge 마스크를 받는다.
   * back-pressure: 직전 호출 결과가 아직 안 돌아왔으면 null 즉시 반환 (drop).
   * 호출자는 ImageData 의 buffer 가 transferable 로 이전됨을 인지해야 함.
   */
  computeEdges: (frame: ImageData) => Promise<EdgesResult | null>;
  terminate: () => void;
};

let singleton: CVWorkerClient | null = null;

export const getCVWorker = (): CVWorkerClient => {
  if (singleton) return singleton;

  const worker = new Worker("/cv-worker.js");

  const pending = new Map<number, (r: EdgesResult | null) => void>();
  let nextFrameId = 1;
  let inFlight = false;

  let readyResolve: (() => void) | null = null;
  let readyReject: ((e: Error) => void) | null = null;
  const ready = new Promise<void>((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });

  worker.addEventListener("message", (ev: MessageEvent) => {
    const msg = ev.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "ready") {
      readyResolve?.();
    } else if (msg.type === "load-failed") {
      readyReject?.(new Error(msg.error ?? "OpenCV worker load failed"));
    } else if (msg.type === "result") {
      inFlight = false;
      const resolver = pending.get(msg.frameId);
      if (resolver) {
        pending.delete(msg.frameId);
        resolver({
          edges: new Uint8Array(msg.edges as ArrayBuffer),
          width: msg.width,
          height: msg.height,
          roi: msg.roi ?? null,
          stickers: msg.stickers ?? null,
          side: msg.side ?? 0,
          quads: msg.quads ?? null,
        });
      }
    } else if (msg.type === "error") {
      inFlight = false;
      const resolver = pending.get(msg.frameId);
      if (resolver) {
        pending.delete(msg.frameId);
        resolver(null);
      }
    }
  });

  worker.addEventListener("error", (e) => {
    readyReject?.(new Error(`OpenCV worker runtime error: ${e.message ?? "unknown"}`));
  });

  worker.postMessage({ type: "init" });

  singleton = {
    ready,
    computeEdges: (frame: ImageData) => {
      if (inFlight) return Promise.resolve(null);
      inFlight = true;
      const frameId = nextFrameId++;
      // frame.data.buffer 를 transferable 로 송신 — 호출 후 frame.data 는 detached.
      // 호출자는 매 frame 새 ImageData 를 만들어 넘기는 패턴을 따라야 한다.
      const buffer = frame.data.buffer;
      return new Promise<EdgesResult | null>((resolve) => {
        pending.set(frameId, resolve);
        worker.postMessage(
          {
            type: "frame",
            frameId,
            buffer,
            width: frame.width,
            height: frame.height,
          },
          [buffer],
        );
      });
    },
    terminate: () => {
      worker.terminate();
      pending.clear();
      singleton = null;
    },
  };

  return singleton;
};
