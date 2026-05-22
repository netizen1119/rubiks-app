"use client";

import { colorMapThree, cube_sides_scan } from "@/lib/maps/cube";
import { RGBToHSV } from "@/lib/helpers/rgb-to-hsv";
import { getColorCalibration } from "@/lib/helpers/classify-scan-color";
import { getScanAutoDebug } from "@/lib/use-scan-refresh";
import { useAppStore } from "@/lib/store/store";

import { Toggle } from "../ui/toggle";

// 실물 튜닝용 라이브 디버그 오버레이.
// 각 칸에 분류 결과 + 실측 HSV, 하단에 현재 캘리브레이션된 기준 Hue 표시.
const DevScanResultPreview = () => {
  const previewRefresh = useAppStore((s) => s.isScanRefreshing);
  const [updateStore, lastScanResult] = useAppStore((s) => [s.updateStore, s.lastScanResult]);

  const calib = getColorCalibration();
  const auto = getScanAutoDebug();
  const expectedSide = auto.face !== null && auto.face > -1 ? cube_sides_scan[auto.face] : "-";

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-md bg-black/70 p-2 text-[10px] text-white backdrop-blur-sm">
      <Toggle
        pressed={previewRefresh}
        onClick={() => updateStore({ isScanRefreshing: !previewRefresh })}
        className="mb-1 h-7 w-full text-xs"
        variant="outline"
      >
        {previewRefresh ? "Pause" : "Unpause"}
      </Toggle>
      <div className="grid w-[12rem] grid-cols-3 grid-rows-3 gap-px">
        {lastScanResult?.map(({ destSide, scanData, id }) => {
          const [h, s, v] = RGBToHSV(scanData[0], scanData[1], scanData[2]);
          const dark = v < 50;
          return (
            <div
              key={`dev-scan-preview-${id}`}
              className="flex aspect-square flex-col items-center justify-center leading-tight"
              style={{
                background: `#${destSide ? colorMapThree[destSide]?.getHexString() : colorMapThree.X.getHexString()}`,
                color: dark ? "#fff" : "#000",
              }}
              title={`rgb(${scanData[0]}, ${scanData[1]}, ${scanData[2]})`}
            >
              <span className="text-sm font-bold">{destSide}</span>
              <span>{`H${Math.round(h)} S${Math.round(s)}`}</span>
              <span>{`V${Math.round(v)}`}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-5 gap-px text-center">
        {(["R", "O", "Y", "G", "B"] as const).map((c) => (
          <div key={`calib-${c}`}>
            <div className="font-bold">{c}</div>
            <div>{Math.round(calib.hue[c])}</div>
          </div>
        ))}
      </div>
      <div className="mt-0.5 text-center text-white/70">
        W≤S{Math.round(calib.white.satMax)} ≥V{Math.round(calib.white.valMin)}
      </div>
      <div className="mt-1 border-t border-white/20 pt-1 leading-snug">
        <div>
          기대면 <b>{expectedSide}</b> · 진행 {auto.progress}/{auto.window}
        </div>
        <div className="flex gap-2">
          <span style={{ color: auto.valid ? "#7CFC7C" : "#FF7C7C" }}>valid:{auto.valid ? "Y" : "N"}</span>
          <span style={{ color: auto.hasX ? "#FF7C7C" : "#7CFC7C" }}>X:{auto.hasX ? "Y" : "N"}</span>
          <span style={{ color: auto.centerMatch ? "#7CFC7C" : "#FF7C7C" }}>center:{auto.centerMatch ? "Y" : "N"}</span>
        </div>
      </div>
    </div>
  );
};

export default DevScanResultPreview;
