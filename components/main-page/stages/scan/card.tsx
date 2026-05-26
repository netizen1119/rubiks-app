"use client";

import { useAppStore } from "@/lib/store/store";
import { Button } from "@/components/ui/button";
import React from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { colorMapThree } from "@/lib/maps/cube";
import { cube_sides_scan } from "@/lib/maps/cube";
import { cn } from "@/lib/utils";
import { CubePosAnchor } from "@/components/cube-visualization/cube-pos-anchor";
import { autoOrientCube } from "@/lib/solver/auto-orient";
import { useToast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";

const ScanCard = () => {
  const { scanSize, updateStore, updateCube, currentScanFace, lastScanResult } = useAppStore();
  const { toast } = useToast();
  const t = useTranslations();
  const tColor = useTranslations("cube.color");

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
        title: t("scan.scanFailToastTitle"),
        description: t("scan.scanFailToastDesc"),
      });
      return;
    }
    // 풀 수 있는 배치를 메인 큐브에 반영하고 solve 로.
    updateCube(oriented, true);
    const stream = useAppStore.getState().scanStream;
    stream?.getTracks().forEach((t) => t.stop());
    const nextStage = useAppStore.getState().trackedSolve ? "tracked-solve" : "solve";
    updateStore({ currentAppStage: nextStage, scanStream: null });
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
            {t("scan.showFacePrefix")}
            <span
              className="text-lg"
              style={{ color: expectedSide ? `#${colorMapThree[expectedSide].getHexString()}` : "" }}
            >
              {expectedSide ? tColor(expectedSide) : tColor("F")}
            </span>
            {t("scan.showFaceSuffix")}
          </CardTitle>
          {scanning && expectedSide && (
            <CardDescription className="!mt-0 absolute top-full">
              {wrongFace ? (
                <span className="text-red-400">
                  {t("scan.wrongFacePrefix")}
                  <span style={{ color: `#${colorMapThree[centerSide].getHexString()}` }}>
                    {tColor(centerSide as "U" | "R" | "F" | "D" | "L" | "B")}
                  </span>
                  {t("scan.wrongFaceSuffix")}
                </span>
              ) : centerMatches ? (
                <span className="text-emerald-400">{t("scan.recognized")}</span>
              ) : (
                <span>{t("scan.anyOrientation")}</span>
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
            {t("scan.solveButton")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ScanCard;
