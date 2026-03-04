"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

// 网格尺寸越大越不容易在倾斜后露底（视口缩放由 VIEW_SIZE 控制）
const GRID_SIZE = 40;
// 视口“观测尺寸”：控制屏幕里格子的整体大小，不要跟 GRID_SIZE 绑定
const VIEW_SIZE = 50;
const BOX_SIZE = 1;
const BOX_GAP = 0.0;

// 随机单块旋转动效的默认参数
const RANDOM_BLOCK_DURATION = 6; // 每个方块完整“起落+旋转”时间（秒），控制单个方块起落速度
const RANDOM_BLOCK_HEIGHT = 2; // 单块起落的高度
const RANDOM_SPAWN_INTERVAL = 1; // 每隔多少秒启动一个新的方块动画（可并发）
const MODE_SWITCH_SETTLE_DURATION = 1.2; // 模式切换时的“沉降收尾”时长（秒）

// 入场动画：方块从空中落下拼成背景
const INTRO_DURATION = 3.2; // 入场总时长（秒）
const INTRO_FALL_DURATION = 0.6; // 单个方块下落时长
const INTRO_MAX_DELAY = 2.4; // 最晚落地方块的延迟（秒）
const INTRO_START_Z_MIN = 14; // 起始高度范围
const INTRO_START_Z_MAX = 28;

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
  const [mode, setMode] = useState("random"); // "wave" | "random"
  const modeRef = useRef("random");
  const lastTimeRef = useRef(0);
  const [waveProgress, setWaveProgress] = useState(0);
  const waveProgressRef = useRef(0);
  const lastWaveProgressUpdateRef = useRef(0);
  const waveOriginRef = useRef({ x: GRID_SIZE / 2, y: GRID_SIZE / 2 });
  const lastLocalTRef = useRef(0);
  const randomActiveBlocksRef = useRef([]); // { index, startTime }[]
  const lastSpawnTimeRef = useRef(0);
  const lastFrameZRef = useRef(null); // Float32Array
  const lastFrameRyRef = useRef(null); // Float32Array
  const settleRef = useRef({
    active: false,
    startTime: 0,
    fromZ: null, // Float32Array
    fromRy: null, // Float32Array
    toMode: "wave",
  });

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

  // 入场“落下拼成”动画：每个方块的延迟、起始高度、下落时轻微旋转
  const introDropData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < instanceCount; i++) {
      arr.push({
        delay: Math.random() * INTRO_MAX_DELAY,
        startZ:
          INTRO_START_Z_MIN +
          Math.random() * (INTRO_START_Z_MAX - INTRO_START_Z_MIN),
        tumbleRy: (Math.random() - 0.5) * Math.PI * 0.4,
      });
    }
    return arr;
  }, [instanceCount]);

  // 外部按钮通过 window 事件切换模式
  useEffect(() => {
    const handleToggle = () => {
      setMode((prev) => (prev === "wave" ? "random" : "wave"));
    };
    window.addEventListener("bg-mode-toggle", handleToggle);
    return () => {
      window.removeEventListener("bg-mode-toggle", handleToggle);
    };
  }, []);

  // 保证动画循环中拿到的是最新的模式
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // 模式切换时：不要硬切到新模式，先把当前还在动的方块“慢慢沉下去”
  useEffect(() => {
    // 切换时立刻清空 wave 的进度，避免 UI 残留
    waveProgressRef.current = 0;
    lastWaveProgressUpdateRef.current = 0;
    setWaveProgress(0);

    const z = lastFrameZRef.current;
    const ry = lastFrameRyRef.current;
    const fromZ =
      z && z.length === instanceCount ? new Float32Array(z) : new Float32Array(instanceCount);
    const fromRy =
      ry && ry.length === instanceCount
        ? new Float32Array(ry)
        : new Float32Array(instanceCount);

    settleRef.current = {
      active: true,
      startTime: lastTimeRef.current,
      fromZ,
      fromRy,
      toMode: mode,
    };
  }, [mode, instanceCount]);

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
    // 让 WebGL 画布本身不拦截鼠标事件，方便上层 UI（按钮等）可点击
    renderer.domElement.style.pointerEvents = "none";
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

    // 进入时：整体倾斜 + 方块从空中落下拼成背景
    const clock = new THREE.Clock();
    const duration = INTRO_DURATION; // 入场总时长，与落下动画同步
    const targetRotation = {
      x: THREE.MathUtils.degToRad(-40),
      y: THREE.MathUtils.degToRad(40),
    };

    const animate = () => {
      const currentCamera = cameraRef.current;
      const currentRoot = rootRef.current;

      if (currentCamera && currentRoot) {
        const tNow = clock.getElapsedTime();
        lastTimeRef.current = tNow;

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

        // 背景动效：模式切换时先“沉降收尾”，避免硬切
        if (meshRef.current) {
          const mesh = meshRef.current;
          const t = tNow;
          const currentMode = modeRef.current;

          // 确保有“上一帧状态”容器（用于切换时平滑沉降）
          if (!lastFrameZRef.current || lastFrameZRef.current.length !== instanceCount) {
            lastFrameZRef.current = new Float32Array(instanceCount);
          }
          if (!lastFrameRyRef.current || lastFrameRyRef.current.length !== instanceCount) {
            lastFrameRyRef.current = new Float32Array(instanceCount);
          }

          // 入场阶段：方块从空中逐个落下、拼成背景（带轻微旋转）
          if (tNow < INTRO_DURATION) {
            const localDummy = dummy;
            for (let i = 0; i < instanceCount; i++) {
              const p = basePositions[i];
              const d = introDropData[i];
              const phase = (tNow - d.delay) / INTRO_FALL_DURATION;
              let z, ry;
              if (phase <= 0) {
                z = d.startZ;
                ry = d.tumbleRy;
              } else if (phase >= 1) {
                z = 0;
                ry = 0;
              } else {
                const eased = 1 - Math.pow(1 - phase, 3); // easeOutCubic 落地更自然
                z = d.startZ * (1 - eased);
                ry = d.tumbleRy * (1 - eased);
              }
              localDummy.position.set(p.x, p.y, z);
              localDummy.rotation.set(0, ry, 0);
              localDummy.updateMatrix();
              mesh.setMatrixAt(i, localDummy.matrix);
              lastFrameZRef.current[i] = z;
              lastFrameRyRef.current[i] = ry;
            }
            mesh.instanceMatrix.needsUpdate = true;
          } else {
          const settle = settleRef.current;
          if (settle.active) {
            const uRaw = (t - settle.startTime) / MODE_SWITCH_SETTLE_DURATION;
            const u = Math.min(Math.max(uRaw, 0), 1);
            // easeOutCubic：更自然的“慢慢沉下去”
            const eased = 1 - Math.pow(1 - u, 3);

            const fromZ = settle.fromZ ?? lastFrameZRef.current;
            const fromRy = settle.fromRy ?? lastFrameRyRef.current;

            const localDummy = dummy;
            for (let i = 0; i < instanceCount; i++) {
              const p = basePositions[i];
              const z0 = fromZ[i] ?? 0;
              const ry0 = fromRy[i] ?? 0;

              const z = z0 * (1 - eased);
              const ry = ry0 * (1 - eased);

              localDummy.position.set(p.x, p.y, z);
              localDummy.rotation.set(0, ry, 0);
              localDummy.updateMatrix();
              mesh.setMatrixAt(i, localDummy.matrix);

              lastFrameZRef.current[i] = z;
              lastFrameRyRef.current[i] = ry;
            }
            mesh.instanceMatrix.needsUpdate = true;

            if (u >= 1) {
              // 收尾完成：清理旧模式的“触发器”，让新模式从静止态开始
              settleRef.current.active = false;
              lastLocalTRef.current = 0;
              randomActiveBlocksRef.current = [];
              lastSpawnTimeRef.current = t;
              // 波纹中心重新随机一下，避免切回 wave 时跳变
              waveOriginRef.current = {
                x: Math.random() * GRID_SIZE,
                y: Math.random() * GRID_SIZE,
              };
            }
          } else if (currentMode === "wave") {
            const localDummy = dummy;
            // 呼吸式“涟漪”：以随机起点为中心，沿半径做一圈圈缓慢扩散，
            // 每个方块在波前经过时都会慢慢升起、再慢慢落下。
            const maxRadius = Math.sqrt((GRID_SIZE * GRID_SIZE) * 2);
            const waveSpeed = maxRadius / 50; // 单位/秒，控制整圈波纹走完的大致时间
            const pulseDuration = 5; // 单位：秒，单个方块完整“起落”时间
            const amp = 3; // 最大前后位移（世界单位），更明显但仍然克制

            // 一次完整涟漪的总时长：波前到达最远距离 + 单个方块的起落时间
            const totalCycle = maxRadius / waveSpeed + pulseDuration;
            const localT = t % totalCycle;

            // 每次新的循环开始时，随机选择一个新的起点方块作为涟漪中心
            if (localT < lastLocalTRef.current) {
              const randRow = Math.random() * GRID_SIZE;
              const randCol = Math.random() * GRID_SIZE;
              waveOriginRef.current = { x: randCol, y: randRow };
            }
            lastLocalTRef.current = localT;

            const centerX = waveOriginRef.current.x;
            const centerY = waveOriginRef.current.y;

            // 记录当前循环进度，用于在 UI 上显示进度条
            const frac = localT / totalCycle;
            waveProgressRef.current = frac;
            const nowMs = performance.now();
            if (nowMs - lastWaveProgressUpdateRef.current > 120) {
              lastWaveProgressUpdateRef.current = nowMs;
              setWaveProgress(frac);
            }

            for (let i = 0; i < instanceCount; i++) {
              const p = basePositions[i];

              const dx = p.x - centerX;
              const dy = p.y - centerY;
              const dist = Math.sqrt(dx * dx + dy * dy);

              // 对于每个方块，波前到达它的时间大约为 dist / waveSpeed
              const reachTime = dist / waveSpeed;
              const phase = localT - reachTime; // >0 表示波前已经到达

              let offsetZ = 0;
              if (phase > 0 && phase < pulseDuration) {
                const u = phase / pulseDuration; // 0 → 1
                // 使用平滑的“起落”曲线：缓慢升起，再缓慢落下
                const s = Math.sin(Math.PI * u); // 0 → 1 → 0
                offsetZ = amp * s * s; // 保持非负，顶点更圆润
              }

              localDummy.position.set(p.x, p.y, offsetZ);
              localDummy.rotation.set(0, 0, 0);
              localDummy.updateMatrix();
              mesh.setMatrixAt(i, localDummy.matrix);

              lastFrameZRef.current[i] = offsetZ;
              lastFrameRyRef.current[i] = 0;
            }

            mesh.instanceMatrix.needsUpdate = true;
          } else {
            // 随机单块起落 + 旋转动效（可并发，多块同时动画）
            const localDummy = dummy;

            // 每隔固定时间启动一个新的方块动画
            if (t - lastSpawnTimeRef.current >= RANDOM_SPAWN_INTERVAL) {
              lastSpawnTimeRef.current = t;
              const newIndex = Math.floor(Math.random() * instanceCount);
              randomActiveBlocksRef.current.push({
                index: newIndex,
                startTime: t,
              });
            }

            const active = randomActiveBlocksRef.current;
            const nextActive = [];

            // 为每个实例准备默认的变换（z 位移 + y 旋转）
            const offsetsZ = new Array(instanceCount).fill(0);
            const rotationsY = new Array(instanceCount).fill(0);

            // 计算当前所有活动方块的动画状态
            for (let k = 0; k < active.length; k++) {
              const item = active[k];
              const elapsed = t - item.startTime;
              if (elapsed >= 0 && elapsed < RANDOM_BLOCK_DURATION) {
                // 这一块仍然在动画中，保留到下一帧
                nextActive.push(item);

                const u = Math.min(
                  Math.max(elapsed / RANDOM_BLOCK_DURATION, 0),
                  1
                ); // 0 → 1
                // easeInOutCubic：先慢后快再慢，让起落/旋转更顺滑
                const ue =
                  u < 0.5
                    ? 4 * u * u * u
                    : 1 - Math.pow(-2 * u + 2, 3) / 2;
                const s = Math.sin(Math.PI * ue); // 0 → 1 → 0
                const z = RANDOM_BLOCK_HEIGHT * s * s;
                const ry = 2 * Math.PI * ue; // 一整圈旋转（同样做 ease）

                // 如果同一个 index 被多次触发，取 z 更大的那一个，保证形状自然
                if (z > offsetsZ[item.index]) {
                  offsetsZ[item.index] = z;
                  rotationsY[item.index] = ry;
                }
              }
            }

            // 更新活动列表
            randomActiveBlocksRef.current = nextActive;

            // 随机模式下不再显示进度条，这里不用更新 waveProgress

            // 应用到每一个实例
            for (let i = 0; i < instanceCount; i++) {
              const p = basePositions[i];
              const z = offsetsZ[i];
              const ry = rotationsY[i];

              localDummy.position.set(p.x, p.y, z);
              localDummy.rotation.set(0, ry, 0);
              localDummy.updateMatrix();
              mesh.setMatrixAt(i, localDummy.matrix);

              lastFrameZRef.current[i] = z;
              lastFrameRyRef.current[i] = ry;
            }

            mesh.instanceMatrix.needsUpdate = true;
          }
          }
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
  }, [basePositions, instanceCount, lightColors, darkColors, introDropData]);

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

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* 右下角进度条：仅在涟漪模式下展示当前循环进度，并稍微往上移，避免和外部按钮重叠 */}
      {mode === "wave" && (
        <div className="pointer-events-none absolute right-2 bottom-10 z-10 flex items-center gap-2 text-[9px] font-[family-name:var(--font-press-start)] tracking-[0.15em] text-[color-mix(in_oklab,var(--pixel-text)_80%,transparent)]">
          <span className="hidden sm:inline-block">WAVE</span>
          <div className="w-20 h-[3px] bg-[color-mix(in_oklab,var(--pixel-bg)_80%,transparent)] border border-[color-mix(in_oklab,var(--pixel-border)_80%,black)] overflow-hidden">
            <div
              className="h-full bg-[var(--pixel-accent)]"
              style={{ width: `${Math.round(waveProgress * 100)}%` }}
            />
          </div>
          <span>{Math.round(waveProgress * 100)}%</span>
        </div>
      )}
    </div>
  );
}
