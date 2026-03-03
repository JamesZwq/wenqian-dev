"use client";

import React, { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useTheme } from "./ThemeProvider";
import { useMotionValue, useSpring, useMotionValueEvent } from "framer-motion";

const GRID_SIZE = 120; // base grid resolution
const BOX_SIZE = 0.9;
const BOX_GAP = BOX_SIZE * 0.4;

function MatrixField() {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rootRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const basePositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const cols = GRID_SIZE;
    const rows = GRID_SIZE;
    const step = BOX_SIZE + BOX_GAP;
    const offsetX = -((cols - 1) * step) / 2;
    const offsetY = -((rows - 1) * step) / 2;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        // 棋盘式高度：一格在上，一格在下
        const isHigh = (x + y) % 2 === 0;
        const z = isHigh ? 0 : -BOX_SIZE * 1.1;
        positions.push(new THREE.Vector3(offsetX + x * step, offsetY + y * step, z));
      }
    }
    return positions;
  }, []);

  const instanceCount = basePositions.length;

  // 对角线渐变：为浅色和深色主题分别预计算一套颜色
  const { lightColors, darkColors } = useMemo(() => {
    const lightStart = new THREE.Color("#a5b4fc"); // indigo-300
    const lightEnd = new THREE.Color("#22c55e"); // emerald-500
    const darkStart = new THREE.Color("#020617"); // slate-950
    const darkEnd = new THREE.Color("#22c55e"); // emerald-500

    const lc: THREE.Color[] = [];
    const dc: THREE.Color[] = [];
    const cols = GRID_SIZE;
    const rows = GRID_SIZE;
    const maxDiag = cols + rows - 2;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = (x + y) / maxDiag;
        const c1 = lightStart.clone().lerp(lightEnd, t);
        const c2 = darkStart.clone().lerp(darkEnd, t);
        lc.push(c1);
        dc.push(c2);
      }
    }

    return { lightColors: lc, darkColors: dc };
  }, []);

  // 主题平滑过渡：0 -> light, 1 -> dark
  const themeTarget = theme === "dark" ? 1 : 0;
  const themeMV = useMotionValue(themeTarget);
  const themeSpring = useSpring(themeMV, {
    stiffness: 120,
    damping: 20,
  });

  useEffect(() => {
    themeMV.set(themeTarget);
  }, [themeTarget, themeMV]);

  // 初始化矩阵
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < instanceCount; i++) {
      const p = basePositions[i];
      dummy.position.copy(p);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [basePositions, instanceCount]);

  // 根据 themeSpring 更新颜色，使用 InstancedMesh 的 vertexColors
  useMotionValueEvent(themeSpring, "change", (v) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    for (let i = 0; i < instanceCount; i++) {
      color.copy(lightColors[i]).lerp(darkColors[i], v as number);
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  });

  // 为每个方块生成一个随机相位，用于轻微旋转动画
  const phases = useMemo(
    () => Array.from({ length: instanceCount }, () => Math.random() * Math.PI * 2),
    [instanceCount]
  );

  // 鼠标视差：使用 window pointermove 更新指针位置
  const pointerRef = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handle = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      pointerRef.current = { x, y };
    };
    window.addEventListener("pointermove", handle);
    return () => window.removeEventListener("pointermove", handle);
  }, []);

  // 初始化 three.js 场景 / 相机 / renderer，并在本组件内部自己管理动画循环
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
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
    // 网格世界尺寸（未考虑旋转）
    const gridExtent = (GRID_SIZE - 1) * (BOX_SIZE + BOX_GAP || 0.0001);
    // 让视锥高度远小于网格，使方块在视口内显得更大，尽量覆盖全屏
    const frustumSize = gridExtent * 0.2;
    const camera = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      100
    );
    camera.position.set(0, 0, 20);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 10);
    scene.add(dir);

    // 根节点：整体倾斜的平面
    const root = new THREE.Group();
    const planeRotation = new THREE.Euler(-Math.PI / 2.4, Math.PI / 4, 0); // 略微更倾斜的平面
    root.rotation.copy(planeRotation);
    scene.add(root);
    rootRef.current = root;

    const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      metalness: 0.3,
      roughness: 0.4,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, instanceCount);
    meshRef.current = mesh;
    root.add(mesh);

    // 初始矩阵
    const dummy = new THREE.Object3D();
    for (let i = 0; i < instanceCount; i++) {
      const p = basePositions[i];
      dummy.position.copy(p);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    const clock = new THREE.Clock();
    const amp = 0.18;

    const animate = () => {
      const t = clock.getElapsedTime();
      const currentMesh = meshRef.current;
      const currentCamera = cameraRef.current;
      if (currentMesh && currentCamera) {
        for (let i = 0; i < instanceCount; i++) {
          const p = basePositions[i];
          const phase = phases[i];
          dummy.position.copy(p);
          // 在整体倾斜的基础上，做轻微 3D 翻转
          dummy.rotation.x = amp * Math.sin(t * 0.6 + phase);
          dummy.rotation.y = amp * Math.cos(t * 0.45 + phase * 1.3);
          dummy.rotation.z = 0;
          dummy.updateMatrix();
          currentMesh.setMatrixAt(i, dummy.matrix);
        }
        currentMesh.instanceMatrix.needsUpdate = true;

        // 相机视差
        const targetX = pointerRef.current.x * 2.0;
        const targetY = pointerRef.current.y * 1.5;
        currentCamera.position.x += (targetX - currentCamera.position.x) * 0.06;
        currentCamera.position.y += (targetY - currentCamera.position.y) * 0.06;
        currentCamera.lookAt(0, 0, 0);

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
        (meshRef.current.material as THREE.Material).dispose();
      }
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [basePositions, instanceCount, phases]);

  return <div ref={containerRef} className="w-full h-full" />;
}

export default function MatrixBackground() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <MatrixField />
    </div>
  );
}

