"use client";

import { useAppStore } from "@/lib/store/store";
import { Button } from "@/components/ui/button";
import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { colorMapThree } from "@/lib/maps/cube";
import { cubeSidesNamedColors, cube_sides_scan } from "@/lib/maps/cube";
import { cn } from "@/lib/utils";
import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { autoOrientCube } from "@/lib/solver/auto-orient";
import { useToast } from "@/components/ui/use-toast";

const ScanCard = () => {
  const { scanSize, updateStore, updateCube, currentScanFace, lastScanResult } = useAppStore();
  const { toast } = useToast();

  const scanning = currentScanFace !== null && currentScanFace !== -1;
  const expectedSide = scanning ? cube_sides_scan[currentScanFace] : null;

  // 현재 카메라에 든 면의 센터(인덱스 4) 인식 결과.
  const centerSide = lastScanResult?.[4]?.destSide;
  const centerKnown = !!centerSide && centerSide !== "X";
  const centerMatches = !!expectedSide && centerSide === expectedSide;
  // 인식은 됐는데 기대한 면이 아님 → 명확히 안내.
  const wrongFace = scanning && centerKnown && !centerMatches;

  const onSolveClick = () => {
    // 캡처된 6면을 회전 자동 보정 → 풀 수 있는 표준 배치 산출.
    const faces = useAppStore.getState().scannedFaces;
    const oriented = autoOrientCube(faces);
    if (!oriented) {
      toast({
        variant: "destructive",
        title: "큐브를 풀 수 없어요",
        description: "한 면 이상 색이 잘못 인식된 것 같아요. 그 면을 다시 비춰 스캔해주세요.",
      });
      return;
    }
    // 풀 수 있는 배치를 메인 큐브에 반영하고 solve 로.
    updateCube(oriented, true);
    const stream = useAppStore.getState().scanStream;
    stream?.getTracks().forEach((t) => t.stop());
    updateStore({ currentAppStage: "solve", scanStream: null });
  };

  return (
    <div className="absolute">
      <Card
        className="w-[350px] bg-card/80 backdrop-blur-sm relative"
        style={{ marginTop: `calc(-${scanSize}px - 9rem )` }}
      >
        <CardHeader className="pt-4 pb-0 relative">
          <CardTitle
            className={cn(
              "text-muted-foreground transition-opacity duration-700 delay-700",
              currentScanFace === null && "opacity-0"
            )}
          >
            <span
              className="text-lg"
              style={{ color: expectedSide ? `#${colorMapThree[expectedSide].getHexString()}` : "" }}
            >
              {expectedSide ? cubeSidesNamedColors[expectedSide] : cubeSidesNamedColors.F}
            </span>{" "}
            면을 보여주세요
          </CardTitle>
          {scanning && expectedSide && (
            <CardDescription className="!mt-0 absolute top-full">
              {wrongFace ? (
                <span className="text-red-400">
                  지금은{" "}
                  <span style={{ color: `#${colorMapThree[centerSide].getHexString()}` }}>
                    {cubeSidesNamedColors[centerSide]}
                  </span>{" "}
                  면이에요
                </span>
              ) : centerMatches ? (
                <span className="text-emerald-400">인식됨 · 잠시 그대로 들고 계세요…</span>
              ) : (
                <span>방향은 상관없어요 · 사각형 안에 맞춰주세요</span>
              )}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="h-[10.5rem]">
          <div className="flex items-center justify-center h-full w-full">
            <CubePosAnchor />
          </div>
        </CardContent>
        <CardFooter className="p-4 absolute bottom-0 right-0">
          <Button
            variant="outline"
            className={cn("w-full transition", scanning && "opacity-0 pointer-events-none")}
            onClick={onSolveClick}
          >
            풀기
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ScanCard;
