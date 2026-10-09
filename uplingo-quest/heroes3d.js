// UpLingo Quest · 3D scholar heroes built from code (three.js r128, global THREE).
// Chibi proportions, toon shading and an inverted-hull outline for a bold cartoon look.
// buildHero() returns a THREE.Group; mountStage() shows one hero turning on the lobby
// pedestal; portrait() renders a hero to an image for lists, cards and map pins.
(function () {
  'use strict';
  if (typeof THREE === 'undefined') { window.Heroes3D = { available: () => false }; return; }

  // Outfit colours per class (black/emerald base with a class accent).
  const STYLE = {
    wordsmith: { main: 0x0f7a3e, dark: 0x16241b, trim: 0xf2c94c, accent: 0xfff1c9 },
    knight: { main: 0x9fb2bd, dark: 0x1b2a22, trim: 0x18b45a, accent: 0xe8eef2 },
    ranger: { main: 0x2e5e3c, dark: 0x101a14, trim: 0x2cff8c, accent: 0x3df58a },
    keeper: { main: 0x0e8f7a, dark: 0x13261c, trim: 0xf5b83d, accent: 0xfff3b0 },
    orator: { main: 0x1b1f1d, dark: 0x0b0f0d, trim: 0x2cff8c, accent: 0x13a85a },
    scribe: { main: 0x1d4d3a, dark: 0x0f1914, trim: 0xd9a441, accent: 0x2b4fd8 },
  };
  const SKINS = { light: 0xf1c6a0, medium: 0xd39a6a, tan: 0xa8703f };
  const HAIR = { m: 0x2a1a10, f: 0x4a2716 };

  // Three-step toon ramp.
  const ramp = new THREE.DataTexture(new Uint8Array([70, 70, 70, 160, 160, 160, 255, 255, 255]), 3, 1, THREE.RGBFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const toonCache = new Map();
  const toon = (color, glow) => {
    const k = color + ':' + (glow || 0);
    if (!toonCache.has(k)) {
      toonCache.set(k, new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...(glow ? { emissive: color, emissiveIntensity: glow } : {}) }));
    }
    return toonCache.get(k);
  };
  const OUTLINE = new THREE.MeshBasicMaterial({ color: 0x0a0f0c, side: THREE.BackSide });

  // Add a mesh (optionally with an outline shell) to a parent.
  const part = (parent, geo, mat, x, y, z, outline = 0.07) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (outline) {
      const o = new THREE.Mesh(geo, OUTLINE);
      o.scale.setScalar(1 + outline);
      m.add(o);
    }
    parent.add(m);
    return m;
  };

  // Letters on the knight's shield.
  const letterTexture = (txt, bg, fg) => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, 128, 128);
    x.fillStyle = fg; x.font = 'bold 44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(txt, 64, 66);
    const t = new THREE.CanvasTexture(c);
    return t;
  };

  function buildHero({ cls = 'knight', g = 'm', skin = 'light', hijab } = {}) {
    const S = STYLE[cls] || STYLE.knight;
    const skinC = SKINS[skin] || SKINS.light;
    const covered = g === 'f' && (hijab === undefined ? ['knight', 'orator', 'keeper'].includes(cls) : hijab);
    const root = new THREE.Group();
    const body = new THREE.Group(); root.add(body);

    // Legs, or a long skirt for girls (modest, floor length).
    if (g === 'f') {
      part(body, new THREE.CylinderGeometry(0.3, 0.5, 0.78, 20), toon(S.main), 0, 0.43, 0);
      part(body, new THREE.CylinderGeometry(0.505, 0.5, 0.08, 20), toon(S.trim), 0, 0.07, 0, 0.03);
      [-0.15, 0.15].forEach((x) => part(body, new THREE.BoxGeometry(0.17, 0.08, 0.24), toon(S.dark), x, 0.03, 0.12, 0.04));
    } else {
      [-0.14, 0.14].forEach((x) => {
        part(body, new THREE.CylinderGeometry(0.11, 0.1, 0.46, 12), toon(S.dark), x, 0.3, 0);
        part(body, new THREE.BoxGeometry(0.2, 0.11, 0.3), toon(0x111a14), x, 0.06, 0.04, 0.05);
      });
    }
    // Torso and belt.
    const torso = part(body, new THREE.CylinderGeometry(0.3, 0.36, 0.62, 20), toon(S.main), 0, 0.86, 0);
    part(body, new THREE.CylinderGeometry(0.37, 0.37, 0.08, 20), toon(S.trim), 0, 0.6, 0, 0.03);
    part(body, new THREE.SphereGeometry(0.31, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(S.main), 0, 1.16, 0, 0.04);
    if (cls === 'knight') {
      part(body, new THREE.BoxGeometry(0.46, 0.42, 0.16), toon(0xe3eaee), 0, 0.92, 0.26, 0.04);
      part(body, new THREE.BoxGeometry(0.08, 0.36, 0.17), toon(S.trim), 0, 0.92, 0.27, 0);
      [-0.36, 0.36].forEach((x) => part(body, new THREE.SphereGeometry(0.15, 14, 10), toon(0xd5dde2), x, 1.12, 0, 0.05));
    }
    if (cls === 'orator' || cls === 'wordsmith') {
      // Short cape behind the shoulders.
      const cape = part(body, new THREE.CylinderGeometry(0.34, 0.5, 0.85, 20, 1, true, Math.PI * 0.55, Math.PI * 0.9), toon(cls === 'orator' ? S.accent : S.dark), 0, 0.78, -0.02, 0.02);
      cape.material = cape.material.clone(); cape.material.side = THREE.DoubleSide;
    }
    // Neck and head.
    part(body, new THREE.CylinderGeometry(0.1, 0.12, 0.14, 12), toon(skinC), 0, 1.24, 0, 0);
    const head = new THREE.Group(); head.position.set(0, 1.66, 0); body.add(head);
    part(head, new THREE.SphereGeometry(0.52, 28, 20), toon(skinC), 0, 0, 0, 0.04);
    // Face: big eyes with highlights, brows, smile, cheeks.
    [-0.18, 0.18].forEach((x) => {
      const eye = part(head, new THREE.SphereGeometry(0.085, 14, 10), new THREE.MeshBasicMaterial({ color: 0x1b1410 }), x, -0.02, 0.46, 0);
      eye.scale.set(1, 1.3, 0.55);
      part(head, new THREE.SphereGeometry(0.028, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), x + 0.03, 0.03, 0.51, 0);
      const brow = part(head, new THREE.BoxGeometry(0.15, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0x2a1a10 }), x, 0.15, 0.47, 0);
      brow.rotation.z = x > 0 ? -0.18 : 0.18;
      const cheek = part(head, new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xf2908a, transparent: true, opacity: 0.55 }), x * 1.45, -0.14, 0.42, 0);
      cheek.scale.set(1.2, 0.7, 0.3);
    });
    const mouth = part(head, new THREE.TorusGeometry(0.07, 0.018, 6, 14, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7a2a22 }), 0, -0.16, 0.49, 0);
    mouth.rotation.z = Math.PI;

    // Hair or headscarf.
    if (covered) {
      const gap = Math.PI * 0.4;
      const scarf = part(head, new THREE.SphereGeometry(0.6, 28, 20, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, 0, Math.PI * 0.86), toon(S.trim === 0xf5b83d ? 0x1f8a4c : S.trim), 0, 0.02, -0.02, 0.03);
      scarf.material = scarf.material.clone(); scarf.material.side = THREE.DoubleSide;
      part(head, new THREE.TorusGeometry(0.45, 0.07, 10, 28, Math.PI * 1.15), toon(S.trim === 0xf5b83d ? 0x1f8a4c : S.trim), 0, 0.04, 0.3, 0.02).rotation.set(0, 0, -Math.PI * 0.075 + Math.PI);
      part(body, new THREE.CylinderGeometry(0.3, 0.45, 0.32, 20), toon(S.trim === 0xf5b83d ? 0x1f8a4c : S.trim), 0, 1.2, 0, 0.04);
    } else {
      const cap = part(head, new THREE.SphereGeometry(0.56, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.52), toon(HAIR[g]), 0, 0.04, -0.03, 0.04);
      cap.rotation.x = -0.28;
      [-0.22, -0.06, 0.1, 0.24].forEach((x, i) => {
        const tuft = part(head, new THREE.ConeGeometry(0.11, 0.26, 6), toon(HAIR[g]), x, 0.33, 0.36, 0.05);
        tuft.rotation.set(2.1, 0, (i - 1.5) * 0.25);
      });
      if (g === 'f') {
        part(head, new THREE.CylinderGeometry(0.36, 0.42, 0.7, 16), toon(HAIR[g]), 0, -0.28, -0.22, 0.04);
        part(head, new THREE.SphereGeometry(0.12, 10, 8), toon(S.trim), 0.36, 0.2, -0.1, 0.05);
      }
    }
    if (cls === 'knight' && !covered) {
      const helm = part(head, new THREE.SphereGeometry(0.6, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), toon(0xd5dde2), 0, 0.05, 0, 0.04);
      helm.rotation.x = -0.12;
      part(head, new THREE.BoxGeometry(0.1, 0.42, 0.08), toon(S.trim), 0, 0.42, 0.18, 0.04);
    }
    if (cls === 'ranger') {
      const band = part(head, new THREE.TorusGeometry(0.6, 0.045, 8, 24, Math.PI), toon(0x222b26), 0, 0.02, 0, 0.04);
      band.rotation.y = Math.PI / 2;
      [-0.6, 0.6].forEach((x) => { const cup = part(head, new THREE.CylinderGeometry(0.17, 0.17, 0.12, 16), toon(S.trim, 0.25), x, 0, 0, 0.05); cup.rotation.z = Math.PI / 2; });
    }

    // Arms: pivot at the shoulders so they can swing.
    const arm = (side) => {
      const a = new THREE.Group(); a.position.set(side * 0.38, 1.1, 0); body.add(a);
      part(a, new THREE.CylinderGeometry(0.085, 0.075, 0.42, 10), toon(S.main), 0, -0.2, 0, 0.06);
      part(a, new THREE.SphereGeometry(0.1, 12, 10), toon(skinC), 0, -0.44, 0, 0.05);
      a.rotation.z = side * 0.35;
      return a;
    };
    const armL = arm(-1), armR = arm(1);
    const handR = new THREE.Group(); handR.position.set(0, -0.44, 0); armR.add(handR);
    const handL = new THREE.Group(); handL.position.set(0, -0.44, 0); armL.add(handL);
    let glowParts = [];

    // Class props.
    if (cls === 'wordsmith') {
      armR.rotation.set(-0.5, 0, 0.2);
      const q = new THREE.Group(); q.rotation.set(0.5, 0, -0.15); handR.add(q);
      part(q, new THREE.CylinderGeometry(0.025, 0.02, 1.3, 8), toon(0xd9a441), 0, 0.45, 0, 0.06);
      const feather = part(q, new THREE.SphereGeometry(0.2, 12, 10), toon(S.accent), 0, 1.05, 0, 0.05);
      feather.scale.set(0.55, 2.1, 0.18);
      const scroll = new THREE.Group(); scroll.position.set(-0.75, 1.0, 0.25); root.add(scroll);
      part(scroll, new THREE.BoxGeometry(0.42, 0.55, 0.02), toon(0xfff1c9), 0, 0, 0, 0.06);
      [0.29, -0.29].forEach((y) => { const r = part(scroll, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10), toon(0xd9a441), 0, y, 0, 0.05); r.rotation.z = Math.PI / 2; });
      glowParts.push({ obj: scroll, float: true });
    } else if (cls === 'knight') {
      armL.rotation.set(-0.6, 0.2, -0.1);
      const shield = part(handL, new THREE.CylinderGeometry(0.36, 0.36, 0.07, 24), toon(S.trim), 0.02, 0.05, 0.12, 0.05);
      shield.rotation.x = Math.PI / 2;
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ map: letterTexture('ABC', '#e8eef2', '#11502c') }));
      face.position.set(0.02, 0.05, 0.16); handL.add(face);
      armR.rotation.set(-0.3, 0, 0.25);
      const sword = new THREE.Group(); sword.rotation.set(1.2, 0, 0); handR.add(sword);
      part(sword, new THREE.BoxGeometry(0.08, 0.75, 0.03), toon(0xeef3f6), 0, 0.45, 0, 0.06);
      part(sword, new THREE.BoxGeometry(0.28, 0.05, 0.06), toon(0xd9a441), 0, 0.06, 0, 0.05);
    } else if (cls === 'ranger') {
      armL.rotation.set(-1.2, 0.25, 0);
      const bow = part(handL, new THREE.TorusGeometry(0.55, 0.035, 8, 24, Math.PI * 0.9), toon(S.accent, 0.6), 0, 0, 0.1, 0.05);
      bow.rotation.set(0, Math.PI / 2, Math.PI / 2 + Math.PI * 0.05);
      glowParts.push({ obj: bow, glow: true });
      armR.rotation.set(-0.9, -0.2, 0.15);
    } else if (cls === 'keeper') {
      armL.rotation.set(-1.0, 0.3, 0.15);
      const book = new THREE.Group(); book.position.set(0.1, 0.02, 0.12); book.rotation.set(-0.5, 0, 0); handL.add(book);
      [-1, 1].forEach((s) => { const p = part(book, new THREE.BoxGeometry(0.3, 0.04, 0.4), toon(0x2a5a3e), s * 0.15, 0, 0, 0.05); p.rotation.z = s * -0.2; });
      const pages = part(book, new THREE.BoxGeometry(0.55, 0.03, 0.36), toon(0xfff3b0, 0.7), 0, 0.04, 0, 0);
      glowParts.push({ obj: pages, glow: true });
      armR.rotation.set(-0.4, 0, 0.3);
      const lantern = new THREE.Group(); lantern.position.set(0, -0.12, 0); handR.add(lantern);
      part(lantern, new THREE.BoxGeometry(0.18, 0.24, 0.18), toon(0xd9a441), 0, -0.14, 0, 0.05);
      const flame = part(lantern, new THREE.SphereGeometry(0.075, 10, 8), toon(0xffd36b, 1), 0, -0.14, 0, 0);
      glowParts.push({ obj: flame, flicker: true });
    } else if (cls === 'orator') {
      armR.rotation.set(-0.35, 0, 0.12);
      const staff = new THREE.Group(); staff.rotation.set(0.35, 0, -0.12); handR.add(staff);
      part(staff, new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8), toon(0x2b322e), 0, 0.2, 0, 0.06);
      part(staff, new THREE.SphereGeometry(0.13, 14, 10), toon(0xc8d0d4), 0, 1.15, 0, 0.05);
      const ring = part(staff, new THREE.TorusGeometry(0.15, 0.025, 6, 18), toon(S.trim, 0.6), 0, 1.05, 0, 0.03);
      ring.rotation.x = Math.PI / 2;
      glowParts.push({ obj: ring, glow: true });
      armL.rotation.set(-0.2, 0, -0.9);
    } else if (cls === 'scribe') {
      armR.rotation.set(-0.8, 0, 0.3);
      const pen = new THREE.Group(); pen.rotation.set(1.0, 0, 0); handR.add(pen);
      part(pen, new THREE.CylinderGeometry(0.07, 0.07, 0.9, 12), toon(0x1b2f8a), 0, 0.35, 0, 0.06);
      part(pen, new THREE.CylinderGeometry(0.075, 0.075, 0.12, 12), toon(0xd9a441), 0, 0.82, 0, 0.04);
      part(pen, new THREE.ConeGeometry(0.07, 0.3, 12), toon(0xd9a441), 0, -0.24, 0, 0.05).rotation.x = Math.PI;
      part(body, new THREE.SphereGeometry(0.11, 12, 10), toon(S.accent), -0.28, 0.58, 0.26, 0.06);
    }

    root.userData = { body, head, armL, armR, glowParts };
    return root;
  }

  // Idle animation: breathing, a slight head tilt, floating props.
  const animate = (hero, t) => {
    const u = hero.userData;
    u.body.position.y = Math.sin(t * 2.2) * 0.03;
    u.head.rotation.z = Math.sin(t * 1.3) * 0.05;
    u.glowParts.forEach((p) => {
      if (p.float) p.obj.position.y = 1.0 + Math.sin(t * 1.8) * 0.06;
      if (p.flicker) p.obj.scale.setScalar(1 + Math.sin(t * 11) * 0.12);
      if (p.glow && p.obj.material.emissiveIntensity !== undefined) p.obj.material.emissiveIntensity = 0.45 + Math.abs(Math.sin(t * 2)) * 0.5;
    });
  };

  const lights = (scene) => {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3a30, 0.62));
    const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(2, 4, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x3df58a, 0.6); rim.position.set(-3, 2, -3); scene.add(rim);
  };

  // Lobby stage: one hero, idle animation, drag to turn.
  function mountStage(el, hero) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); lights(scene);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 1.35, 6.4); camera.lookAt(0, 1.1, 0);
    let model = buildHero(hero); scene.add(model);
    let yaw = 0.35, drag = null, raf = 0;
    const size = () => { const w = el.clientWidth || 300, h = el.clientHeight || 300; renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = w / h; camera.updateProjectionMatrix(); };
    size();
    const down = (e) => { drag = { x: e.clientX, yaw }; el.setPointerCapture && el.setPointerCapture(e.pointerId); };
    const move = (e) => { if (drag) yaw = drag.yaw + (e.clientX - drag.x) * 0.012; };
    const up = () => { drag = null; };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    window.addEventListener('resize', size);
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t0 = performance.now();
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      if (!drag && !reduced) yaw += Math.sin(t * 0.5) * 0.004;
      model.rotation.y = yaw;
      if (!reduced) animate(model, t);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    };
    frame();
    return {
      set(h) { scene.remove(model); model = buildHero(h); scene.add(model); },
      destroy() {
        cancelAnimationFrame(raf); window.removeEventListener('resize', size);
        el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
        renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      },
    };
  }

  // Still portraits (cached), drawn with one shared offscreen renderer.
  let shared = null;
  const cache = new Map();
  function portrait(hero, px = 256) {
    const key = [hero.cls, hero.g, hero.skin || 'light', px].join(':');
    if (cache.has(key)) return cache.get(key);
    if (!shared) {
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      const scene = new THREE.Scene(); lights(scene);
      shared = { r, scene, camera: new THREE.PerspectiveCamera(30, 0.75, 0.1, 50) };
    }
    const { r, scene, camera } = shared;
    r.setPixelRatio(1); r.setSize(Math.round(px * 0.75), px, false);
    camera.position.set(1.4, 1.5, 6.0); camera.lookAt(0, 1.05, 0);
    const m = buildHero(hero); m.rotation.y = 0.35; scene.add(m);
    animate(m, 0.4);
    r.render(scene, camera);
    const url = r.domElement.toDataURL('image/png');
    scene.remove(m);
    cache.set(key, url);
    return url;
  }

  window.Heroes3D = { available: () => true, buildHero, mountStage, portrait, SKINS };
})();
