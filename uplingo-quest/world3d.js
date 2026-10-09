// UpLingo Quest · 3D low-poly world map (three.js r128, global THREE).
// Each coursebook unit is a floating diorama island; the current unit carries the class
// stops (e.g. 5A + 5B … 5G + 5H) and a boss tile. Islands are joined by wooden bridges.
// The module draws the scene and reports where each stop lands on screen, so the React
// layer can put tap targets, labels and pins over the canvas.
(function () {
  'use strict';

  const COLORS = {
    grass: 0x5cc24f, grassDark: 0x47a43d, sand: 0xf0d29a, sandDark: 0xdcb878, water: 0x3fb2f0, waterDeep: 0x2a8fd6,
    dirt: 0x8a5a36, dirtDark: 0x6e4529, stone: 0xb9bcc4, wood: 0x9b6436, woodDark: 0x7a4b28,
    leaf: 0x3fae4a, leafDark: 0x2e8a3a, pine: 0x2f8f55, trunk: 0x7b4a2a,
    path: 0xf3e6c8, done: 0xf5b83d, current: 0x3df58a, todo: 0xe9e2cf, boss: 0x8b5cf6,
  };
  const ISLAND = 5;          // tiles per side
  const TILE = 1;
  const BASE_H = 0.55;

  // Deterministic random so islands look the same on every visit.
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const grey = (hex, amt) => {
    const c = new THREE.Color(hex);
    const l = c.r * 0.3 + c.g * 0.59 + c.b * 0.11;
    return new THREE.Color(c.r + (l - c.r) * amt, c.g + (l - c.g) * amt, c.b + (l - c.b) * amt).multiplyScalar(1 - amt * 0.45);
  };

  // Themes keyed by unit topic; anything unknown falls back to a park.
  const THEMES = {
    bazaar: { top: 'sand', water: false },
    beach: { top: 'sand', water: true },
    park: { top: 'grass', water: false },
    camp: { top: 'grass', water: false },
    stage: { top: 'stone', water: false },
    market: { top: 'stone', water: false },
  };

  function build(container, opts) {
    const W = () => container.clientWidth || 360;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);
    const dir = new THREE.Vector3(1, 1.05, 1).normalize();

    scene.add(new THREE.HemisphereLight(0xeaffef, 0x1b2a20, 0.75));
    const sun = new THREE.DirectionalLight(0xfff3dc, 0.95);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    scene.add(sun);
    scene.add(sun.target);

    const mats = new Map();
    const mat = (color, locked, extra) => {
      const key = color + ':' + (locked ? 1 : 0) + ':' + (extra ? JSON.stringify(extra) : '');
      if (!mats.has(key)) {
        const c = locked ? grey(color, 0.75) : new THREE.Color(color);
        mats.set(key, new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, metalness: 0, ...(extra || {}) }));
      }
      return mats.get(key);
    };
    const mesh = (geo, material, x, y, z, parent) => {
      const m = new THREE.Mesh(geo, material);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      (parent || scene).add(m);
      return m;
    };

    const animated = [];
    const anchors = [];      // { key, obj, offsetY }
    const islands = [];

    // ---------- props
    const tree = (g, x, z, s, L) => {
      mesh(new THREE.CylinderGeometry(0.06 * s, 0.09 * s, 0.45 * s, 6), mat(COLORS.trunk, L), x, 0.22 * s, z, g);
      mesh(new THREE.IcosahedronGeometry(0.42 * s, 0), mat(COLORS.leaf, L), x, 0.68 * s, z, g);
      mesh(new THREE.IcosahedronGeometry(0.28 * s, 0), mat(COLORS.leafDark, L), x + 0.15 * s, 0.95 * s, z - 0.08 * s, g);
    };
    const pine = (g, x, z, s, L) => {
      mesh(new THREE.CylinderGeometry(0.05 * s, 0.07 * s, 0.3 * s, 6), mat(COLORS.trunk, L), x, 0.15 * s, z, g);
      mesh(new THREE.ConeGeometry(0.42 * s, 0.6 * s, 7), mat(COLORS.pine, L), x, 0.55 * s, z, g);
      mesh(new THREE.ConeGeometry(0.3 * s, 0.5 * s, 7), mat(COLORS.leafDark, L), x, 0.88 * s, z, g);
    };
    const palm = (g, x, z, s, L) => {
      for (let i = 0; i < 5; i++) mesh(new THREE.CylinderGeometry(0.05 * s, 0.065 * s, 0.24 * s, 6), mat(i % 2 ? 0x9a6b3c : 0xb07a46, L), x + i * 0.035 * s, 0.12 * s + i * 0.22 * s, z, g);
      const top = new THREE.Group(); top.position.set(x + 0.17 * s, 1.15 * s, z); g.add(top);
      for (let i = 0; i < 6; i++) {
        const leaf = mesh(new THREE.BoxGeometry(0.62 * s, 0.03, 0.16 * s), mat(i % 2 ? COLORS.leaf : COLORS.leafDark, L), 0, 0, 0, top);
        leaf.rotation.y = (i / 6) * Math.PI * 2; leaf.rotation.z = -0.35;
        leaf.position.set(Math.cos(leaf.rotation.y) * 0.26 * s, -0.05, -Math.sin(leaf.rotation.y) * 0.26 * s);
      }
    };
    const umbrella = (g, x, z, L, color) => {
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 5), mat(0xffffff, L), x, 0.35, z, g);
      mesh(new THREE.ConeGeometry(0.42, 0.2, 8), mat(color, L), x, 0.72, z, g);
    };
    const bench = (g, x, z, rot, L) => {
      const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = rot; g.add(b);
      mesh(new THREE.BoxGeometry(0.6, 0.05, 0.2), mat(COLORS.wood, L), 0, 0.2, 0, b);
      mesh(new THREE.BoxGeometry(0.6, 0.18, 0.04), mat(COLORS.woodDark, L), 0, 0.33, -0.09, b);
      mesh(new THREE.BoxGeometry(0.04, 0.2, 0.18), mat(0x333a35, L), -0.26, 0.1, 0, b);
      mesh(new THREE.BoxGeometry(0.04, 0.2, 0.18), mat(0x333a35, L), 0.26, 0.1, 0, b);
    };
    const lamp = (g, x, z, L) => {
      mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.75, 6), mat(0x2b322e, L), x, 0.38, z, g);
      const bulb = mesh(new THREE.SphereGeometry(0.07, 8, 6), mat(0xffe8a3, L, L ? null : { emissive: 0xffd36b, emissiveIntensity: 0.9 }), x, 0.79, z, g);
      bulb.castShadow = false;
    };
    const fountain = (g, x, z, L) => {
      mesh(new THREE.CylinderGeometry(0.5, 0.55, 0.16, 12), mat(COLORS.stone, L), x, 0.08, z, g);
      const w = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 12), mat(COLORS.water, L), x, 0.17, z, g);
      mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 8), mat(COLORS.stone, L), x, 0.3, z, g);
      if (!L) animated.push((t) => { w.position.y = 0.17 + Math.sin(t * 2) * 0.01; });
    };
    const tent = (g, x, z, L) => {
      const t = mesh(new THREE.ConeGeometry(0.55, 0.65, 4), mat(0xf2b53a, L), x, 0.33, z, g);
      t.rotation.y = Math.PI / 4;
      mesh(new THREE.BoxGeometry(0.16, 0.24, 0.02), mat(0x5a3a1a, L), x + 0.18, 0.12, z + 0.2, g).rotation.y = Math.PI / 4;
    };
    const campfire = (g, x, z, L) => {
      for (let i = 0; i < 3; i++) mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.36, 5), mat(COLORS.trunk, L), x, 0.05, z, g).rotation.set(Math.PI / 2, i * 1.05, 0);
      const f = mesh(new THREE.ConeGeometry(0.12, 0.3, 6), mat(0xff8a2a, L, L ? null : { emissive: 0xff6a00, emissiveIntensity: 1 }), x, 0.2, z, g);
      f.castShadow = false;
      if (!L) animated.push((t) => { const k = 1 + Math.sin(t * 9) * 0.12 + Math.sin(t * 13) * 0.06; f.scale.set(k, k * 1.1, k); });
    };
    const dome = (g, x, z, L) => {
      mesh(new THREE.BoxGeometry(0.9, 0.55, 0.9), mat(0xe8d3a8, L), x, 0.28, z, g);
      mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.18, 12), mat(0xd8c08f, L), x, 0.64, z, g);
      mesh(new THREE.SphereGeometry(0.36, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x1fb5c9, L), x, 0.73, z, g);
      mesh(new THREE.BoxGeometry(0.26, 0.34, 0.04), mat(0x1c7f8f, L), x, 0.2, z + 0.46, g);
      // Slim tower beside it.
      mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.2, 10), mat(0xe2c99a, L), x + 0.65, 0.6, z - 0.3, g);
      mesh(new THREE.ConeGeometry(0.12, 0.2, 10), mat(0x1fb5c9, L), x + 0.65, 1.3, z - 0.3, g);
    };
    const stall = (g, x, z, color, L) => {
      mesh(new THREE.BoxGeometry(0.6, 0.3, 0.4), mat(COLORS.wood, L), x, 0.15, z, g);
      for (let i = 0; i < 4; i++) mesh(new THREE.BoxGeometry(0.15, 0.04, 0.5), mat(i % 2 ? 0xffffff : color, L), x - 0.225 + i * 0.15, 0.56, z, g);
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 4), mat(COLORS.woodDark, L), x - 0.28, 0.28, z + 0.22, g);
      mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 4), mat(COLORS.woodDark, L), x + 0.28, 0.28, z + 0.22, g);
      mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(0xff7a2a, L), x - 0.12, 0.34, z, g);
      mesh(new THREE.SphereGeometry(0.07, 6, 5), mat(0x7ac943, L), x + 0.05, 0.34, z, g);
    };
    const rock = (g, x, z, s, L) => mesh(new THREE.DodecahedronGeometry(0.16 * s, 0), mat(0x9aa0a6, L), x, 0.08 * s, z, g);
    const flower = (g, x, z, c, L) => mesh(new THREE.SphereGeometry(0.05, 5, 4), mat(c, L), x, 0.05, z, g);

    // ---------- an island: tiled block base + props
    const addIsland = (spec, center) => {
      const L = spec.locked;
      const g = new THREE.Group();
      g.position.copy(center);
      scene.add(g);
      const r = rng(spec.unit * 97 + 13);
      const theme = THEMES[spec.theme] || THEMES.park;
      const topCol = { grass: [COLORS.grass, COLORS.grassDark], sand: [COLORS.sand, COLORS.sandDark], stone: [0xc9ccd2, 0xb6bac2] }[theme.top];
      const N = spec.size || ISLAND;
      const half = (N - 1) / 2;
      const k5 = (N - 1) / 4;  // layout below is written for a 5×5 island; scale it to N×N
      const props = new THREE.Group(); props.position.y = BASE_H + 0.12; g.add(props);
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const x = (i - half) * TILE, z = (j - half) * TILE;
          const isWater = theme.water && (i === N - 1 || (j === N - 1 && i >= 2));
          const hgt = BASE_H + (r() - 0.5) * 0.08 - (isWater ? 0.1 : 0);
          mesh(new THREE.BoxGeometry(TILE * 0.97, hgt, TILE * 0.97), mat((i + j) % 2 ? COLORS.dirt : COLORS.dirtDark, L), x, hgt / 2 - 0.12, z, g);
          const top = isWater ? ((i + j) % 2 ? COLORS.water : COLORS.waterDeep) : topCol[(i * 3 + j) % 2];
          const t = mesh(new THREE.BoxGeometry(TILE * 0.97, 0.14, TILE * 0.97), mat(top, L), x, hgt - 0.05, z, g);
          if (isWater && !L) { const y0 = t.position.y, ph = i + j; animated.push((tt) => { t.position.y = y0 + Math.sin(tt * 1.6 + ph) * 0.02; }); }
        }
      }
      // Theme dressing (positions on the 5×5 grid, leaving the middle row for the path).
      const P = (i, j) => [(i * k5 - half) * TILE, (j * k5 - half) * TILE];
      const put = (fn, i, j, ...a) => { const [x, z] = P(i, j); fn(props, x + (r() - 0.5) * 0.2, z + (r() - 0.5) * 0.2, ...a); };
      if (spec.theme === 'beach') {
        put(palm, 0, 0, 1, L); put(palm, 1, 4, 0.9, L); put(palm, 3, 0, 1.1, L);
        put(umbrella, 2, 3, L, 0xff5a5a); put(umbrella, 0, 3, L, 0x3df58a); put(rock, 4, 0, 1.2, L);
      } else if (spec.theme === 'bazaar') {
        put(dome, 0, 0, L); put(stall, 3, 0, 0xff5a5a, L); put(stall, 0, 3, 0x2a8fd6, L);
        put(stall, 3, 4, 0xf5b83d, L); put(tree, 4, 2, 0.8, L); put(rock, 2, 4, 0.8, L);
      } else if (spec.theme === 'camp') {
        put(tent, 0, 0, L); put(campfire, 1, 1, L); put(pine, 3, 0, 1.1, L); put(pine, 4, 1, 0.9, L);
        put(pine, 0, 4, 1, L); put(pine, 4, 4, 1.2, L); put(rock, 3, 3, 1, L);
      } else {
        put(tree, 0, 0, 1.1, L); put(tree, 4, 0, 0.9, L); put(tree, 0, 4, 1, L); put(fountain, 3, 3, L);
        put(bench, 1, 0, 0, L); put(bench, 4, 2, -Math.PI / 2, L); put(lamp, 2, 4, L); put(lamp, 4, 4, L);
        for (let k = 0; k < 7; k++) put(flower, Math.floor(r() * 5), Math.floor(r() * 2) * 4, [0xffe066, 0xff9ec7, 0xffffff][k % 3], L);
      }
      // Path stones across the island (diagonal), with class stops on them.
      const stops = spec.stops || [];
      const route = [[0.2, 0.9], [1.0, 1.6], [1.7, 2.4], [2.4, 3.1], [3.2, 3.6], [3.9, 4.1]];
      // Classes fill the route in order; the boss always waits on the last tile.
      const slot = route.map(() => null);
      stops.forEach((st, k) => { slot[st.state === 'boss' ? route.length - 1 : Math.min(k, route.length - 2)] = st; });
      route.forEach(([i, j], k) => {
        const [x, z] = [(i * k5 - half) * TILE, (j * k5 - half) * TILE];
        const st = slot[k];
        const color = !st ? COLORS.path : st.state === 'done' ? COLORS.done : st.state === 'current' ? COLORS.current : st.state === 'boss' ? COLORS.boss : COLORS.todo;
        const extra = st && st.state === 'current' && !L ? { emissive: 0x1aa85a, emissiveIntensity: 0.6 } : null;
        const tileM = mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.1, st ? 16 : 7), mat(color, L, extra), x, 0.04, z, props);
        if (st && st.state === 'current' && !L) animated.push((t) => { tileM.material.emissiveIntensity = 0.35 + Math.abs(Math.sin(t * 2.4)) * 0.6; });
        if (st) anchors.push({ key: st.key, obj: tileM, offsetY: 0.1 });
      });
      // Name tag sits over the back corner, clear of the path.
      const tag = new THREE.Object3D(); tag.position.set(-half * 0.95, 0, -half * 0.95); g.add(tag);
      anchors.push({ key: 'island-' + spec.unit, obj: tag, offsetY: BASE_H + 0.9 });
      islands.push({ g, spec, half });
    };

    const bridge = (a, b, ha, hb) => {
      const from = new THREE.Vector3(a.x + ha - 0.3, 0.38, a.z + ha - 0.3), to = new THREE.Vector3(b.x - hb + 0.3, 0.38, b.z - hb + 0.3);
      const n = Math.max(3, Math.round(from.distanceTo(to) / 0.32));
      const yaw = Math.atan2(to.x - from.x, to.z - from.z);
      for (let k = 0; k <= n; k++) {
        const p = from.clone().lerp(to, k / n);
        p.y += Math.sin((k / n) * Math.PI) * -0.25;
        const plank = mesh(new THREE.BoxGeometry(0.62, 0.06, 0.2), mat(k % 2 ? COLORS.wood : COLORS.woodDark, false), p.x, p.y, p.z);
        plank.rotation.y = yaw;
      }
    };

    // Shadow catcher so islands float above their shadows.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.ShadowMaterial({ opacity: 0.35 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.6; floor.receiveShadow = true;
    scene.add(floor);

    // Lay the islands out down the screen in a gentle zigzag.
    const centers = [];
    let hPrev = 0;
    let along = 0;
    opts.islands.forEach((spec, i) => {
      const hHere = ((spec.size || ISLAND) - 1) / 2 + 0.5;
      if (i > 0) along += hPrev + hHere + 2.4;
      const side = (i % 2 ? 1 : -1) * 0.9;
      const c = new THREE.Vector3(along + side, 0, along - side);
      centers.push(c);
      addIsland(spec, c);
      hPrev = hHere;
    });
    for (let i = 0; i < centers.length - 1; i++) bridge(centers[i], centers[i + 1], islands[i].half + 0.5, islands[i + 1].half + 0.5);

    // Fit the orthographic camera to the islands; the canvas gets as tall as it needs.
    const mid = centers[0].clone().add(centers[centers.length - 1]).multiplyScalar(0.5);
    camera.position.copy(mid).addScaledVector(dir, 60);
    camera.lookAt(mid);
    camera.updateMatrixWorld();
    // Frame each island's own box (one box around a diagonal layout would leave huge empty corners).
    const box = new THREE.Box3();
    const pts = [];
    islands.forEach(({ g }) => {
      const b = new THREE.Box3().expandByObject(g);
      box.union(b);
      [b.min.x, b.max.x].forEach((x) => [b.min.y - 0.4, b.max.y].forEach((y) => [b.min.z, b.max.z].forEach((z) => pts.push(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse)))));
    });
    const minX = Math.min(...pts.map((p) => p.x)), maxX = Math.max(...pts.map((p) => p.x));
    const minY = Math.min(...pts.map((p) => p.y)), maxY = Math.max(...pts.map((p) => p.y));
    const padX = 0.3, padTop = 2.4, padBottom = 1.2;
    camera.left = minX - padX; camera.right = maxX + padX; camera.top = maxY + padTop; camera.bottom = minY - padBottom;
    const aspect = (camera.top - camera.bottom) / (camera.right - camera.left);

    // Sun covers the whole layout.
    sun.position.copy(mid).add(new THREE.Vector3(-14, 26, 10));
    sun.target.position.copy(mid);
    const span = box.getSize(new THREE.Vector3()).length() / 2 + 4;
    Object.assign(sun.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: 1, far: 120 });
    sun.shadow.camera.updateProjectionMatrix();

    const size = () => {
      const w = W(), hgt = Math.round(w * aspect);
      renderer.setSize(w, hgt, false);
      renderer.domElement.style.height = hgt + 'px';
      container.style.height = hgt + 'px';
      camera.updateProjectionMatrix();
      return { w, h: hgt };
    };
    const project = () => {
      const { w, h } = size();
      const out = {};
      const v = new THREE.Vector3();
      anchors.forEach((a) => {
        a.obj.getWorldPosition(v); v.y += a.offsetY;
        v.project(camera);
        out[a.key] = { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
      });
      if (opts.onLayout) opts.onLayout(out, { w, h });
    };

    // Render only while on screen.
    let raf = 0, visible = true, t0 = performance.now();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) return;
      const t = (performance.now() - t0) / 1000;
      animated.forEach((fn) => fn(t));
      renderer.render(scene, camera);
    };
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = 'IntersectionObserver' in window ? new IntersectionObserver((e) => { visible = e[0].isIntersecting; }) : null;
    if (io) io.observe(container);
    const onResize = () => { project(); renderer.render(scene, camera); };
    window.addEventListener('resize', onResize);
    project();
    renderer.render(scene, camera);
    if (!reduced) loop();

    return {
      destroy() {
        cancelAnimationFrame(raf);
        if (io) io.disconnect();
        window.removeEventListener('resize', onResize);
        scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
        mats.forEach((m) => m.dispose());
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      },
    };
  }

  window.World3D = { build, available: () => typeof window.THREE !== 'undefined' };
})();
