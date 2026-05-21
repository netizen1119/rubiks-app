"use client";

import * as THREE from "three";

import { useEffect, useRef } from "react";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/examples/jsm/postprocessing/OutlinePass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { useAppStore } from "@/lib/store/store";
import { cameraPositions } from "@/lib/maps/camera-positions";

export const THREE_WIDTH = 400;
export const THREE_HEIGHT = 400;

function CubeThree() {
  const {
    objects,
    camera: { current: camera },
    outlinedSelection,
    mainCanvas,
    orbitControls,
  } = useAppStore();
  const refContainer = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const inited = useRef(false);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;

    const width = THREE_WIDTH;
    const height = THREE_HEIGHT;

    const scene = objects.current.scene;
    // 은은한 기본광(앰비언트) + 비스듬한 방향광으로 면별 명암 차이를 만들어 입체감/거리감을 살린다.
    const ambientLight = new THREE.AmbientLight("white", 2.4);
    scene.add(ambientLight);

    // 주광: 위-앞-오른쪽에서 비스듬히 → 윗면 밝고 측면 점점 어두워지는 그라데이션 + 광택 하이라이트.
    const light = new THREE.DirectionalLight("white", 3);
    light.position.set(4, 7, 6);
    scene.add(light);

    // 보조광: 반대편 약하게 → 그림자면이 새까매지지 않게 채움.
    const fillLight = new THREE.DirectionalLight("white", 0.8);
    fillLight.position.set(-5, -2, -4);
    scene.add(fillLight);

    // Load cubes into the scene
    scene.add(objects.current.rubiksGroup);
    sceneRef.current = scene;

    camera.position.set(...cameraPositions.X);
    camera.lookAt(scene.position);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    // Log camera position on c key down
    document.addEventListener("keydown", (e) => {
      if (e.key === "c") {
        console.log({ pos: camera.position, rot: camera.rotation });
      }
    });

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // HiDPI/레티나 대응: 디바이스 픽셀 비율을 반영해 더 선명하게 렌더(최대 2배로 캡 — 성능 보호).
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height);
    refContainer.current && refContainer.current.appendChild(renderer.domElement);
    // 매뉴얼 입력 단계에서 메인 vis 캔버스에 포인터 핸들러를 붙이기 위해 노출.
    mainCanvas.current = renderer.domElement;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 0;
    controls.maxDistance = 20;
    controls.enablePan = false;
    // controls.maxPolarAngle = Math.PI / 2;
    // 매뉴얼 입력 단계에서 비활성화하기 위해 노출.
    orbitControls.current = controls;

    // Set up post-processing — 강조 외곽선 가시성 향상.
    const outlinePass = new OutlinePass(new THREE.Vector2(width, height), scene, camera);
    outlinePass.edgeStrength = 8;
    outlinePass.edgeThickness = 3;
    outlinePass.pulsePeriod = 0;
    outlinePass.visibleEdgeColor.set(0xffeb3b); // 밝은 노랑 — 어떤 큐비 색에도 잘 보임
    outlinePass.hiddenEdgeColor.set(0x664400); // 가려진 부분은 어두운 노랑
    outlinePass.selectedObjects = outlinedSelection.current;

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(outlinePass);

    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // outlined selection 이 없으면 composer(OutlinePass 포함) 대신 plain render
    // 사용해 프레임 비용 감소. OutlinePass 가 가장 무거운 파이프라인 단계.
    function render() {
      requestAnimationFrame(render);

      controls.update();
      if (outlinedSelection.current.length > 0) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }

    /*
    function onWindowResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(window.innerWidth, window.innerHeight);

      // Update the size of the outline pass
      outlinePass.resolution.set(window.innerWidth, window.innerHeight);
    }

    window.addEventListener("resize", onWindowResize);
    */
    render();
  }, []);

  return <div ref={refContainer} />;
}

export default CubeThree;
