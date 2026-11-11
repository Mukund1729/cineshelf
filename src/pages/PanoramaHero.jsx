/**
 * PanoramaHero — curved ring of cinema screens
 * Fixed: single stable renderer, drag+swipe+snap, sky tint, opacity dimming
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as THREE from 'three';
import Navbar from '../components/Navbar';
import { apiUrl } from '../api/config';

const TMDB_KEY =
  import.meta.env.VITE_TMDB_KEY ||
  import.meta.env.VITE_TMDB_API_KEY ||
  '049f46f11e71c08eba866acaefc280df';

// ── Data fetching ─────────────────────────────────────────────────────────────
async function fetchFeaturedMovies() {
  try {
    const [nowRes, popRes] = await Promise.all([
      fetch(`https://api.themoviedb.org/3/movie/now_playing?api_key=${TMDB_KEY}&language=en-US&page=1&region=IN`),
      fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${TMDB_KEY}&language=en-US&page=1`),
    ]);
    const [nowData, popData] = await Promise.all([nowRes.json(), popRes.json()]);
    const seen = new Set();
    const mapMovie = m => ({
      id: m.id,
      title: m.title,
      poster: apiUrl(`/api/tmdb/image/w342${m.poster_path}`),
      backdrop: apiUrl(`/api/tmdb/image/w780${m.backdrop_path}`),
      rating: m.vote_average?.toFixed(1),
      year: (m.release_date || '').slice(0, 4),
      genre: m.genre_ids?.[0] || 0,
    });
    const all = [
      ...(nowData.results || []).filter(m => m.poster_path && m.backdrop_path),
      ...(popData.results || []).filter(m => m.poster_path && m.backdrop_path),
    ]
      .filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
      .slice(0, 9)
      .map(mapMovie);
    return all.length >= 5 ? all : [];
  } catch {
    return [];
  }
}

function loadTex(loader, url) {
  return new Promise(resolve =>
    loader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); }, undefined, () => resolve(null))
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PanoramaHero() {
  const mountRef   = useRef(null);
  const navigate   = useNavigate();

  const [movies, setMovies]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [frontIdx, setFrontIdx]   = useState(0);    // which movie is in front (UI only)
  const [progress, setProgress]   = useState(0);    // 0-100 for progress bar

  // Refs shared with the 3D loop (no stale closures)
  const moviesRef      = useRef([]);
  const frontIdxRef    = useRef(0);
  const autoRotRef     = useRef(true);  // auto-rotate on/off
  const angleRef       = useRef(0);     // current ring angle (radians)
  const targetAngleRef = useRef(0);     // desired ring angle
  const dragVelRef     = useRef(0);     // drag velocity for momentum
  const isDraggingRef  = useRef(false);
  const lastDragX      = useRef(0);
  const progressRef    = useRef(0);
  const autoTimerRef   = useRef(0);     // ms since last auto-advance

  // ── Fetch movies ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchFeaturedMovies().then(ms => {
      moviesRef.current = ms;
      setMovies(ms);
      setLoading(false);
    });
  }, []);

  // ── Sky background colour from poster colour ──────────────────────────────
  const skyColours = useRef(['#0a0f1a']);
  const extractPaletteFromPoster = useCallback(async (url) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
      const cv = document.createElement('canvas');
      cv.width = 8; cv.height = 8;
      const ctx = cv.getContext('2d');
      ctx.drawImage(img, 0, 0, 8, 8);
      const d = ctx.getImageData(0, 0, 8, 8).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
      const n = d.length / 4;
      // Darken heavily — we just want a tinted bg, not blinding colour
      const toHex = v => Math.min(Math.floor(v / n * 0.18 + 10), 40).toString(16).padStart(2, '0');
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch {
      return '#0a0f1a';
    }
  }, []);

  // ── Main Three.js effect (runs once movies arrive, never re-runs) ─────────
  useEffect(() => {
    if (movies.length === 0) return;

    const container = mountRef.current;
    if (!container) return;

    let animId;
    let disposed = false;

    // Pre-extract sky colours for each movie poster
    movies.forEach((m, i) => {
      extractPaletteFromPoster(m.poster).then(col => {
        skyColours.current[i] = col;
      });
    });

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x0a0f1a, 1);
    container.appendChild(renderer.domElement);

    // ── Scene & Camera ─────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      62, container.clientWidth / container.clientHeight, 0.1, 150
    );
    camera.position.set(0, 0.5, 9);
    camera.lookAt(0, 0, 0);

    // Subtle ambient + spot from above
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const spot = new THREE.PointLight(0xd4af37, 0.8, 30);
    spot.position.set(0, 6, 4);
    scene.add(spot);

    // ── Floor — reflective-ish plane ──────────────────────────────────────
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x08090f,
      roughness: 0.9,
      metalness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    scene.add(floor);

    // ── Ring of screens ───────────────────────────────────────────────────
    const N = movies.length;
    const RADIUS      = 5.5;
    const SW          = 1.9;  // screen width
    const SH          = 2.85; // screen height
    const screenMeshes = [];
    const glowMeshes   = [];

    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';

    for (let i = 0; i < N; i++) {
      const baseAngle = (i / N) * Math.PI * 2;

      // Screen plane
      const geo = new THREE.PlaneGeometry(SW, SH, 1, 1);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x1a2236,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { index: i, baseAngle, movie: movies[i], loaded: false };
      scene.add(mesh);
      screenMeshes.push(mesh);

      // Thin glow halo behind the screen
      const glowGeo = new THREE.PlaneGeometry(SW + 0.3, SH + 0.3);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xd4af37,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.z = -0.02;
      mesh.add(glow);
      glowMeshes.push(glow);

      // Frame border
      const frameGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(SW + 0.06, SH + 0.06, 0.04));
      const frameMat = new THREE.LineBasicMaterial({ color: 0x3a4060, transparent: true, opacity: 0.5 });
      const frame = new THREE.LineSegments(frameGeo, frameMat);
      mesh.add(frame);

      // Load poster texture
      loadTex(loader, movies[i].poster).then(tex => {
        if (!disposed && tex) {
          mesh.material = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 1,
          });
          mesh.userData.loaded = true;
        }
      });
    }

    // ── Background colour transition ──────────────────────────────────────
    let bgCurrent = new THREE.Color(0x0a0f1a);
    let bgTarget  = new THREE.Color(0x0a0f1a);

    const setTargetBg = (hex) => {
      bgTarget.set(hex || '#0a0f1a');
    };

    // ── Helpers ───────────────────────────────────────────────────────────
    const anglePerScreen = (Math.PI * 2) / N;

    const snapToIndex = (idx) => {
      frontIdxRef.current = ((idx % N) + N) % N;
      targetAngleRef.current = -frontIdxRef.current * anglePerScreen;
      setFrontIdx(frontIdxRef.current);
      setTargetBg(skyColours.current[frontIdxRef.current]);
    };

    // Initial snap
    snapToIndex(0);

    // ── Pointer / touch drag ──────────────────────────────────────────────
    const DRAG_SCALE = 0.004;

    const onPointerDown = (e) => {
      isDraggingRef.current = true;
      lastDragX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      dragVelRef.current = 0;
      autoRotRef.current = false;
      progressRef.current = 0;
      setProgress(0);
      autoTimerRef.current = 0;
    };

    const onPointerMove = (e) => {
      if (!isDraggingRef.current) return;
      const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const dx = x - lastDragX.current;
      dragVelRef.current = dx * DRAG_SCALE;
      targetAngleRef.current += dx * DRAG_SCALE;
      lastDragX.current = x;
    };

    const onPointerUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;

      // Snap to nearest screen
      const normalised = ((-targetAngleRef.current % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const nearest = Math.round(normalised / anglePerScreen) % N;
      snapToIndex(nearest);
    };

    // Raycaster for click
    const raycaster = new THREE.Raycaster();
    const mouseVec  = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;

    const onPointerDownCapture = (e) => {
      pointerDownX = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      pointerDownY = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    };

    const onClickScreen = (e) => {
      const moveX = Math.abs((e.clientX || 0) - pointerDownX);
      const moveY = Math.abs((e.clientY || 0) - pointerDownY);
      if (moveX > 6 || moveY > 6) return; // was a drag

      const rect = container.getBoundingClientRect();
      mouseVec.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(mouseVec, camera);
      const hits = raycaster.intersectObjects(screenMeshes);
      if (!hits.length) return;

      const hitIdx = hits[0].object.userData.index;
      if (hitIdx === frontIdxRef.current) {
        // Front screen → open movie page
        navigate(`/movie/${movies[hitIdx].id}`);
      } else {
        // Side screen → bring to front
        snapToIndex(hitIdx);
        autoRotRef.current = false;
        progressRef.current = 0;
        setProgress(0);
        autoTimerRef.current = 0;
      }
    };

    container.addEventListener('mousedown',  onPointerDownCapture);
    container.addEventListener('mousedown',  onPointerDown);
    window .addEventListener('mousemove',  onPointerMove);
    window .addEventListener('mouseup',    onPointerUp);
    container.addEventListener('touchstart', onPointerDownCapture, { passive: true });
    container.addEventListener('touchstart', onPointerDown,        { passive: true });
    window .addEventListener('touchmove',  onPointerMove,  { passive: true });
    window .addEventListener('touchend',   onPointerUp);
    container.addEventListener('click',      onClickScreen);

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      if (disposed) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ── Animation loop ─────────────────────────────────────────────────────
    let lastTime = performance.now();
    const AUTO_DURATION = 5200; // ms per screen

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now     = performance.now();
      const dt      = Math.min(now - lastTime, 100); // cap dt
      lastTime = now;

      // Auto-rotate logic
      if (autoRotRef.current && !isDraggingRef.current) {
        autoTimerRef.current += dt;
        const p = Math.min((autoTimerRef.current / AUTO_DURATION) * 100, 100);
        progressRef.current = p;
        // Throttle React state to avoid excessive re-renders
        if (Math.floor(p) !== Math.floor(progressRef.current - (dt / AUTO_DURATION) * 100)) {
          setProgress(p);
        }
        if (autoTimerRef.current >= AUTO_DURATION) {
          autoTimerRef.current = 0;
          const nextIdx = (frontIdxRef.current + 1) % N;
          snapToIndex(nextIdx);
        }
      }

      // Momentum friction when not dragging
      if (!isDraggingRef.current && Math.abs(dragVelRef.current) > 0.0001) {
        targetAngleRef.current += dragVelRef.current;
        dragVelRef.current *= 0.88;
      }

      // Smooth lerp current angle to target
      angleRef.current += (targetAngleRef.current - angleRef.current) * 0.1;

      // Update each screen in the ring
      const curAngle = angleRef.current;
      screenMeshes.forEach((mesh, i) => {
        const base = mesh.userData.baseAngle;
        const total = base + curAngle;

        mesh.position.x = Math.sin(total) * RADIUS;
        mesh.position.z = Math.cos(total) * RADIUS - RADIUS * 0.3;
        mesh.position.y = -0.1;
        mesh.rotation.y = -total;

        // Face-angle from camera forward (angle=0 is front)
        const faceAngle = ((total % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        const dist      = Math.min(faceAngle, Math.PI * 2 - faceAngle); // 0 = front, π = back

        const isFront   = dist < 0.25;
        const scale     = isFront ? 1.18 : 1 - dist * 0.08;
        const opacity   = Math.max(0.15, 1 - (dist / Math.PI) * 0.78);

        mesh.scale.setScalar(Math.max(0.6, scale));
        if (mesh.material.opacity !== undefined) {
          mesh.material.opacity = opacity;
        }

        // Glow only on front screen
        const glowMesh = glowMeshes[i];
        if (glowMesh) {
          glowMesh.material.opacity = isFront ? 0.18 : 0;
        }
      });

      // Gentle camera breathe
      const t = now * 0.0005;
      camera.position.y = 0.5 + Math.sin(t * 0.7) * 0.12;
      camera.position.x = Math.sin(t * 0.4) * 0.08;
      camera.lookAt(0, 0, 0);

      // Sky colour interpolation
      bgCurrent.lerp(bgTarget, 0.03);
      renderer.setClearColor(bgCurrent, 1);

      renderer.render(scene, camera);
    };

    animate();
    // Trigger first sky tint extraction when colours are ready
    setTimeout(() => setTargetBg(skyColours.current[0]), 1200);

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown',  onPointerDownCapture);
      container.removeEventListener('mousedown',  onPointerDown);
      window .removeEventListener('mousemove',  onPointerMove);
      window .removeEventListener('mouseup',    onPointerUp);
      container.removeEventListener('touchstart', onPointerDownCapture);
      container.removeEventListener('touchstart', onPointerDown);
      window .removeEventListener('touchmove',  onPointerMove);
      window .removeEventListener('touchend',   onPointerUp);
      container.removeEventListener('click',      onClickScreen);
      window .removeEventListener('resize',     onResize);
      renderer.dispose();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movies]); // only re-run when movies array arrives (never on state updates)

  // Sync progress display
  useEffect(() => {
    if (!autoRotRef.current) return;
    const id = setInterval(() => setProgress(progressRef.current), 80);
    return () => clearInterval(id);
  }, []);

  const currentMovie = movies[frontIdx];

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#f5f0e8' }}>
      <Navbar />

      {loading ? (
        <div style={{
          width: '100%', height: 'calc(100vh - 58px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: '1.2rem',
        }}>
          <div style={{ fontSize: '3.5rem', animation: 'spin 2s linear infinite' }}>🎬</div>
          <p style={{ fontFamily: 'Outfit, sans-serif', color: 'rgba(245,240,232,0.55)', fontSize: '0.9rem' }}>
            Loading cinema…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : (
        <>
          {/* 3D canvas */}
          <div
            ref={mountRef}
            style={{
              width: '100%',
              height: 'calc(100vh - 58px)',
              position: 'relative',
              cursor: 'grab',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >

            {/* Drag hint */}
            <div style={{
              position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)',
              fontFamily: 'Outfit, sans-serif', fontSize: '0.75rem',
              color: 'rgba(245,240,232,0.42)', zIndex: 10, pointerEvents: 'none',
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              ← Drag or swipe to explore · Tap to select →
            </div>

            {/* Movie info overlay */}
            {currentMovie && (
              <div style={{
                position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                textAlign: 'center', zIndex: 10, pointerEvents: 'none',
                width: '100%', maxWidth: '480px', padding: '0 1.5rem',
              }}>
                <div style={{
                  fontFamily: 'Playfair Display, serif',
                  fontSize: 'clamp(1.3rem, 5vw, 2.1rem)',
                  fontWeight: 700,
                  textShadow: '0 2px 20px rgba(0,0,0,0.9)',
                  marginBottom: '0.35rem',
                  letterSpacing: '-0.01em',
                }}>
                  {currentMovie.title}
                </div>
                <div style={{
                  fontFamily: 'Outfit, sans-serif',
                  fontSize: '0.85rem',
                  color: 'rgba(245,240,232,0.6)',
                  marginBottom: '1.2rem',
                }}>
                  {currentMovie.year} · ★ {currentMovie.rating}
                </div>
                <div style={{ pointerEvents: 'auto', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                  <Link
                    to={`/booking/${currentMovie.id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.6rem 1.6rem',
                      background: 'linear-gradient(135deg, #d4af37, #f5cc50)',
                      borderRadius: '999px', color: '#0a0f1a',
                      fontFamily: 'Outfit, sans-serif', fontWeight: 700,
                      fontSize: '0.85rem', textDecoration: 'none',
                      boxShadow: '0 4px 20px rgba(212,175,55,0.5)',
                    }}
                  >
                    🎟 Book Tickets
                  </Link>
                  <Link
                    to={`/movie/${currentMovie.id}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                      padding: '0.6rem 1.4rem',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '999px', color: '#f5f0e8',
                      fontFamily: 'Outfit, sans-serif', fontWeight: 500,
                      fontSize: '0.85rem', textDecoration: 'none',
                      backdropFilter: 'blur(8px)',
                    }}
                  >
                    ▶ Details
                  </Link>
                </div>
              </div>
            )}

            {/* Dot nav */}
            <div style={{
              position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', gap: '0.5rem', zIndex: 10, alignItems: 'center',
            }}>
              {movies.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    frontIdxRef.current = i;
                    targetAngleRef.current = -(i / movies.length) * Math.PI * 2;
                    autoRotRef.current = false;
                    progressRef.current = 0;
                    setProgress(0);
                    autoTimerRef.current = 0;
                    setFrontIdx(i);
                  }}
                  style={{
                    width: i === frontIdx ? 20 : 7,
                    height: 7,
                    borderRadius: 4,
                    background: i === frontIdx ? '#d4af37' : 'rgba(245,240,232,0.25)',
                    border: 'none', cursor: 'pointer',
                    transition: 'all 300ms ease', padding: 0,
                  }}
                />
              ))}
            </div>

            {/* Auto-rotate progress bar (only when auto) */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              height: '2px', background: 'rgba(255,255,255,0.06)', zIndex: 10,
            }}>
              <div style={{
                width: `${progress}%`, height: '100%',
                background: 'linear-gradient(90deg, #d4af37, #f5cc50)',
                transition: 'width 80ms linear',
              }} />
            </div>

          </div>
        </>
      )}
    </div>
  );
}
