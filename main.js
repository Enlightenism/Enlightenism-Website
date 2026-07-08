import * as THREE from "https://unpkg.com/three@0.168.0/build/three.module.js";

const root = document.documentElement;
const body = document.body;

const state = {
  reduceMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  pointer: {
    x: 0.5,
    y: 0.5,
    rawX: 0,
    rawY: 0,
    smoothX: 0,
    smoothY: 0,
  },
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight,
    dpr: Math.min(window.devicePixelRatio || 1, 1.8),
  },
  scroll: {
    y: window.scrollY,
    progress: 0,
    heroProgress: 0,
    roadmapProgress: 0,
  },
  ticking: false,
  rafId: null,
};

const dom = {
  themeToggle: document.querySelector("[data-theme-toggle]"),
  revealItems: [...document.querySelectorAll("[data-reveal]")],
  tiltItems: [...document.querySelectorAll("[data-tilt]")],
  heroSection: document.querySelector(".hero-section"),
  roadmapSection: document.querySelector(".roadmap-preview"),
  siteHeader: document.querySelector(".site-header"),
  videos: [...document.querySelectorAll("video")],
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (start, end, alpha) => start + (end - start) * alpha;
const mapRange = (value, inMin, inMax, outMin, outMax) => {
  if (inMax - inMin === 0) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + (outMax - outMin) * t;
};

const setThemeIconState = (theme) => {
  if (!dom.themeToggle) return;
  dom.themeToggle.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
  );
};

const resolveInitialTheme = () => {
  const existing = root.getAttribute("data-theme");
  if (existing === "light" || existing === "dark") return existing;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const initThemeToggle = () => {
  if (!dom.themeToggle) return;
  let currentTheme = resolveInitialTheme();
  root.setAttribute("data-theme", currentTheme);
  setThemeIconState(currentTheme);

  dom.themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", currentTheme);
    setThemeIconState(currentTheme);
  });
};

const updatePointerCSSVars = () => {
  root.style.setProperty("--mouse-x", `${(state.pointer.smoothX * 100).toFixed(2)}%`);
  root.style.setProperty("--mouse-y", `${(state.pointer.smoothY * 100).toFixed(2)}%`);
  root.style.setProperty("--pointer-x", `${(state.pointer.smoothX * 100).toFixed(2)}%`);
  root.style.setProperty("--pointer-y", `${(state.pointer.smoothY * 100).toFixed(2)}%`);

  const spotlight = state.reduceMotion ? 0.35 : 0.9;
  root.style.setProperty("--spotlight-opacity", spotlight.toFixed(2));

  const gridTilt = mapRange(state.pointer.smoothX, 0, 1, -2.5, 2.5);
  root.style.setProperty("--grid-tilt", `${gridTilt.toFixed(2)}deg`);
};

const updateScrollState = () => {
  state.scroll.y = window.scrollY;
  const doc = document.documentElement;
  const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 1);
  state.scroll.progress = clamp(state.scroll.y / maxScroll, 0, 1);

  if (dom.heroSection) {
    const rect = dom.heroSection.getBoundingClientRect();
    const total = Math.max(rect.height, 1);
    state.scroll.heroProgress = clamp((window.innerHeight - rect.top) / (window.innerHeight + total), 0, 1);
  }

  if (dom.roadmapSection) {
    const rect = dom.roadmapSection.getBoundingClientRect();
    const total = Math.max(rect.height + window.innerHeight, 1);
    state.scroll.roadmapProgress = clamp((window.innerHeight - rect.top) / total, 0, 1);
  }

  root.style.setProperty("--scroll-progress", state.scroll.progress.toFixed(4));
  root.style.setProperty("--hero-progress", state.scroll.heroProgress.toFixed(4));
  root.style.setProperty("--roadmap-progress", state.scroll.roadmapProgress.toFixed(4));

  if (dom.siteHeader) {
    const headerAlpha = mapRange(state.scroll.y, 0, 180, 0.72, 0.92);
    dom.siteHeader.style.background = `linear-gradient(180deg, rgba(2, 4, 9, ${headerAlpha}), rgba(2, 4, 9, ${Math.max(
      headerAlpha - 0.34,
      0.4
    )}))`;
    dom.siteHeader.style.backdropFilter = state.scroll.y > 16 ? "blur(18px)" : "blur(10px)";
  }
};

const onPointerMove = (event) => {
  state.pointer.rawX = event.clientX / state.viewport.width;
  state.pointer.rawY = event.clientY / state.viewport.height;
};

const onTouchHint = (event) => {
  const touch = event.touches?.[0];
  if (!touch) return;
  state.pointer.rawX = touch.clientX / state.viewport.width;
  state.pointer.rawY = touch.clientY / state.viewport.height;
};

const onResize = () => {
  state.viewport.width = window.innerWidth;
  state.viewport.height = window.innerHeight;
  state.viewport.dpr = Math.min(window.devicePixelRatio || 1, 1.8);
  updateScrollState();
};

const animateSharedState = () => {
  const ease = state.reduceMotion ? 0.08 : 0.12;

  state.pointer.smoothX = lerp(state.pointer.smoothX, state.pointer.rawX || 0.5, ease);
  state.pointer.smoothY = lerp(state.pointer.smoothY, state.pointer.rawY || 0.38, ease);

  state.pointer.x = state.pointer.smoothX;
  state.pointer.y = state.pointer.smoothY;

  updatePointerCSSVars();
  state.rafId = requestAnimationFrame(animateSharedState);
};

const initRevealObserver = () => {
  if (!dom.revealItems.length) return () => {};

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -6% 0px",
    }
  );

  dom.revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;
    observer.observe(item);
  });

  return () => observer.disconnect();
};

const initTiltCards = () => {
  if (!dom.tiltItems.length) return () => {};

  const cleanups = [];

  dom.tiltItems.forEach((card) => {
    let raf = null;

    const resetTilt = () => {
      if (card.matches(":hover")) return;
      card.style.transform = "";
    };

    const updateTilt = (clientX, clientY) => {
      const rect = card.getBoundingClientRect();
      const x = (clientX - rect.left) / rect.width;
      const y = (clientY - rect.top) / rect.height;

      const rotateY = mapRange(x, 0, 1, -9, 9);
      const rotateX = mapRange(y, 0, 1, 8, -8);
      const translateY = -4;
      const glareX = `${(x * 100).toFixed(2)}%`;
      const glareY = `${(y * 100).toFixed(2)}%`;

      card.style.transform = `perspective(1400px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(
        2
      )}deg) translateY(${translateY}px)`;
      card.style.setProperty("--mouse-x", glareX);
      card.style.setProperty("--mouse-y", glareY);
    };

    const handleMove = (clientX, clientY) => {
      if (state.reduceMotion || window.innerWidth < 900) return;
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => updateTilt(clientX, clientY));
    };

    const handlePointerMove = (event) => handleMove(event.clientX, event.clientY);
    const handleLeave = () => resetTilt();
    const handleBlur = () => resetTilt();

    card.addEventListener("pointermove", handlePointerMove);
    card.addEventListener("pointerleave", handleLeave);
    card.addEventListener("blur", handleBlur);

    cleanups.push(() => {
      if (raf) cancelAnimationFrame(raf);
      card.removeEventListener("pointermove", handlePointerMove);
      card.removeEventListener("pointerleave", handleLeave);
      card.removeEventListener("blur", handleBlur);
      card.style.transform = "";
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
};

const initVideoFallbacks = () => {
  if (!dom.videos.length) return () => {};

  dom.videos.forEach((video) => {
    const fallback = video.parentElement?.querySelector(".hero-video-fallback, .community-video-fallback");
    if (!fallback) return;

    const showFallback = () => {
      fallback.style.opacity = "1";
      fallback.style.visibility = "visible";
    };

    const hideFallback = () => {
      fallback.style.opacity = "0";
      fallback.style.visibility = "hidden";
    };

    video.addEventListener("loadeddata", hideFallback, { once: true });
    video.addEventListener("canplay", hideFallback, { once: true });
    video.addEventListener("error", showFallback);

    if (video.readyState >= 2) {
      hideFallback();
    } else {
      showFallback();
    }
  });

  return () => {};
};

const initNavMicroStates = () => {
  const navLinks = [...document.querySelectorAll(".primary-nav a")];
  if (!navLinks.length) return;

  const currentPath = window.location.pathname.split("/").pop() || "index.html";
  navLinks.forEach((link) => {
    const href = link.getAttribute("href");
    if (!href) return;
    if (href === `./${currentPath}` || (currentPath === "" && href === "./index.html")) {
      link.setAttribute("aria-current", "page");
    }
  });
};

const bindGlobalEvents = () => {
  const onScroll = () => {
    if (state.ticking) return;
    state.ticking = true;
    requestAnimationFrame(() => {
      updateScrollState();
      state.ticking = false;
    });
  };

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("touchmove", onTouchHint, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("touchmove", onTouchHint);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("scroll", onScroll);
  };
};

const initCore = () => {
  state.pointer.rawX = 0.5;
  state.pointer.rawY = 0.38;
  state.pointer.smoothX = 0.5;
  state.pointer.smoothY = 0.38;

  initThemeToggle();
  const cleanupReveal = initRevealObserver();
  const cleanupTilt = initTiltCards();
  const cleanupVideos = initVideoFallbacks();
  initNavMicroStates();
  const cleanupGlobalEvents = bindGlobalEvents();

  updatePointerCSSVars();
  updateScrollState();
  animateSharedState();

  return () => {
    cleanupReveal?.();
    cleanupTilt?.();
    cleanupVideos?.();
    cleanupGlobalEvents?.();
    if (state.rafId) cancelAnimationFrame(state.rafId);
  };
};

const createRenderer = (canvas, alpha = true) => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(state.viewport.dpr);
  renderer.setSize(canvas.clientWidth || canvas.offsetWidth || window.innerWidth, canvas.clientHeight || canvas.offsetHeight || window.innerHeight, false);
  return renderer;
};

const createParticleField = ({
  count,
  radiusMin,
  radiusMax,
  flatten = 1,
  size = 0.02,
  color = "#ffffff",
  opacity = 0.8,
}) => {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = radiusMin + Math.random() * (radiusMax - radiusMin);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);

    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * flatten;
    positions[i * 3 + 2] = radius * Math.cos(phi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color,
    size,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  return new THREE.Points(geometry, material);
};

const createSoftRing = (radius, tube, color, opacity) =>
  new THREE.Mesh(
    new THREE.TorusGeometry(radius, tube, 24, 220),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );

const disposeSceneGraph = (scene, renderer) => {
  scene.traverse((object) => {
    if (object.geometry) object.geometry.dispose?.();
    if (object.material) {
      if (Array.isArray(object.material)) {
        object.material.forEach((material) => material.dispose?.());
      } else {
        object.material.dispose?.();
      }
    }
  });
  renderer.dispose();
};

const initHeroScene = () => {
  const canvas = document.getElementById("hero-canvas");
  const section = dom.heroSection;
  if (!canvas || !section) return null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 120);
  camera.position.set(0, 0.15, 10.8);

  const renderer = createRenderer(canvas, true);

  const rootGroup = new THREE.Group();
  const shellGroup = new THREE.Group();
  const ringGroup = new THREE.Group();
  const dataGroup = new THREE.Group();
  const sparkGroup = new THREE.Group();

  scene.add(rootGroup);
  rootGroup.add(shellGroup, ringGroup, dataGroup, sparkGroup);

  const ambient = new THREE.AmbientLight(0xffffff, 0.62);
  scene.add(ambient);

  const goldLight = new THREE.PointLight(0xf6d06c, 2.8, 50, 2);
  goldLight.position.set(-5.5, -2.5, 6.2);
  scene.add(goldLight);

  const blueLight = new THREE.PointLight(0x7ed7ff, 3.1, 60, 2);
  blueLight.position.set(5.8, 3.8, 7.4);
  scene.add(blueLight);

  const whiteLight = new THREE.PointLight(0xffffff, 1.3, 40, 2);
  whiteLight.position.set(0, 4.8, 5.2);
  scene.add(whiteLight);

  const crystalCore = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.2, 12),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ddecff"),
      metalness: 0.86,
      roughness: 0.14,
      transmission: 0.02,
      transparent: true,
      opacity: 0.3,
      wireframe: true,
      emissive: new THREE.Color("#69a9ff"),
      emissiveIntensity: 0.24,
      clearcoat: 1,
      clearcoatRoughness: 0.14,
    })
  );
  shellGroup.add(crystalCore);

  const innerSphere = new THREE.Mesh(
    new THREE.SphereGeometry(1.15, 48, 48),
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ffffff"),
      metalness: 0.4,
      roughness: 0.18,
      transparent: true,
      opacity: 0.12,
      emissive: new THREE.Color("#f7d26a"),
      emissiveIntensity: 0.36,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
    })
  );
  shellGroup.add(innerSphere);

  const outerHalo = new THREE.Mesh(
    new THREE.SphereGeometry(2.9, 48, 48),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color("#81d5ff"),
      transparent: true,
      opacity: 0.045,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  shellGroup.add(outerHalo);

  const ringA = createSoftRing(3.25, 0.026, "#f7d26a", 0.58);
  ringA.rotation.x = Math.PI / 2.05;
  ringA.rotation.y = Math.PI / 5;
  ringGroup.add(ringA);

  const ringB = createSoftRing(4.08, 0.018, "#eef5ff", 0.26);
  ringB.rotation.x = Math.PI / 1.75;
  ringB.rotation.z = Math.PI / 4.5;
  ringGroup.add(ringB);

  const ringC = createSoftRing(4.82, 0.024, "#81d5ff", 0.22);
  ringC.rotation.y = Math.PI / 3.2;
  ringC.rotation.z = Math.PI / 6.8;
  ringGroup.add(ringC);

  const starField = createParticleField({
    count: state.reduceMotion ? 520 : 1200,
    radiusMin: 3.6,
    radiusMax: 7.8,
    flatten: 0.72,
    size: 0.03,
    color: "#ffffff",
    opacity: 0.84,
  });
  scene.add(starField);

  const nearField = createParticleField({
    count: state.reduceMotion ? 180 : 420,
    radiusMin: 2.8,
    radiusMax: 4.8,
    flatten: 0.82,
    size: 0.045,
    color: "#81d5ff",
    opacity: 0.55,
  });
  sparkGroup.add(nearField);

  const arcMaterial = new THREE.LineBasicMaterial({
    color: "#81d5ff",
    transparent: true,
    opacity: 0.32,
    blending: THREE.AdditiveBlending,
  });

  const arcNodes = [];
  for (let i = 0; i < 7; i += 1) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-2.6 + i * 0.2, -1.1 + Math.sin(i) * 0.18, -1.6 + i * 0.12),
      new THREE.Vector3(-0.6 + i * 0.06, 1.2 + Math.cos(i) * 0.24, 0.4),
      new THREE.Vector3(2.6 - i * 0.18, -0.8 + Math.sin(i * 0.7) * 0.24, 1.8 - i * 0.18),
    ]);

    const points = curve.getPoints(80);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, arcMaterial.clone());
    line.rotation.y = (i / 7) * Math.PI;
    line.rotation.x = (i % 2 === 0 ? 1 : -1) * 0.18;
    dataGroup.add(line);
    arcNodes.push(line);
  }

  const signalNodes = [];
  const nodeGeometry = new THREE.SphereGeometry(0.072, 18, 18);

  for (let i = 0; i < 18; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: i % 3 === 0 ? "#f7d26a" : i % 2 === 0 ? "#81d5ff" : "#ffffff",
      transparent: true,
      opacity: 0.85,
    });
    const node = new THREE.Mesh(nodeGeometry, material);
    const radius = 2.6 + Math.random() * 2.1;
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 2.8;
    node.position.set(Math.cos(theta) * radius, y, Math.sin(theta) * radius * 0.82);
    signalNodes.push({
      mesh: node,
      baseRadius: radius,
      theta,
      speed: 0.12 + Math.random() * 0.26,
      lift: y,
    });
    dataGroup.add(node);
  }

  const resize = () => {
    const width = section.clientWidth || window.innerWidth;
    const height = section.clientHeight || window.innerHeight;
    renderer.setPixelRatio(state.viewport.dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 720 ? 12.4 : 10.8;
    camera.position.y = width < 720 ? 0.3 : 0.15;
    camera.updateProjectionMatrix();
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });

  const clock = new THREE.Clock();

  const update = () => {
    const elapsed = clock.getElapsedTime();
    const motion = state.reduceMotion ? 0.24 : 1;
    const pointerX = (state.pointer.smoothX - 0.5) * 2;
    const pointerY = (state.pointer.smoothY - 0.5) * 2;
    const heroProgress = state.scroll.heroProgress;

    crystalCore.rotation.x = elapsed * 0.08 * motion;
    crystalCore.rotation.y = elapsed * 0.22 * motion + heroProgress * 0.65;

    innerSphere.rotation.y = -elapsed * 0.14 * motion;
    outerHalo.scale.setScalar(1 + Math.sin(elapsed * 0.9) * 0.03 * motion);

    ringA.rotation.z = elapsed * 0.14 * motion;
    ringB.rotation.y = -elapsed * 0.08 * motion + heroProgress * 0.3;
    ringC.rotation.x = elapsed * 0.06 * motion;

    shellGroup.rotation.y += (pointerX * 0.34 - shellGroup.rotation.y) * 0.035;
    shellGroup.rotation.x += (-pointerY * 0.18 - shellGroup.rotation.x) * 0.035;

    rootGroup.position.y = Math.sin(elapsed * 0.92) * 0.16 * motion - heroProgress * 0.25;
    rootGroup.rotation.z = pointerX * 0.04;
    rootGroup.rotation.x = pointerY * 0.04;

    starField.rotation.y = -elapsed * 0.024 * motion;
    starField.rotation.x = Math.sin(elapsed * 0.18) * 0.06;

    nearField.rotation.y = elapsed * 0.12 * motion;
    nearField.rotation.z = elapsed * 0.08 * motion;

    arcNodes.forEach((line, index) => {
      line.rotation.z = Math.sin(elapsed * 0.35 + index * 0.6) * 0.12;
      line.material.opacity = 0.18 + (Math.sin(elapsed * 1.3 + index) + 1) * 0.09;
    });

    signalNodes.forEach((node, index) => {
      node.theta += node.speed * 0.004 * motion;
      node.mesh.position.x = Math.cos(node.theta + elapsed * node.speed * 0.22) * node.baseRadius;
      node.mesh.position.z = Math.sin(node.theta + elapsed * node.speed * 0.22) * node.baseRadius * 0.82;
      node.mesh.position.y = node.lift + Math.sin(elapsed * (0.8 + index * 0.03)) * 0.08;
      node.mesh.scale.setScalar(0.9 + Math.sin(elapsed * 2 + index) * 0.16);
    });

    goldLight.intensity = 2.4 + Math.sin(elapsed * 1.3) * 0.22;
    blueLight.intensity = 2.8 + Math.cos(elapsed * 1.1) * 0.25;
    whiteLight.intensity = 1.2 + Math.sin(elapsed * 0.8) * 0.12;

    renderer.render(scene, camera);
  };

  return {
    update,
    resize,
    dispose: () => {
      window.removeEventListener("resize", resize);
      disposeSceneGraph(scene, renderer);
    },
  };
};

const initRoadmapScene = () => {
  const canvas = document.getElementById("roadmap-canvas");
  const section = dom.roadmapSection;
  if (!canvas || !section) return null;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.set(0, 0.35, 12.8);

  const renderer = createRenderer(canvas, true);

  const rootGroup = new THREE.Group();
  const strandsGroup = new THREE.Group();
  const pulseGroup = new THREE.Group();
  const dustGroup = new THREE.Group();

  rootGroup.add(strandsGroup, pulseGroup, dustGroup);
  scene.add(rootGroup);

  const ambient = new THREE.AmbientLight(0xffffff, 0.58);
  scene.add(ambient);

  const leftLight = new THREE.PointLight(0xf7d26a, 2.2, 52, 2);
  leftLight.position.set(-6, 1.5, 5.8);
  scene.add(leftLight);

  const rightLight = new THREE.PointLight(0x81d5ff, 2.5, 60, 2);
  rightLight.position.set(6.2, -1.8, 6.5);
  scene.add(rightLight);

  const strandCurves = [];
  const lineMaterials = [];
  const pulseNodes = [];
  const colors = ["#81d5ff", "#f7d26a", "#eef5ff"];

  for (let s = 0; s < 3; s += 1) {
    const points = [];
    for (let i = 0; i < 8; i += 1) {
      const t = i / 7;
      const x = -5.6 + t * 11.2;
      const y = Math.sin(t * Math.PI * (2.2 + s * 0.7)) * (0.7 + s * 0.12) + (s - 1) * 0.54;
      const z = Math.cos(t * Math.PI * (2.6 + s * 0.4)) * 0.8;
      points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    strandCurves.push(curve);

    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(220));
    const material = new THREE.LineBasicMaterial({
      color: colors[s],
      transparent: true,
      opacity: s === 1 ? 0.62 : 0.38,
      blending: THREE.AdditiveBlending,
    });

    const line = new THREE.Line(geometry, material);
    strandsGroup.add(line);
    lineMaterials.push(material);
  }

  const nodeGeometry = new THREE.SphereGeometry(0.11, 22, 22);

  for (let i = 0; i < 8; i += 1) {
    const progress = i / 7;
    const color = i % 3 === 0 ? "#f7d26a" : i % 2 === 0 ? "#81d5ff" : "#ffffff";

    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
    });

    const node = new THREE.Mesh(nodeGeometry, material);
    pulseGroup.add(node);

    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 18, 18),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      })
    );
    pulseGroup.add(halo);

    pulseNodes.push({
      node,
      halo,
      progress,
      offset: i * 0.24,
      curveIndex: i % strandCurves.length,
    });
  }

  const roadmapDust = createParticleField({
    count: state.reduceMotion ? 180 : 420,
    radiusMin: 4.8,
    radiusMax: 10.5,
    flatten: 0.36,
    size: 0.028,
    color: "#c8ebff",
    opacity: 0.42,
  });
  dustGroup.add(roadmapDust);

  const verticalColumns = [];
  for (let i = 0; i < 6; i += 1) {
    const x = -4.8 + i * 1.92;
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, -2.8, -1.6),
      new THREE.Vector3(x, 2.8, -1.2),
    ]);
    const material = new THREE.LineBasicMaterial({
      color: i % 2 === 0 ? "#81d5ff" : "#f7d26a",
      transparent: true,
      opacity: 0.08,
    });
    const line = new THREE.Line(geometry, material);
    verticalColumns.push(line);
    pulseGroup.add(line);
  }

  const resize = () => {
    const width = section.clientWidth || window.innerWidth;
    const height = section.clientHeight || window.innerHeight;
    renderer.setPixelRatio(state.viewport.dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.position.z = width < 720 ? 14.8 : 12.8;
    camera.position.y = width < 720 ? 0.5 : 0.35;
    camera.updateProjectionMatrix();
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });

  const clock = new THREE.Clock();

  const update = () => {
    const elapsed = clock.getElapsedTime();
    const motion = state.reduceMotion ? 0.18 : 1;
    const pointerX = (state.pointer.smoothX - 0.5) * 2;
    const pointerY = (state.pointer.smoothY - 0.5) * 2;
    const progress = state.scroll.roadmapProgress;

    rootGroup.rotation.y += (pointerX * 0.12 - rootGroup.rotation.y) * 0.03;
    rootGroup.rotation.x += (pointerY * 0.06 - rootGroup.rotation.x) * 0.03;
    rootGroup.position.y = -progress * 1.1;
    rootGroup.position.z = progress * 0.35;

    strandsGroup.rotation.z = Math.sin(elapsed * 0.22) * 0.03;
    roadmapDust.rotation.y = elapsed * 0.025 * motion;

    pulseNodes.forEach((item, index) => {
      const animatedProgress = clamp(
        item.progress + Math.sin(elapsed * 0.35 + item.offset) * 0.02 + progress * 0.03,
        0,
        1
      );

      const point = strandCurves[item.curveIndex].getPointAt(animatedProgress);
      item.node.position.copy(point);
      item.halo.position.copy(point);

      const pulse = 1 + Math.sin(elapsed * 2.4 + index * 0.5) * 0.18;
      item.node.scale.setScalar(pulse);
      item.halo.scale.setScalar(1.6 + Math.sin(elapsed * 1.8 + index) * 0.25);

      item.node.material.opacity = 0.78 + Math.sin(elapsed * 2 + index) * 0.12;
      item.halo.material.opacity = 0.08 + Math.sin(elapsed * 2 + index) * 0.03;
    });

    lineMaterials.forEach((material, index) => {
      material.opacity = 0.24 + index * 0.08 + Math.sin(elapsed * 1.4 + index) * 0.06;
    });

    verticalColumns.forEach((line, index) => {
      line.material.opacity = 0.04 + Math.max(0, Math.sin(elapsed * 1.1 + index * 0.55)) * 0.07;
    });

    leftLight.intensity = 2 + Math.sin(elapsed * 1.2) * 0.16;
    rightLight.intensity = 2.3 + Math.cos(elapsed * 1.05) * 0.18;

    renderer.render(scene, camera);
  };

  return {
    update,
    resize,
    dispose: () => {
      window.removeEventListener("resize", resize);
      disposeSceneGraph(scene, renderer);
    },
  };
};

const initSurfaceMotion = () => {
  const heroStats = [...document.querySelectorAll(".glass-pill")];
  const roadmapItems = [...document.querySelectorAll(".roadmap-item")];
  const slabs = [...document.querySelectorAll(".info-slab")];
  const allTargets = [...heroStats, ...roadmapItems, ...slabs];

  if (!allTargets.length) return () => {};

  return () => {
    const scrollWave = state.scroll.progress;
    const heroWave = state.scroll.heroProgress;
    const roadmapWave = state.scroll.roadmapProgress;

    allTargets.forEach((item, index) => {
      const intensity = state.reduceMotion ? 0.35 : 1;
      const driftY = Math.sin(scrollWave * 8 + index * 0.45) * 6 * intensity;
      const driftX = Math.cos(scrollWave * 7 + index * 0.35) * 3 * intensity;
      const glow = 0.08 + Math.sin(scrollWave * 10 + index * 0.6) * 0.025;
      item.style.transform = `translate3d(${driftX.toFixed(2)}px, ${driftY.toFixed(2)}px, 0)`;
      item.style.boxShadow = `
        inset 0 1px 0 rgba(255,255,255,0.15),
        0 30px 80px rgba(0,0,0,0.38),
        0 0 ${Math.max(18, 30 + heroWave * 22 + roadmapWave * 18).toFixed(0)}px rgba(129,213,255,${glow.toFixed(3)})
      `;
    });
  };
};

const initMagneticButtons = () => {
  const buttons = [...document.querySelectorAll(".button, .theme-toggle")];
  if (!buttons.length) return () => {};

  const cleanups = [];

  const reset = (button) => {
    if (!button.matches(":hover")) button.style.transform = "";
  };

  buttons.forEach((button) => {
    let raf = null;

    const handlePointerMove = (event) => {
      if (state.reduceMotion || window.innerWidth < 900) return;

      const rect = button.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;

      const moveX = mapRange(x, 0, 1, -6, 6);
      const moveY = mapRange(y, 0, 1, -5, 5);

      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        button.style.transform = `translate3d(${moveX.toFixed(2)}px, ${moveY.toFixed(2)}px, 0)`;
        button.style.setProperty("--mouse-x", `${(x * 100).toFixed(2)}%`);
        button.style.setProperty("--mouse-y", `${(y * 100).toFixed(2)}%`);
      });
    };

    const handleLeave = () => reset(button);
    const handleBlur = () => reset(button);

    button.addEventListener("pointermove", handlePointerMove);
    button.addEventListener("pointerleave", handleLeave);
    button.addEventListener("blur", handleBlur);

    cleanups.push(() => {
      if (raf) cancelAnimationFrame(raf);
      button.removeEventListener("pointermove", handlePointerMove);
      button.removeEventListener("pointerleave", handleLeave);
      button.removeEventListener("blur", handleBlur);
      button.style.transform = "";
    });
  });

  return () => cleanups.forEach((cleanup) => cleanup());
};

const initParallaxMedia = () => {
  const heroVideo = document.querySelector(".hero-video");
  const communityVideo = document.querySelector(".section-video");
  const heroCanvas = document.getElementById("hero-canvas");
  const roadmapCanvas = document.getElementById("roadmap-canvas");

  return () => {
    const px = (state.pointer.smoothX - 0.5) * 2;
    const py = (state.pointer.smoothY - 0.5) * 2;
    const heroOffset = state.scroll.heroProgress;
    const roadmapOffset = state.scroll.roadmapProgress;

    if (heroVideo) {
      heroVideo.style.transform = `scale(1.08) translate3d(${(px * -14).toFixed(2)}px, ${(py * -10 + heroOffset * -18).toFixed(2)}px, 0)`;
    }

    if (communityVideo) {
      communityVideo.style.transform = `scale(1.06) translate3d(${(px * -8).toFixed(2)}px, ${(roadmapOffset * -24).toFixed(2)}px, 0)`;
    }

    if (heroCanvas) {
      heroCanvas.style.transform = `translate3d(${(px * 10).toFixed(2)}px, ${(py * 8).toFixed(2)}px, 0)`;
    }

    if (roadmapCanvas) {
      roadmapCanvas.style.transform = `translate3d(${(px * 6).toFixed(2)}px, ${(py * 4).toFixed(2)}px, 0)`;
    }
  };
};

const initSectionDepth = () => {
  const sections = [...document.querySelectorAll(".section, .hero-section")];
  if (!sections.length) return () => {};

  return () => {
    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const midpoint = rect.top + rect.height * 0.5;
      const distanceFromCenter = (midpoint - window.innerHeight * 0.5) / window.innerHeight;
      const drift = clamp(distanceFromCenter, -1.2, 1.2);
      const rotate = drift * -1.2;
      const translate = drift * -18;

      if (state.reduceMotion) {
        section.style.transform = "";
        return;
      }

      section.style.transform = `translate3d(0, ${translate.toFixed(2)}px, 0) rotateX(${rotate.toFixed(2)}deg)`;
      section.style.transformStyle = "preserve-3d";
    });
  };
};

const initFooterSignal = () => {
  const footer = document.querySelector(".site-footer");
  if (!footer) return () => {};

  return () => {
    const glowStrength = 0.08 + state.scroll.progress * 0.16;
    footer.style.boxShadow = `0 -20px 60px rgba(129, 213, 255, ${glowStrength.toFixed(3)})`;
  };
};

const initHeroStatsPulse = () => {
  const stats = [...document.querySelectorAll(".hero-stat, .glass-pill")];
  if (!stats.length) return () => {};

  return () => {
    const t = performance.now() * 0.001;

    stats.forEach((stat, index) => {
      const wave = Math.sin(t * 1.35 + index * 0.65);
      const glow = 0.08 + ((wave + 1) * 0.5) * 0.08;
      stat.style.borderColor = `rgba(255,255,255,${(0.12 + glow * 0.4).toFixed(3)})`;
      stat.style.boxShadow = `
        inset 0 1px 0 rgba(255,255,255,0.16),
        0 18px 52px rgba(0,0,0,0.28),
        0 0 ${Math.round(18 + glow * 90)}px rgba(129,213,255,${glow.toFixed(3)})
      `;
    });
  };
};

const initAdaptiveQuality = () => {
  let lowPower = false;
  let frameCount = 0;
  let lastTime = performance.now();

  const sample = () => {
    frameCount += 1;
    const now = performance.now();
    const delta = now - lastTime;

    if (delta >= 1000) {
      const fpsEstimate = Math.round((frameCount * 1000) / delta);
      frameCount = 0;
      lastTime = now;

      if (fpsEstimate < 38 && !lowPower) {
        lowPower = true;
        state.viewport.dpr = Math.min(state.viewport.dpr, 1.25);
      }
    }
  };

  const isLowPower = () => lowPower;

  return {
    sample,
    isLowPower,
  };
};

const initRuntimeAtmosphere = () => {
  const heroPanel = document.querySelector(".hero-panel");
  const productCards = [...document.querySelectorAll(".product-card")];
  const roadmapItems = [...document.querySelectorAll(".roadmap-item")];
  const communityMedia = document.querySelector(".community-media");

  return () => {
    const t = performance.now() * 0.001;
    const pointerX = (state.pointer.smoothX - 0.5) * 2;
    const pointerY = (state.pointer.smoothY - 0.5) * 2;

    if (heroPanel) {
      const shimmer = 0.12 + ((Math.sin(t * 1.1) + 1) * 0.5) * 0.08;
      heroPanel.style.boxShadow = `
        inset 0 1px 0 rgba(255,255,255,0.16),
        0 30px 80px rgba(0,0,0,0.38),
        0 0 ${Math.round(26 + shimmer * 90)}px rgba(247,210,106,${shimmer.toFixed(3)})
      `;
    }

    if (communityMedia) {
      const glow = 0.08 + state.scroll.roadmapProgress * 0.12;
      communityMedia.style.boxShadow = `
        inset 0 1px 0 rgba(255,255,255,0.16),
        0 35px 90px rgba(0,0,0,0.42),
        0 0 ${Math.round(30 + glow * 90)}px rgba(129,213,255,${glow.toFixed(3)})
      `;
    }

    productCards.forEach((card, index) => {
      const wave = Math.sin(t * 1.4 + index * 0.55);
      const rotate = state.reduceMotion ? 0 : wave * 0.9 + pointerY * 1.6;
      card.style.filter = `brightness(${(1 + wave * 0.015).toFixed(3)})`;
      if (window.innerWidth >= 900 && !state.reduceMotion && !card.matches(":hover")) {
        card.style.transform = `perspective(1400px) rotateX(${rotate.toFixed(2)}deg) rotateY(${(pointerX * 2.4).toFixed(
          2
        )}deg) translateY(${(wave * 2).toFixed(2)}px)`;
      }
    });

    roadmapItems.forEach((item, index) => {
      const flow = Math.sin(t * 1.1 + index * 0.4);
      item.style.borderColor = `rgba(255,255,255,${(0.1 + ((flow + 1) * 0.5) * 0.12).toFixed(3)})`;
    });
  };
};

const initAmbientOrbs = () => {
  const layers = [...document.querySelectorAll("[data-ambient-orb]")];
  if (!layers.length) return () => {};

  return () => {
    const t = performance.now() * 0.0006;
    const px = (state.pointer.smoothX - 0.5) * 2;
    const py = (state.pointer.smoothY - 0.5) * 2;

    layers.forEach((layer, index) => {
      const waveX = Math.sin(t * (1 + index * 0.14) + index) * 24;
      const waveY = Math.cos(t * (1.2 + index * 0.12) + index * 0.7) * 18;
      const driftX = waveX + px * (10 + index * 2);
      const driftY = waveY + py * (8 + index * 2);
      const scale = 1 + Math.sin(t * 2 + index * 0.4) * 0.04;

      layer.style.transform = `translate3d(${driftX.toFixed(2)}px, ${driftY.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
      layer.style.opacity = state.reduceMotion ? "0.45" : "0.72";
    });
  };
};

const initSignalGrid = () => {
  const grids = [...document.querySelectorAll("[data-signal-grid]")];
  if (!grids.length) return () => {};

  return () => {
    const progress = state.scroll.progress;
    const px = state.pointer.smoothX;
    const py = state.pointer.smoothY;
    const glowX = `${(px * 100).toFixed(2)}%`;
    const glowY = `${(py * 100).toFixed(2)}%`;
    const opacity = 0.08 + progress * 0.12;

    grids.forEach((grid, index) => {
      const drift = Math.sin(progress * 10 + index * 0.5) * 1.8;
      grid.style.setProperty("--grid-glow-x", glowX);
      grid.style.setProperty("--grid-glow-y", glowY);
      grid.style.setProperty("--grid-opacity", opacity.toFixed(3));
      grid.style.transform = `translate3d(0, ${drift.toFixed(2)}px, 0)`;
    });
  };
};

const initValueCounters = () => {
  const counters = [...document.querySelectorAll("[data-count-to]")];
  if (!counters.length) return () => {};

  const observed = new WeakSet();

  const parseTarget = (node) => {
    const raw = node.getAttribute("data-count-to") || "0";
    const suffix = node.getAttribute("data-count-suffix") || "";
    const prefix = node.getAttribute("data-count-prefix") || "";
    const decimals = Number(node.getAttribute("data-count-decimals") || "0");
    const target = Number(raw);
    return {
      target: Number.isFinite(target) ? target : 0,
      suffix,
      prefix,
      decimals: Number.isFinite(decimals) ? decimals : 0,
    };
  };

  const formatValue = (value, decimals, prefix, suffix) =>
    `${prefix}${value.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

  const animateCounter = (node) => {
    if (observed.has(node)) return;
    observed.add(node);

    const config = parseTarget(node);
    const start = performance.now();
    const duration = state.reduceMotion ? 500 : 1600;

    const tick = (now) => {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = config.target * eased;
      const rounded =
        config.decimals > 0 ? Number(current.toFixed(config.decimals)) : Math.round(current);

      node.textContent = formatValue(rounded, config.decimals, config.prefix, config.suffix);

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        node.textContent = formatValue(config.target, config.decimals, config.prefix, config.suffix);
      }
    };

    requestAnimationFrame(tick);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.45 }
  );

  counters.forEach((counter) => observer.observe(counter));
  return () => observer.disconnect();
};

const initPointerTrail = () => {
  const trail = document.querySelector("[data-pointer-trail]");
  if (!trail) return () => {};

  return () => {
    const x = state.pointer.smoothX * window.innerWidth;
    const y = state.pointer.smoothY * window.innerHeight;
    const scale = state.reduceMotion ? 0.75 : 1 + Math.sin(performance.now() * 0.002) * 0.04;

    trail.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`;
    trail.style.opacity = window.innerWidth < 900 ? "0" : state.reduceMotion ? "0.18" : "0.3";
  };
};

const initLuminousBorders = () => {
  const cards = [...document.querySelectorAll("[data-luminous-border]")];
  if (!cards.length) return () => {};

  return () => {
    const px = state.pointer.smoothX;
    const py = state.pointer.smoothY;
    const t = performance.now() * 0.0012;

    cards.forEach((card, index) => {
      const glowMix = 0.08 + ((Math.sin(t + index * 0.6) + 1) * 0.5) * 0.08;
      card.style.setProperty("--border-glow-x", `${(px * 100).toFixed(2)}%`);
      card.style.setProperty("--border-glow-y", `${(py * 100).toFixed(2)}%`);
      card.style.setProperty("--border-glow-strength", glowMix.toFixed(3));
    });
  };
};

const initScrollProgressRail = () => {
  const rail = document.querySelector("[data-scroll-rail]");
  if (!rail) return () => {};

  return () => {
    rail.style.transform = `scaleY(${clamp(state.scroll.progress, 0, 1).toFixed(4)})`;
    rail.style.opacity = state.scroll.y > 24 ? "1" : "0";
  };
};

const initKineticHeadings = () => {
  const headings = [...document.querySelectorAll("[data-kinetic-heading]")];
  if (!headings.length) return () => {};

  return () => {
    const t = performance.now() * 0.001;
    const px = (state.pointer.smoothX - 0.5) * 2;

    headings.forEach((heading, index) => {
      const shift = Math.sin(t * 0.8 + index * 0.5) * 2.4 + px * 4;
      heading.style.setProperty("--heading-shift", `${shift.toFixed(2)}px`);
      heading.style.letterSpacing = `${(0.02 + Math.abs(shift) * 0.002).toFixed(3)}em`;
    });
  };
};

const initCanvasAdaptiveResizer = (runtime, quality) => {
  const heroCanvas = document.getElementById("hero-canvas");
  const roadmapCanvas = document.getElementById("roadmap-canvas");
  let lastLowPowerState = quality.isLowPower();

  return () => {
    const currentLowPowerState = quality.isLowPower();
    if (currentLowPowerState === lastLowPowerState) return;
    lastLowPowerState = currentLowPowerState;

    state.viewport.dpr = currentLowPowerState
      ? Math.min(state.viewport.dpr, 1.2)
      : Math.min(window.devicePixelRatio || 1, 1.8);

    runtime.heroScene?.resize?.();
    runtime.roadmapScene?.resize?.();

    if (heroCanvas) {
      heroCanvas.style.filter = currentLowPowerState ? "saturate(0.94)" : "";
    }

    if (roadmapCanvas) {
      roadmapCanvas.style.filter = currentLowPowerState ? "saturate(0.94)" : "";
    }
  };
};

const initFocusModeMicrostates = () => {
  const focusables = [...document.querySelectorAll("a, button, input, textarea, select")];
  if (!focusables.length) return () => {};

  const handlers = [];

  focusables.forEach((node) => {
    const onFocus = () => {
      body.setAttribute("data-focus-mode", "true");
    };

    const onBlur = () => {
      requestAnimationFrame(() => {
        const active = document.activeElement;
        const stillInsideFocusable =
          active &&
          (active.matches?.("a, button, input, textarea, select") ||
            active.closest?.("a, button, input, textarea, select"));

        if (!stillInsideFocusable) {
          body.removeAttribute("data-focus-mode");
        }
      });
    };

    node.addEventListener("focus", onFocus);
    node.addEventListener("blur", onBlur);
    handlers.push(() => {
      node.removeEventListener("focus", onFocus);
      node.removeEventListener("blur", onBlur);
    });
  });

  return () => {
    handlers.forEach((cleanup) => cleanup());
    body.removeAttribute("data-focus-mode");
  };
};

const initSceneVisibilityControl = () => {
  const sceneState = {
    heroVisible: true,
    roadmapVisible: true,
    documentVisible: document.visibilityState !== "hidden",
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.target === dom.heroSection) {
          sceneState.heroVisible = entry.isIntersecting;
        }

        if (entry.target === dom.roadmapSection) {
          sceneState.roadmapVisible = entry.isIntersecting;
        }
      });
    },
    { threshold: 0.08 }
  );

  if (dom.heroSection) observer.observe(dom.heroSection);
  if (dom.roadmapSection) observer.observe(dom.roadmapSection);

  const handleVisibilityChange = () => {
    sceneState.documentVisible = document.visibilityState !== "hidden";
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  return {
    isHeroVisible: () => sceneState.documentVisible && sceneState.heroVisible,
    isRoadmapVisible: () => sceneState.documentVisible && sceneState.roadmapVisible,
    disconnect: () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    },
  };
};

const createRuntime = () => {
  const cleanupCore = initCore();

  const heroScene = initHeroScene();
  const roadmapScene = initRoadmapScene();
  const updateSurfaceMotion = initSurfaceMotion();
  const updateMagneticAtmosphere = initRuntimeAtmosphere();
  const updateParallaxMedia = initParallaxMedia();
  const updateSectionDepth = initSectionDepth();
  const updateFooterSignal = initFooterSignal();
  const updateHeroStatsPulse = initHeroStatsPulse();
  const updateAmbientOrbs = initAmbientOrbs();
  const updateSignalGrid = initSignalGrid();
  const updatePointerTrail = initPointerTrail();
  const updateLuminousBorders = initLuminousBorders();
  const updateScrollProgressRail = initScrollProgressRail();
  const updateKineticHeadings = initKineticHeadings();
  const cleanupMagneticButtons = initMagneticButtons();
  const cleanupCounters = initValueCounters();
  const cleanupFocusMode = initFocusModeMicrostates();
  const quality = initAdaptiveQuality();

  const runtime = {
    heroScene,
    roadmapScene,
  };

  const visibility = initSceneVisibilityControl();
  const updateAdaptiveResize = initCanvasAdaptiveResizer(runtime, quality);

  let runtimeRafId = null;

  const frame = () => {
    quality.sample();
    updateAdaptiveResize?.();

    if (visibility.isHeroVisible()) {
      heroScene?.update?.();
    }

    if (visibility.isRoadmapVisible()) {
      roadmapScene?.update?.();
    }

    updateSurfaceMotion?.();
    updateMagneticAtmosphere?.();
    updateParallaxMedia?.();
    updateSectionDepth?.();
    updateFooterSignal?.();
    updateHeroStatsPulse?.();
    updateAmbientOrbs?.();
    updateSignalGrid?.();
    updatePointerTrail?.();
    updateLuminousBorders?.();
    updateScrollProgressRail?.();
    updateKineticHeadings?.();

    runtimeRafId = requestAnimationFrame(frame);
  };

  const destroy = () => {
    cleanupMagneticButtons?.();
    cleanupCounters?.();
    cleanupFocusMode?.();
    cleanupCore?.();
    visibility.disconnect?.();
    heroScene?.dispose?.();
    roadmapScene?.dispose?.();
    if (runtimeRafId) cancelAnimationFrame(runtimeRafId);
    if (state.rafId) cancelAnimationFrame(state.rafId);
  };

  frame();

  window.addEventListener("beforeunload", destroy, { once: true });

  return {
    ...runtime,
    destroy,
  };
};

createRuntime();