"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
// 引入后期处理与辉光模块
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

const GRID_SIZE = 40;
const VIEW_SIZE = 50;
const BOX_SIZE = 1;

const RANDOM_BLOCK_DURATION = 6; 
const RANDOM_BLOCK_HEIGHT = 2; 
const RANDOM_SPAWN_INTERVAL = 1; 
const MODE_SWITCH_SETTLE_DURATION = 1.2; 

const INTRO_DURATION = 3.2; 
const INTRO_FALL_DURATION = 0.6; 
const INTRO_MAX_DELAY = 2.4; 
const INTRO_START_Z_MIN = 14; 
const INTRO_START_Z_MAX = 28;

export function Scene({ isFullscreen, theme }) {
  const containerRef = useRef(null);
  const meshRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const sceneRef = useRef(null);
  const rootRef = useRef(null);
 
  // 后期处理 Refs
  const composerRef = useRef(null);
  const bloomPassRef = useRef(null);

  // 🚀 用于 CSS 蒙版视差动画的 Refs
  const maskLayer1Ref = useRef(null);
  const maskLayer2Ref = useRef(null);

  // 🚀 新增：用于控制蒙版的淡入淡出和延迟更换主题
  const [maskOpacity, setMaskOpacity] = useState(0);
  const [displayTheme, setDisplayTheme] = useState(theme);
  const isInitialLoad = useRef(true);

  const animationFrameRef = useRef(null);
  const [mode, setMode] = useState("random");
  const modeRef = useRef("random");
  const lastTimeRef = useRef(0);
  const [waveProgress, setWaveProgress] = useState(0);
  const waveProgressRef = useRef(0);
  const lastWaveProgressUpdateRef = useRef(0);
  const waveOriginRef = useRef({ x: GRID_SIZE / 2, y: GRID_SIZE / 2 });
  const lastLocalTRef = useRef(0);
  const randomActiveBlocksRef = useRef([]); 
  const lastSpawnTimeRef = useRef(0);
  const lastFrameZRef = useRef(null); 
  const lastFrameRyRef = useRef(null); 
  
  const settleRef = useRef({
    active: false,
    startTime: 0,
    fromZ: null, 
    fromRy: null, 
    toMode: "wave",
  });

  // 主题切换时的状态追踪（颜色、背景色、辉光强度）
  const themeRippleRef = useRef({
    active: false,
    startTime: 0,
    fromColor: new THREE.Color(0xffffff),
    toColor: new THREE.Color(0xffffff),
    fromBg: new THREE.Color(),
    toBg: new THREE.Color(),
    fromBloom: 0,
    toBloom: 0,
  });
  
  const rippleDistancesRef = useRef(null);
  const rippleMaxDistRef = useRef(0);

  const basePositions = useMemo(() => {
    const positions = [];
    const size = GRID_SIZE;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (r % 2) {
          const yOffset = c % 2 ? 1 : 0;
          positions.push(new THREE.Vector3(c, r + yOffset, 0));
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

    // 高级感调色：纯白至浅灰 vs 深邃黑蓝至暗紫
    const dayStart = new THREE.Color("#ffffff"); 
    const dayEnd = new THREE.Color("#e2e8f0"); 
    const nightStart = new THREE.Color("#0f172a"); 
    const nightEnd = new THREE.Color("#312e81"); 

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (r % 2) {
          const tRow = r / (size - 1 || 1);
          const tCol = c / (size - 1 || 1);
          const t = (tRow * 0.5 + tCol * 0.5); 

          const day = dayStart.clone().lerp(dayEnd, t);
          const night = nightStart.clone().lerp(nightEnd, t);

          lc.push(day);
          dc.push(night);
        }
      }
    }
    return { lightColors: lc, darkColors: dc };
  }, []);

  const introDropData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < instanceCount; i++) {
      arr.push({
        delay: Math.random() * INTRO_MAX_DELAY,
        startZ: INTRO_START_Z_MIN + Math.random() * (INTRO_START_Z_MAX - INTRO_START_Z_MIN),
        tumbleRy: (Math.random() - 0.5) * Math.PI * 0.4,
      });
    }
    return arr;
  }, [instanceCount]);

  useEffect(() => {
    if (!instanceCount) return;
    const distances = new Float32Array(instanceCount);
    let maxDist = 0;
    const originX = GRID_SIZE + 2;
    const originY = GRID_SIZE + 2;

    for (let i = 0; i < instanceCount; i++) {
      const p = basePositions[i];
      const dx = originX - p.x;
      const dy = originY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      distances[i] = dist;
      if (dist > maxDist) maxDist = dist;
    }

    rippleDistancesRef.current = distances;
    rippleMaxDistRef.current = maxDist || 1;
  }, [basePositions, instanceCount]);

  useEffect(() => {
    const handleToggle = () => {
      setMode((prev) => (prev === "wave" ? "random" : "wave"));
    };
    window.addEventListener("bg-mode-toggle", handleToggle);
    return () => window.removeEventListener("bg-mode-toggle", handleToggle);
  }, []);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    waveProgressRef.current = 0;
    lastWaveProgressUpdateRef.current = 0;
    setWaveProgress(0);

    const z = lastFrameZRef.current;
    const ry = lastFrameRyRef.current;
    const fromZ = z && z.length === instanceCount ? new Float32Array(z) : new Float32Array(instanceCount);
    const fromRy = ry && ry.length === instanceCount ? new Float32Array(ry) : new Float32Array(instanceCount);

    settleRef.current = {
      active: true,
      startTime: lastTimeRef.current,
      fromZ,
      fromRy,
      toMode: mode,
    };
  }, [mode, instanceCount]);

  // --- 核心 WebGL 初始化与动画循环 ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false }); // 关闭 alpha 配合后期处理
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(container.clientWidth, container.clientHeight);
    
    const initialIsDark = theme === "dark";
    // 初始背景色
    renderer.setClearColor(initialIsDark ? 0x05050a : 0xf4f5f7, 1);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.pointerEvents = "none";
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const aspect = container.clientWidth / container.clientHeight || 1;
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

    // --- 高级感灯光 ---
    const ambient = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xfff5e6, 1.2);
    dir.position.set(15, 20, 10);
    scene.add(dir);
    const fillLight = new THREE.DirectionalLight(0x88bbff, 0.3);
    fillLight.position.set(-15, -5, -15);
    scene.add(fillLight);

    const root = new THREE.Group();
    const offset = -Math.ceil(GRID_SIZE / 2);
    const shift = GRID_SIZE * 0.18;
    root.position.set(offset + shift, offset + shift, 0);
    const startRotation = { x: THREE.MathUtils.degToRad(-20), y: THREE.MathUtils.degToRad(20) };
    root.rotation.set(startRotation.x, startRotation.y, 0);
    scene.add(root);
    rootRef.current = root;

    const geometry = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);

    // --- 高级感磨砂材质 ---
    const material = new THREE.MeshStandardMaterial({
      color: theme === "dark" ? 0x1e293b : 0xffffff,
      metalness: 0.1,
      roughness: 0.8,
    });

    const mesh = new THREE.InstancedMesh(geometry, material, instanceCount);
    meshRef.current = mesh;
    root.add(mesh);

    const dummy = new THREE.Object3D();
    for (let i = 0; i < instanceCount; i++) {
      const p = basePositions[i];
      dummy.position.copy(p);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // --- 初始化颜色 ---
    const color = new THREE.Color();
    const sourceColors = initialIsDark ? darkColors : lightColors;
    for (let i = 0; i < instanceCount; i++) {
      color.copy(sourceColors[i] ?? lightColors[i] ?? new THREE.Color(0xffffff));
      mesh.setColorAt(i, color);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // --- 设置后期处理与辉光 (Bloom) ---
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(container.clientWidth, container.clientHeight),
      initialIsDark ? 0.35 : 0.0, // 初始辉光强度
      0.8, 
      0.6 
    );
    bloomPassRef.current = bloomPass;
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composerRef.current = composer;

    const clock = new THREE.Clock();
    const duration = INTRO_DURATION;
    const targetRotation = { x: THREE.MathUtils.degToRad(-40), y: THREE.MathUtils.degToRad(40) };

    const animate = () => {
      const currentCamera = cameraRef.current;
      const currentRoot = rootRef.current;

      if (currentCamera && currentRoot) {
        const tNow = clock.getElapsedTime();
        lastTimeRef.current = tNow;

        const tIntro = Math.min(clock.getElapsedTime() / duration, 1);
        const easeOut = 1 - Math.pow(1 - tIntro, 3); 

        const baseX = startRotation.x + (targetRotation.x - startRotation.x) * easeOut;
        const baseY = startRotation.y + (targetRotation.y - startRotation.y) * easeOut;
        currentRoot.rotation.x = baseX;
        currentRoot.rotation.y = baseY;

        if (meshRef.current) {
          const mesh = meshRef.current;
          const t = tNow;
          const currentMode = modeRef.current;

          if (!lastFrameZRef.current || lastFrameZRef.current.length !== instanceCount) {
            lastFrameZRef.current = new Float32Array(instanceCount);
          }
          if (!lastFrameRyRef.current || lastFrameRyRef.current.length !== instanceCount) {
            lastFrameRyRef.current = new Float32Array(instanceCount);
          }

          if (tNow < INTRO_DURATION) {
            const localDummy = dummy;
            for (let i = 0; i < instanceCount; i++) {
              const p = basePositions[i];
              const d = introDropData[i];
              const phase = (tNow - d.delay) / INTRO_FALL_DURATION;
              let z, ry;
              if (phase <= 0) {
                z = d.startZ; ry = d.tumbleRy;
              } else if (phase >= 1) {
                z = 0; ry = 0;
              } else {
                const eased = 1 - Math.pow(1 - phase, 3);
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
            const ripple = themeRippleRef.current;
            const settle = settleRef.current;

            // --- 主题切换：平滑过渡颜色、背景、发光 ---
            if (ripple.active && rippleDistancesRef.current) {
              const distances = rippleDistancesRef.current;
              const maxDist = rippleMaxDistRef.current || 1;
              if (!ripple.startTime) ripple.startTime = tNow;

              const elapsed = tNow - ripple.startTime;
              const waveDuration = 1.0; 
              const liftDuration = 0.6; 
              const liftHeight = 1.5; // 让起落更加克制
              const waveSpeed = maxDist / waveDuration;

              const localDummy = dummy;
              let allDone = true;

              for (let i = 0; i < instanceCount; i++) {
                const p = basePositions[i];
                const dist = distances[i];
                const delay = dist / waveSpeed;
                const localTime = elapsed - delay;

                let lift = 0;
                let colorProgress = 0;

                if (localTime > 0 && localTime < liftDuration) {
                  const u = Math.min(Math.max(localTime / liftDuration, 0), 1);
                  const s = Math.sin(Math.PI * u);
                  lift = liftHeight * s * s;
                  colorProgress = u;
                  allDone = false;
                } else if (localTime >= liftDuration) {
                  colorProgress = 1;
                } else {
                  allDone = false;
                }

                localDummy.position.set(p.x, p.y, lift);
                localDummy.rotation.set(0, 0, 0);
                localDummy.updateMatrix();
                mesh.setMatrixAt(i, localDummy.matrix);

                // 暂时不在涟漪中修改实例颜色，只用抬升表现切换感
              }

              mesh.instanceMatrix.needsUpdate = true;

              // 全局插值计算（材质基础色、背景色、辉光强度）
              const globalProgress = Math.min(elapsed / (waveDuration + liftDuration), 1);
              const globalEase = globalProgress < 0.5 ? 4 * Math.pow(globalProgress, 3) : 1 - Math.pow(-2 * globalProgress + 2, 3) / 2;

              mesh.material.color.copy(ripple.fromColor).lerp(ripple.toColor, globalEase);
              mesh.material.needsUpdate = true;

              const tempBg = new THREE.Color().copy(ripple.fromBg).lerp(ripple.toBg, globalEase);
              renderer.setClearColor(tempBg, 1);

              if (bloomPassRef.current) {
                bloomPassRef.current.strength = ripple.fromBloom + (ripple.toBloom - ripple.fromBloom) * globalEase;
              }

              if (allDone) ripple.active = false;

            } else if (settle.active) {
              const uRaw = (t - settle.startTime) / MODE_SWITCH_SETTLE_DURATION;
              const u = Math.min(Math.max(uRaw, 0), 1);
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
                settleRef.current.active = false;
                lastLocalTRef.current = 0;
                randomActiveBlocksRef.current = [];
                lastSpawnTimeRef.current = t;
                waveOriginRef.current = { x: Math.random() * GRID_SIZE, y: Math.random() * GRID_SIZE };
              }
            } else if (currentMode === "wave") {
              const localDummy = dummy;
              const maxRadius = Math.sqrt((GRID_SIZE * GRID_SIZE) * 2);
              const waveSpeed = maxRadius / 50; 
              const pulseDuration = 5; 
              const amp = 3; 

              const totalCycle = maxRadius / waveSpeed + pulseDuration;
              const localT = t % totalCycle;

              if (localT < lastLocalTRef.current) {
                waveOriginRef.current = { x: Math.random() * GRID_SIZE, y: Math.random() * GRID_SIZE };
              }
              lastLocalTRef.current = localT;

              const centerX = waveOriginRef.current.x;
              const centerY = waveOriginRef.current.y;

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

                const reachTime = dist / waveSpeed;
                const phase = localT - reachTime; 

                let offsetZ = 0;
                if (phase > 0 && phase < pulseDuration) {
                  const u = phase / pulseDuration; 
                  const s = Math.sin(Math.PI * u); 
                  offsetZ = amp * s * s; 
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
              const localDummy = dummy;
              if (t - lastSpawnTimeRef.current >= RANDOM_SPAWN_INTERVAL) {
                lastSpawnTimeRef.current = t;
                const newIndex = Math.floor(Math.random() * instanceCount);
                randomActiveBlocksRef.current.push({ index: newIndex, startTime: t });
              }

              const active = randomActiveBlocksRef.current;
              const nextActive = [];
              const offsetsZ = new Array(instanceCount).fill(0);
              const rotationsY = new Array(instanceCount).fill(0);

              for (let k = 0; k < active.length; k++) {
                const item = active[k];
                const elapsed = t - item.startTime;
                if (elapsed >= 0 && elapsed < RANDOM_BLOCK_DURATION) {
                  nextActive.push(item);
                  const u = Math.min(Math.max(elapsed / RANDOM_BLOCK_DURATION, 0), 1); 
                  const ue = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
                  const s = Math.sin(Math.PI * ue); 
                  const z = RANDOM_BLOCK_HEIGHT * s * s;
                  const ry = 2 * Math.PI * ue; 

                  if (z > offsetsZ[item.index]) {
                    offsetsZ[item.index] = z;
                    rotationsY[item.index] = ry;
                  }
                }
              }

              randomActiveBlocksRef.current = nextActive;

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

        // 使用 composer 代替原生的 renderer 渲染
        if (composerRef.current) {
          composerRef.current.render();
        }
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
      // 同步更新后期处理的大小，避免拉伸模糊
      if (composerRef.current) {
        composerRef.current.setSize(container.clientWidth, container.clientHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current) rendererRef.current.dispose();
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        meshRef.current.material.dispose();
      }
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [basePositions, instanceCount, lightColors, darkColors, introDropData]);

  // --- CSS 蒙版的鼠标视差动画 ---
  useEffect(() => {
    let animationFrameId;

    const handleMouseMove = (e) => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);

      animationFrameId = requestAnimationFrame(() => {
        if (!maskLayer1Ref.current || !maskLayer2Ref.current) return;
        
        const x = (e.clientX / window.innerWidth - 0.5) * 2;
        const y = (e.clientY / window.innerHeight - 0.5) * 2;

        maskLayer1Ref.current.style.transform = `translate(${x * -8}px, ${y * -8}px)`;
        maskLayer2Ref.current.style.transform = `translate(${x * -30}px, ${y * -30}px)`;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // --- 主题触发器：只记录目标状态，由 animate 循环处理 WebGL 平滑渐变 ---
  useEffect(() => {
    const mesh = meshRef.current;
    const renderer = rendererRef.current;
    if (!mesh || !renderer) return;

    const isDark = theme === "dark";
    const ripple = themeRippleRef.current;

    ripple.active = true;
    ripple.startTime = 0; 
    
    if (mesh.material && "color" in mesh.material) {
      ripple.fromColor.copy(mesh.material.color);
      ripple.toColor.set(isDark ? 0x1e293b : 0xffffff);
    }

    ripple.fromBg.copy(renderer.getClearColor(new THREE.Color()));
    ripple.toBg.set(isDark ? 0x05050a : 0xf4f5f7);

    if (bloomPassRef.current) {
      ripple.fromBloom = bloomPassRef.current.strength;
      ripple.toBloom = isDark ? 0.35 : 0.0;
    }

  }, [theme]);

  // --- 🚀 新增：控制 CSS 蒙版延迟加载与切换动画序列 ---
  useEffect(() => {
    let timer;

    if (isInitialLoad.current) {
      // 首次加载：等待 4 秒后，透明度变为 1（渐入）
      timer = setTimeout(() => {
        setMaskOpacity(1);
      }, 4000);
      isInitialLoad.current = false;
    } else {
      // 主题切换：立刻渐退当前的
      setMaskOpacity(0);
      
      // 等待 2 秒后（配合褪色时间），更换底层变量并渐入
      timer = setTimeout(() => {
        setDisplayTheme(theme); // 在隐形状态下换颜色
        setMaskOpacity(1);      // 然后开始渐入
      }, 2000);
    }

    return () => clearTimeout(timer); // 清除定时器，防止内存泄漏
  }, [theme]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden">
      
      {/* 🚀 第一层：底色与模糊层 (移动较慢) */}
      <div 
        ref={maskLayer1Ref}
        // 使用 transition-opacity 确保只是透明度过渡，不影响 transform 产生的顺滑视差
        className="absolute inset-[-30px] pointer-events-none transition-opacity duration-1000 ease-in-out"
        style={{
          opacity: maskOpacity, // 受状态控制的透明度
          backgroundImage: displayTheme === "dark"  // 使用 displayTheme 替代外部传来的 theme
            ? `linear-gradient(to right, rgba(169, 169, 169, 0.07) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(139, 139, 139, 0.07) 1px, transparent 1px)`
            : `linear-gradient(to right, rgba(0, 0, 0, 0.07) 1px, transparent 1px),
               linear-gradient(to bottom, rgba(0, 0, 0, 0.07) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
          backdropFilter: "blur(1px)",
          WebkitBackdropFilter: "blur(1px)",
          zIndex: 1,
          willChange: "transform"
        }}
      />

      {/* 🚀 第二层：横竖网格层 (带边缘淡出效果) */}
      {/* <div 
        ref={maskLayer2Ref}
        className="absolute inset-[-30px] pointer-events-none transition-opacity duration-1000 ease-in-out"
        style={{
          opacity: maskOpacity, // 受状态控制的透明度
          backgroundImage: displayTheme === "dark" // 使用 displayTheme 替代外部传来的 theme
            ? `radial-gradient(circle, rgba(156, 156, 156, 0.1) 1px, transparent 1px)`
            : `radial-gradient(circle, rgba(24, 24, 24, 0.1) 1px, transparent 1px)`,
          backgroundSize: "20px 20px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
          zIndex: 2,
          willChange: "transform"
        }}
      /> */}

      {/* 原本的 WAVE UI */}
      {mode === "wave" && (
        <div className="pointer-events-none absolute right-2 bottom-10 z-[3] flex items-center gap-2 text-[9px] font-[family-name:var(--font-press-start)] tracking-[0.15em] text-[color-mix(in_oklab,var(--pixel-text)_80%,transparent)]">
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