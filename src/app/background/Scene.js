"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// 网格尺寸越大越不容易在倾斜后露底（视口缩放由 VIEW_SIZE 控制）
const GRID_SIZE = 70;
// 视口“观测尺寸”：控制屏幕里格子的整体大小，不要跟 GRID_SIZE 绑定
const VIEW_SIZE = 50;
const BOX_SIZE = 1;
const BOX_GAP = 0.0;

export function Scene({ isFullscreen, theme }) {
  const containerRef = useRef(null);
  const meshRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const rootRef = useRef(null);
  const overlayRef = useRef(null);
  const animationFrameRef = useRef(null);
  const themeAnimationFrameRef = useRef(null);

  const basePositions = useMemo(() => {
    const positions = [];
    const size = GRID_SIZE;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (r % 2) {
          const yOffset = c % 2 ? 1 : 0;
          const z = 0;
          positions.push(new THREE.Vector3(c, r + yOffset, z));
        }
      }
    }

    return positions;
  }, []);

  const instanceCount = basePositions.length;

  const { lightColors, darkColors } = useMemo(() => {
    const lc = [];
    const dc = [];
    const size = GRID_SIZE;
    const colorRange = 200;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (r % 2) {
          const red = c * ((255 - colorRange) / size) + colorRange;
          const green = c * ((255 - colorRange) / size) + colorRange;
          const blue = c * ((255 - colorRange) / size) + colorRange;

          const base = new THREE.Color(red / 255, green / 255, blue / 255);

          const light = base.clone();
          const dark = base.clone().multiplyScalar(0.3);

          lc.push(light);
          dc.push(dark);
        }
      }
    }

    return { lightColors: lc, darkColors: dc };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = container.clientWidth / container.clientHeight || 1;
    // 用 VIEW_SIZE 控制画面缩放；GRID_SIZE 只负责“铺底”的范围
    const frustumSize = VIEW_SIZE * 0.2;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    camera.position.set(0, 0, 20);
    camera.zoom = 1;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(5, 10, 10);
    scene.add(dir);

    const root = new THREE.Group();
    const offset = -Math.ceil(GRID_SIZE / 2);
    // 整体往右上挪一点，避免倾斜后露出底色
    const shift = GRID_SIZE * 0.18;
    root.position.set(offset + shift, offset + shift, 0);
    // 初始时稍微平一点，后面通过动画把网格整体“翻”起来
    const startRotation = {
      x: THREE.MathUtils.degToRad(-20),
      y: THREE.MathUtils.degToRad(20),
    };
    root.rotation.set(startRotation.x, startRotation.y, 0);
    scene.add(root);
    rootRef.current = root;

    const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.35,
      roughness: 0.45,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, instanceCount);
    meshRef.current = mesh;
    root.add(mesh);

    // 前景浅层蒙版：非常淡的矩形面，稍微左右漂移，增加层次感
    const overlayGeom = new THREE.BoxGeometry(GRID_SIZE * 2, GRID_SIZE * 2, 0.01);
    const overlayMat = new THREE.MeshStandardMaterial({
      color: theme === "dark" ? 0xffffff : 0x111827,
      transparent: true,
      opacity: theme === "dark" ? 0.05 : 0.04,
      metalness: 0,
      roughness: 1,
    });
    const overlay = new THREE.Mesh(overlayGeom, overlayMat);
    overlay.position.set(0, 0, 2);
    overlayRef.current = overlay;
    scene.add(overlay);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < instanceCount; i++) {
      const p = basePositions[i];
      dummy.position.copy(p);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const color = new THREE.Color();
    const applyThemeColors = (theme) => {
      const source = theme === "dark" ? darkColors : lightColors;
      for (let i = 0; i < instanceCount; i++) {
        color.copy(source[i] ?? lightColors[i] ?? new THREE.Color(0xffffff));
        mesh.setColorAt(i, color);
      }
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    };

    applyThemeColors(theme);

    // 进入时做一次整体“翻转”小动画：左下后退，右上前倾
    const clock = new THREE.Clock();
    const duration = 3; // 入场翻转动画时长（秒）
    const targetRotation = {
      x: THREE.MathUtils.degToRad(-40),
      y: THREE.MathUtils.degToRad(40),
    };

    const animate = () => {
      const currentCamera = cameraRef.current;
      const currentRoot = rootRef.current;

      if (currentCamera && currentRoot) {
        const tIntro = Math.min(clock.getElapsedTime() / duration, 1);
        const easeOut = 1 - Math.pow(1 - tIntro, 3); // easeOutCubic

        // 基础角度：只由入场动画控制，从 startRotation 过渡到 targetRotation
        const baseX =
          startRotation.x + (targetRotation.x - startRotation.x) * easeOut;
        const baseY =
          startRotation.y + (targetRotation.y - startRotation.y) * easeOut;
        currentRoot.rotation.x = baseX;
        currentRoot.rotation.y = baseY;

        // 入场结束后，让前景浅层蒙版做非常缓慢的左右漂移（与鼠标无关）
        const overlay = overlayRef.current;
        if (overlay) {
          const drift = Math.sin(clock.getElapsedTime() * 0.12) * 1.2; // 小幅左右摆动
          overlay.position.x = drift;
        }

        renderer.render(scene, currentCamera);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const aspectNew = container.clientWidth / container.clientHeight || 1;
      const cam = cameraRef.current;
      const frustum = frustumSize;
      cam.left = (-frustum * aspectNew) / 2;
      cam.right = (frustum * aspectNew) / 2;
      cam.top = frustum / 2;
      cam.bottom = -frustum / 2;
      cam.updateProjectionMatrix();
      rendererRef.current.setSize(container.clientWidth, container.clientHeight);
      // 静态背景：resize 后主动重绘一帧
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        meshRef.current.material.dispose();
      }
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [basePositions, instanceCount, lightColors, darkColors]);

  // 主题切换时，平滑地在浅色 / 深色调色板之间插值，而不是瞬间跳变
  useEffect(() => {
    const mesh = meshRef.current;
    const cam = cameraRef.current;
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!mesh || !cam || !scene || !renderer) return;

    const from = theme === "dark" ? lightColors : darkColors;
    const to = theme === "dark" ? darkColors : lightColors;
    const color = new THREE.Color();
    const count = instanceCount;

    const start = performance.now();
    const duration = 650; // ms

    if (themeAnimationFrameRef.current !== null) {
      cancelAnimationFrame(themeAnimationFrameRef.current);
      themeAnimationFrameRef.current = null;
    }

    const step = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      // easeInOutCubic
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      for (let i = 0; i < count; i++) {
        const cFrom = from[i] ?? lightColors[i] ?? new THREE.Color(0xffffff);
        const cTo = to[i] ?? darkColors[i] ?? new THREE.Color(0x000000);
        color.copy(cFrom).lerp(cTo, eased);
        mesh.setColorAt(i, color);
      }
      if (mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }

      renderer.render(scene, cam);

      if (t < 1) {
        themeAnimationFrameRef.current = requestAnimationFrame(step);
      } else {
        themeAnimationFrameRef.current = null;
      }
    };

    themeAnimationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (themeAnimationFrameRef.current !== null) {
        cancelAnimationFrame(themeAnimationFrameRef.current);
        themeAnimationFrameRef.current = null;
      }
    };
  }, [theme, instanceCount, lightColors, darkColors]);

  return <div ref={containerRef} className="w-full h-full" />;
}
