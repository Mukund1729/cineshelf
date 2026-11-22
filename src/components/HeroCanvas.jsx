/**
 * HeroCanvas — cinematic Three.js backdrop for the homepage hero.
 * Dense poster arc, soft dust, warm projector light — fills the right side.
 */

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';

async function fetchPosterPaths() {
  try {
    const data = await tmdbGet('/movie/popular', { page: 1 });
    return (data.results || [])
      .filter(m => m.poster_path)
      .slice(0, 18)
      .map(m => tmdbImageUrl(m.poster_path, 'w500'));
  } catch {
    return [];
  }
}

function loadTexture(loader, url) {
  return new Promise(resolve => {
    loader.load(url, t => resolve(t), undefined, () => resolve(null));
  });
}

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isMobile() {
  return typeof window !== 'undefined' && window.innerWidth < 768;
}

export default function HeroCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container || prefersReducedMotion()) return undefined;

    let animId = 0;
    let disposed = false;
    let visible = true;
    const mobile = isMobile();

    const renderer = new THREE.WebGLRenderer({
      antialias: !mobile,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0d0d0f, 0.032);

    const camera = new THREE.PerspectiveCamera(
      mobile ? 56 : 48,
      container.clientWidth / Math.max(container.clientHeight, 1),
      0.1,
      120
    );
    // Bias camera toward the right so the poster arc fills the empty side
    camera.position.set(mobile ? 1.2 : 2.4, 0.55, mobile ? 13.5 : 11.8);

    scene.add(new THREE.AmbientLight(0x2a261f, 0.7));

    const projector = new THREE.SpotLight(0xd5b23d, 4.2, 60, Math.PI / 5, 0.65, 1.4);
    projector.position.set(-6, -5, 10);
    projector.target.position.set(3, 1.2, -1);
    scene.add(projector);
    scene.add(projector.target);

    const warmFill = new THREE.PointLight(0xf5ebd0, 0.85, 50);
    warmFill.position.set(6, 3.5, 5);
    scene.add(warmFill);

    const rim = new THREE.DirectionalLight(0xc4b48a, 0.45);
    rim.position.set(-2, 7, -4);
    scene.add(rim);

    const postersGroup = new THREE.Group();
    postersGroup.position.set(mobile ? 0.5 : 1.8, 0.2, 0);
    scene.add(postersGroup);

    const CARD_W = mobile ? 1.55 : 1.85;
    const CARD_H = CARD_W * 1.5;
    const NUM_CARDS = mobile ? 12 : 16;
    const ARC_RADIUS = mobile ? 9.2 : 9.8;
    const cardMeshes = [];

    const placeholderMat = new THREE.MeshStandardMaterial({
      color: 0x1a1c22,
      roughness: 0.8,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });

    for (let i = 0; i < NUM_CARDS; i++) {
      // Bias posters to the right/front of the arc (visible behind featured card)
      const tArc = i / NUM_CARDS;
      const angle = -0.55 + tArc * Math.PI * 1.55;
      const x = Math.sin(angle) * ARC_RADIUS;
      const z = Math.cos(angle) * ARC_RADIUS * 0.72 - 3.2;
      const y = Math.sin(i * 0.9) * 1.15 + 0.35;

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(CARD_W, CARD_H, 1, 1),
        placeholderMat.clone()
      );
      mesh.position.set(x, y, z);
      mesh.lookAt(2.2, y * 0.2, 6);
      mesh.userData = {
        baseX: x,
        baseY: y,
        baseZ: z,
        phase: (i / NUM_CARDS) * Math.PI * 2,
        bob: 0.18 + (i % 5) * 0.028,
        sway: 0.01 + (i % 3) * 0.003,
      };
      postersGroup.add(mesh);
      cardMeshes.push(mesh);

      // Thin gold edge frame for depth
      const edge = new THREE.Mesh(
        new THREE.PlaneGeometry(CARD_W + 0.06, CARD_H + 0.06),
        new THREE.MeshBasicMaterial({
          color: 0xd5b23d,
          transparent: true,
          opacity: 0.18,
          side: THREE.BackSide,
        })
      );
      edge.position.z = -0.02;
      mesh.add(edge);
    }

    // Secondary strip of smaller cards deeper back — fills void
    const stripGroup = new THREE.Group();
    stripGroup.position.set(2.5, -0.4, 0);
    scene.add(stripGroup);
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x15171d,
      roughness: 0.9,
      metalness: 0.06,
      transparent: true,
      opacity: 0.7,
    });
    const stripCount = mobile ? 8 : 11;
    for (let i = 0; i < stripCount; i++) {
      const offset = i - (stripCount - 1) / 2;
      const frame = new THREE.Mesh(
        new THREE.PlaneGeometry(1.35, 2.0),
        stripMat.clone()
      );
      frame.position.set(offset * 1.7, -2.6 + Math.sin(i * 0.55) * 0.35, -7.5 + Math.cos(i * 0.4) * 0.8);
      frame.rotation.y = Math.sin(i * 0.4) * 0.18;
      stripGroup.add(frame);
    }

    const PARTICLE_COUNT = mobile ? 180 : 360;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PARTICLE_COUNT * 3);
    const pPhase = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pPos[i * 3] = (Math.random() - 0.2) * 28;
      pPos[i * 3 + 1] = (Math.random() - 0.5) * 16;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 18 - 4;
      pPhase[i] = Math.random() * Math.PI * 2;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        color: 0xd5b23d,
        size: mobile ? 0.05 : 0.065,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(particles);

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    fetchPosterPaths().then(async urls => {
      if (disposed || !urls.length) return;
      for (let i = 0; i < Math.min(urls.length, cardMeshes.length); i++) {
        if (disposed) break;
        const tex = await loadTexture(loader, urls[i]);
        if (disposed || !tex || !cardMeshes[i]) continue;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.48,
          metalness: 0.06,
          transparent: true,
          opacity: 0,
          emissive: new THREE.Color(0xd5b23d),
          emissiveIntensity: 0.06,
        });
        cardMeshes[i].material.dispose();
        cardMeshes[i].material = mat;
        cardMeshes[i].userData.fade = 0;
        cardMeshes[i].userData.fadeTarget = 1;
      }

      // Also texture a few strip frames if we have leftover posters
      const stripKids = stripGroup.children;
      for (let i = 0; i < Math.min(stripKids.length, urls.length); i++) {
        if (disposed) break;
        const tex = await loadTexture(loader, urls[(i + 3) % urls.length]);
        if (disposed || !tex) continue;
        tex.colorSpace = THREE.SRGBColorSpace;
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.7,
          metalness: 0.05,
          transparent: true,
          opacity: 0.55,
        });
        stripKids[i].material.dispose();
        stripKids[i].material = mat;
      }
    });

    let targetRotX = 0;
    let targetRotY = 0;
    let currRotX = 0;
    let currRotY = 0;
    const handlePointer = e => {
      const x = 'clientX' in e ? e.clientX : e.touches?.[0]?.clientX;
      const y = 'clientY' in e ? e.clientY : e.touches?.[0]?.clientY;
      if (x == null || y == null) return;
      targetRotY = ((x / window.innerWidth) - 0.5) * 0.38;
      targetRotX = ((y / window.innerHeight) - 0.5) * -0.2;
    };
    window.addEventListener('mousemove', handlePointer, { passive: true });
    window.addEventListener('touchmove', handlePointer, { passive: true });

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth;
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 768 ? 1.5 : 2));
    };
    window.addEventListener('resize', handleResize);

    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: 0.05 })
      : null;
    if (io) io.observe(container);

    const clock = new THREE.Clock();
    let last = 0;

    const animate = (now) => {
      animId = requestAnimationFrame(animate);
      if (disposed || !visible) return;
      if (now - last < 14) return;
      last = now;

      const t = clock.getElapsedTime();
      currRotX += (targetRotX - currRotX) * 0.06;
      currRotY += (targetRotY - currRotY) * 0.06;

      postersGroup.rotation.y = t * 0.022 + currRotY * 0.45;
      postersGroup.rotation.x = currRotX * 0.18;
      postersGroup.rotation.z = Math.sin(t * 0.07) * 0.02;

      for (let i = 0; i < cardMeshes.length; i++) {
        const m = cardMeshes[i];
        const u = m.userData;
        m.position.x = u.baseX + Math.sin(t * 0.32 + u.phase) * u.sway * 7;
        m.position.y = u.baseY + Math.sin(t * 0.5 + u.phase) * u.bob;
        m.position.z = u.baseZ;
        if (u.fadeTarget != null && u.fade < u.fadeTarget) {
          u.fade = Math.min(u.fadeTarget, u.fade + 0.03);
          m.material.opacity = u.fade;
        }
      }

      stripGroup.position.x = 2.5 + Math.sin(t * 0.05) * 0.4;
      stripGroup.rotation.y = Math.sin(t * 0.04) * 0.04;

      particles.rotation.y = t * 0.01;
      const arr = particles.geometry.attributes.position.array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        arr[i * 3 + 1] += Math.sin(t * 0.35 + pPhase[i]) * 0.0007;
      }
      particles.geometry.attributes.position.needsUpdate = true;

      projector.intensity = 3.8 + Math.sin(t * 0.85) * 0.4;
      warmFill.intensity = 0.75 + Math.sin(t * 0.5) * 0.1;

      camera.position.x = (mobile ? 1.2 : 2.4) + Math.sin(t * 0.1) * 0.15 + currRotY * 0.7;
      camera.position.y = 0.55 + Math.sin(t * 0.16) * 0.18 + currRotX * -0.5;
      camera.lookAt(2.5, 0.5, -1.5);
      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handlePointer);
      window.removeEventListener('touchmove', handlePointer);
      window.removeEventListener('resize', handleResize);
      if (io) io.disconnect();
      cardMeshes.forEach(m => {
        m.geometry.dispose();
        if (m.material?.map) m.material.map.dispose();
        m.material?.dispose();
        m.children.forEach(c => {
          c.geometry?.dispose();
          c.material?.dispose();
        });
      });
      pGeo.dispose();
      particles.material.dispose();
      stripGroup.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material?.map) obj.material.map.dispose();
        if (obj.material) obj.material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 1,
        maskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.95) 52%, #000 100%)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.25) 30%, rgba(0,0,0,0.95) 52%, #000 100%)',
      }}
    />
  );
}
