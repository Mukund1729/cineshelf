/**
 * TheatreBooking — full 5-step booking flow with 3D cinema hall
 * Steps: Seats → Snacks → Review → Pay → Ticket
 * Fixes: single stable renderer, no wall pass-through, seat-view camera, real data
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/addons/renderers/CSS3DRenderer.js';
import Navbar from '../components/Navbar';
import { tmdbGet, tmdbImageUrl } from '../api/tmdb';

// ── Hall geometry ──────────────────────────────────────────────────────────────
function buildHall(theatre) {
  const { rowCount, seatWidth, rowSpacing, ceilingHeight } = theatre.layout;
  // Scale the demo hall up so the room reads as a real multiplex auditorium.
  const scale = 1.22;
  const defaultSections = theatre.layout.sections || [4, 8, 4];
  const rowSections = theatre.layout.rowSections || Array.from(
    { length: rowCount },
    () => defaultSections
  );
  const maxSeatsPerRow = Math.max(...rowSections.map(sections => sections.reduce((sum, count) => sum + count, 0)));
  const balconyRowCount = 3;
  const hallH = ceilingHeight * scale;
  const spacing = rowSpacing * scale;
  const balconyFloorY = Math.min(hallH - 2.6, Math.max(3.6, hallH * 0.44));
  const balconyStartZ = 1.1 + (rowCount - 1) * spacing + 2.6;
  const balconyCenterZ = balconyStartZ + ((balconyRowCount - 1) * spacing) / 2;
  const seatW = seatWidth * 1.22 * scale;
  const aisleWidth = seatW * (theatre.layout.aisleMultiplier || 1.45);
  const seatD = 0.98 * scale;
  const hallD = Math.max(26, (rowCount - 1) * spacing + 22);
  const screenZ = 2 - 7.4;
  const screenY = Math.min(5.4, hallH * 0.46);
  const hallW = (maxSeatsPerRow * seatW + (Math.max(...rowSections.map(sections => sections.length)) - 1) * aisleWidth) / 2 + 2.6;
  const maxScreenH = Math.max(3.4, Math.min(screenY - 0.55, hallH - screenY - 0.6) * 2);
  const screenW = Math.min(28.5, hallW * 2.15, maxScreenH * 2.12);
  const curveRadius = Math.max(18, hallW * 1.55);
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const position = index / Math.max(1, rowCount - 1);
    const cat = position > 0.78 ? 'recliner' : position > 0.5 ? 'premium' : 'standard';
    return {
      id: String.fromCharCode(65 + index),
      label: String.fromCharCode(65 + index),
      z: 1.1 + index * spacing,
      floorY: index * 0.2,
      cat,
      price: cat === 'recliner' ? 450 : cat === 'premium' ? 280 : 180,
      sections: rowSections[index],
    };
  });
  const balconySections = rowSections[rowSections.length - 1] || defaultSections;
  const balconySeatCount = balconySections.reduce((sum, count) => sum + count, 0);
  const balconyWidth = balconySeatCount * seatW + (balconySections.length - 1) * aisleWidth;
  const balconyAisleX = balconySections.length > 1
    ? -balconyWidth / 2 + balconySections[0] * seatW + aisleWidth / 2
    : -hallW + 1;
  const balconyRows = Array.from({ length: balconyRowCount }, (_, index) => ({
    id: `BA${index + 1}`,
    label: `BA${index + 1}`,
    z: balconyStartZ + index * spacing,
    floorY: balconyFloorY + index * 0.14,
    cat: 'balcony',
    price: 320,
    sections: balconySections,
  }));

  return {
    rows: [...rows, ...balconyRows],
    seatsPerRow: maxSeatsPerRow,
    seatW,
    seatD,
    aisleWidth,
    screenZ,
    screenY,
    screenW,
    screenH: screenW / 2.12,
    hallW,
    hallH,
    hallD,
    curveRadius,
    balconyFloorY,
    balconyStartZ,
    balconyCenterZ,
    balconyAisleX,
  };
}

function buildCameraPresets(hall) {
  return {
    overview: {
      // Pull back + up so the full rake of seats is clear of the bottom dock.
      pos: [0, Math.min(12.5, hall.hallH - 0.55), hall.balconyStartZ + 1.8],
      look: [0, hall.screenY * 0.55, hall.screenZ + 8],
    },
    fromStage: {
      pos: [0, 2.1, hall.screenZ + 3.2],
      look: [0, hall.screenY, 3.2],
    },
    balcony: {
      pos: [hall.balconyAisleX, Math.min(hall.hallH - 1, hall.balconyFloorY + 2.2), hall.balconyCenterZ + 0.6],
      look: [0, hall.screenY, hall.screenZ],
    },
    birdsEye: {
      pos: [0, hall.hallH - 0.5, 2.2],
      look: [0, 0.4, hall.screenZ + 6],
    },
  };
}

function getSeatCount(theatre) {
  const sectionsByRow = theatre.layout.rowSections || Array.from(
    { length: theatre.layout.rowCount },
    () => theatre.layout.sections
  );
  return sectionsByRow.reduce(
    (total, sections) => total + sections.reduce((rowTotal, count) => rowTotal + count, 0),
    0
  );
}

// ── Seeded random (same input → same output) ───────────────────────────────────
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
function hashStr(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h;
}

// ── Theatre data (Indian cinema chains) ────────────────────────────────────────
const THEATRES = [
  { name: 'PVR IMAX Phoenix',      city: 'Mumbai',    dist: 1.2, layout: { rowCount: 12, sections: [5, 10, 5], seatWidth: 0.56, rowSpacing: 0.86, ceilingHeight: 11 } },
  { name: 'INOX Megaplex',         city: 'Mumbai',    dist: 2.8, layout: { rowCount: 10, sections: [5, 8, 5], seatWidth: 0.55, rowSpacing: 0.9, ceilingHeight: 9.5 } },
  { name: 'Cinépolis VIP',         city: 'Mumbai',    dist: 4.1, layout: { rowCount: 7, sections: [4, 8, 4], seatWidth: 0.64, rowSpacing: 1.02, ceilingHeight: 8.5 } },
  { name: 'PVR Director\'s Cut',   city: 'Delhi',     dist: 0.9, layout: { rowCount: 8, sections: [4, 8, 4], seatWidth: 0.66, rowSpacing: 1.04, ceilingHeight: 9 } },
  { name: 'INOX Select City Walk', city: 'Delhi',     dist: 2.3, layout: { rowCount: 9, sections: [4, 8, 4], seatWidth: 0.56, rowSpacing: 0.92, ceilingHeight: 9 } },
  { name: 'Miraj Cinemas',         city: 'Delhi',     dist: 5.6, layout: { rowCount: 8, sections: [3, 8, 3], seatWidth: 0.54, rowSpacing: 0.88, ceilingHeight: 8.5 } },
  { name: 'SPI Sathyam',           city: 'Chennai',   dist: 1.4, layout: { rowCount: 11, sections: [5, 8, 5], seatWidth: 0.56, rowSpacing: 0.9, ceilingHeight: 10 } },
  { name: 'PVR Forum Vijaya',      city: 'Chennai',   dist: 3.0, layout: { rowCount: 10, sections: [5, 8, 5], seatWidth: 0.55, rowSpacing: 0.88, ceilingHeight: 9.5 } },
  { name: 'Cinépolis ORION',       city: 'Bengaluru', dist: 0.7, layout: { rowCount: 9, sections: [4, 8, 4], seatWidth: 0.54, rowSpacing: 0.95, ceilingHeight: 9.2 } },
  { name: 'PVR IMAX Vega City',    city: 'Bengaluru', dist: 2.5, layout: { rowCount: 11, sections: [5, 10, 5], seatWidth: 0.56, rowSpacing: 0.88, ceilingHeight: 10.5 } },
  {
    name: 'Suncity Cinema',
    city: 'Hisar',
    dist: 1.1,
    layout: {
      rowCount: 10,
      rowSections: [[10], [10], [5, 8], [5, 10, 5], [5, 10, 5], [6, 12, 6], [6, 12, 6], [6, 12, 6], [6, 12, 6], [6, 12, 6]],
      aisleMultiplier: 2,
      seatWidth: 0.68,
      rowSpacing: 1.08,
      ceilingHeight: 10,
    },
  },
];

const FORMATS = ['2D', 'IMAX', '4DX', 'Dolby Atmos'];
const SLOT_TIMES = ['10:00 AM', '1:15 PM', '4:30 PM', '7:45 PM', '10:30 PM'];
const INDIAN_CITIES = [
  'Agartala', 'Agra', 'Ahmedabad', 'Ajmer', 'Aligarh', 'Allahabad', 'Amritsar',
  'Aurangabad', 'Bengaluru', 'Bhopal', 'Bhubaneswar', 'Chandigarh', 'Chennai',
  'Coimbatore', 'Cuttack', 'Dehradun', 'Delhi', 'Dhanbad', 'Durgapur',
  'Faridabad', 'Ghaziabad', 'Goa', 'Gorakhpur', 'Gurugram', 'Guwahati',
  'Gwalior', 'Hisar', 'Howrah', 'Hyderabad', 'Indore', 'Jabalpur', 'Jaipur',
  'Jalandhar', 'Jammu', 'Jamshedpur', 'Jhansi', 'Jodhpur', 'Kanpur',
  'Kochi', 'Kolhapur', 'Kolkata', 'Kota', 'Kozhikode', 'Lucknow', 'Ludhiana',
  'Madurai', 'Mangaluru', 'Meerut', 'Mumbai', 'Mysuru', 'Nagpur', 'Nashik',
  'Navi Mumbai', 'Noida', 'Patna', 'Puducherry', 'Pune', 'Raipur', 'Rajkot',
  'Ranchi', 'Rourkela', 'Salem', 'Siliguri', 'Surat', 'Thane', 'Thiruvananthapuram',
  'Tiruchirappalli', 'Tiruppur', 'Udaipur', 'Ujjain', 'Vadodara', 'Varanasi',
  'Vijayawada', 'Visakhapatnam',
];

const BOOKMYSHOW_CITY_SLUGS = {
  Ahmedabad: 'ahmedabad',
  Bengaluru: 'bengaluru',
  Bangalore: 'bengaluru',
  Bhopal: 'bhopal',
  Bhubaneswar: 'bhubaneswar',
  Chandigarh: 'chandigarh',
  Chennai: 'chennai',
  Coimbatore: 'coimbatore',
  Delhi: 'delhi-ncr',
  Faridabad: 'delhi-ncr',
  Ghaziabad: 'delhi-ncr',
  Gurugram: 'delhi-ncr',
  Gurgaon: 'delhi-ncr',
  Hyderabad: 'hyderabad',
  Indore: 'indore',
  Jaipur: 'jaipur',
  Kochi: 'kochi',
  Kolkata: 'kolkata',
  Lucknow: 'lucknow',
  Ludhiana: 'ludhiana',
  Mumbai: 'mumbai',
  Mysuru: 'mysuru',
  Nagpur: 'nagpur',
  NaviMumbai: 'mumbai',
  Noida: 'delhi-ncr',
  Patna: 'patna',
  Pune: 'pune',
  Raipur: 'raipur',
  Ranchi: 'ranchi',
  Surat: 'surat',
  Thane: 'mumbai',
  Vadodara: 'vadodara',
  Varanasi: 'varanasi',
  Vijayawada: 'vijayawada',
  Visakhapatnam: 'visakhapatnam',
  Hisar: 'hisar',
};

function getBookMyShowCitySlug(city) {
  const cityKey = String(city || '').replace(/[\s-]/g, '').toLowerCase();
  const cityEntry = Object.entries(BOOKMYSHOW_CITY_SLUGS)
    .find(([name]) => name.replace(/[\s-]/g, '').toLowerCase() === cityKey);
  return cityEntry?.[1]
    || String(city || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function getBookMyShowUrl(city, movieTitle = '') {
  const citySlug = getBookMyShowCitySlug(city);
  const base = citySlug
    ? `https://in.bookmyshow.com/explore/movies-${citySlug}`
    : 'https://in.bookmyshow.com/explore/movies';
  // BookMyShow has no public showtimes API — deep-link into their city explore,
  // optionally prefilled with the film title so live listings open faster.
  if (!movieTitle) return base;
  const query = new URLSearchParams({ q: movieTitle });
  return `${base}?${query.toString()}`;
}

async function fetchWithTimeout(url, options, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const parentSignal = options.signal;
  const abortFromParent = () => controller.abort();

  if (parentSignal?.aborted) controller.abort();
  else parentSignal?.addEventListener('abort', abortFromParent, { once: true });

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted && !parentSignal?.aborted) {
      throw new Error('The public cinema map timed out. Please try again or use the BookMyShow link.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    parentSignal?.removeEventListener('abort', abortFromParent);
  }
}

function cinemaCacheKey(city) {
  return `vc-cinemas-v1:${String(city || '').trim().toLowerCase()}`;
}

function readCinemaCache(city) {
  try {
    const raw = sessionStorage.getItem(cinemaCacheKey(city));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.at || !Array.isArray(parsed.items)) return null;
    // Fresh for 30 minutes — avoids re-hitting Overpass on every visit.
    if (Date.now() - parsed.at > 30 * 60 * 1000) return null;
    return parsed.items;
  } catch {
    return null;
  }
}

function writeCinemaCache(city, items) {
  try {
    sessionStorage.setItem(cinemaCacheKey(city), JSON.stringify({ at: Date.now(), items }));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

async function findMappedCinemas(city, signal) {
  const cached = readCinemaCache(city);
  if (cached) return cached;

  const geocodeUrl = new URL('https://nominatim.openstreetmap.org/search');
  geocodeUrl.search = new URLSearchParams({
    q: `${city}, India`,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'in',
    addressdetails: '1',
  });
  const geocodeResponse = await fetchWithTimeout(geocodeUrl, {
    signal,
    headers: { 'Accept-Language': 'en' },
  }, 7000);
  if (!geocodeResponse.ok) throw new Error(`Could not locate ${city}. Try another spelling or use the BookMyShow link.`);
  const places = await geocodeResponse.json();
  if (!places.length) throw new Error(`Could not find ${city} on the public map. Try another spelling or use BookMyShow.`);

  const place = places.find(item =>
    ['city', 'town', 'municipality', 'administrative'].includes(item.type)
    || ['city', 'town'].includes(item.addresstype)
  ) || places[0];
  const { lat, lon, display_name: displayName } = place;
  const query = `[out:json][timeout:12];nwr(around:50000,${lat},${lon})["amenity"="cinema"];out center tags;`;
  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
  ];
  let lastError;

  for (const endpoint of endpoints) {
    try {
      const requestUrl = new URL(endpoint);
      requestUrl.searchParams.set('data', query);
      const response = await fetchWithTimeout(requestUrl, {
        signal,
      }, 9000);
      if (!response.ok) throw new Error(`The public theatre map returned ${response.status}.`);
      const data = await response.json();
      const found = new Map();
      for (const item of data.elements || []) {
        const name = item.tags?.name || item.tags?.['name:en'] || item.tags?.brand || item.tags?.operator;
        const latitude = item.lat ?? item.center?.lat;
        const longitude = item.lon ?? item.center?.lon;
        if (!name || latitude == null || longitude == null) continue;
        const key = name.trim().toLocaleLowerCase();
        if (found.has(key)) continue;
        found.set(key, {
          name: name.trim(),
          city: displayName.split(',')[0],
          dist: Math.round(Math.hypot((latitude - Number(lat)) * 111, (longitude - Number(lon)) * 111 * Math.cos(Number(lat) * Math.PI / 180)) * 10) / 10,
          layout: { rowCount: 10, sections: [5, 8, 5], seatWidth: 0.56, rowSpacing: 0.9, ceilingHeight: 9.5 },
          source: 'OpenStreetMap',
        });
      }
      const items = [...found.values()].sort((a, b) => a.dist - b.dist);
      writeCinemaCache(city, items);
      return items;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      lastError = error;
    }
  }

  throw new Error(lastError?.message || 'Could not load mapped theatres right now. Please try again or use the BookMyShow link.');
}

function generateShowtimes(movieId, theatreIdx) {
  const rng = seededRand(hashStr(`${movieId}-${theatreIdx}`));
  const fmtCount = Math.floor(rng() * 2) + 1;
  const formats = FORMATS.filter(() => rng() > 0.4).slice(0, fmtCount);
  if (!formats.length) formats.push('2D');
  return SLOT_TIMES.map((time, si) => ({
    time,
    format: formats[si % formats.length],
    seatsLeft: Math.floor(rng() * 60) + 10,
    price: formats[si % formats.length] === 'IMAX' ? 500 : formats[si % formats.length] === '4DX' ? 420 : 180,
  }));
}

// ── Snacks menu ────────────────────────────────────────────────────────────────
const SNACKS = [
  { id: 's1', name: 'Large Popcorn',     price: 220, desc: 'Buttery salted / caramel', img: 'https://images.unsplash.com/photo-1585647347384-2593bc35786b?w=200&q=70' },
  { id: 's2', name: 'Nachos & Salsa',    price: 180, desc: 'Crispy tortilla chips',    img: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?w=200&q=70' },
  { id: 's3', name: 'Combo Meal',        price: 380, desc: 'Popcorn + 2 drinks',       img: 'https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=200&q=70' },
  { id: 's4', name: 'Pepsi 500ml',       price: 110, desc: 'Chilled cola',             img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=200&q=70' },
  { id: 's5', name: 'Hot Dog',           price: 150, desc: 'Classic mustard & ketchup', img: 'https://images.unsplash.com/photo-1515041219749-89347f83291a?w=200&q=70' },
  { id: 's6', name: 'Chocolate Brownie', price: 130, desc: 'Warm fudge brownie',       img: 'https://images.unsplash.com/photo-1564355808539-22fda35bed7e?w=200&q=70' },
  { id: 's7', name: 'Cappuccino',        price: 140, desc: 'Fresh brewed, any milk',  img: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=200&q=70' },
  { id: 's8', name: 'Mineral Water',     price:  40, desc: '500ml bottle',             img: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=200&q=70' },
];

// ── QR code (simple SVG data matrix look) ──────────────────────────────────────
function generateQR(ticketId) {
  const bits = ticketId.split('').map(c => c.charCodeAt(0).toString(2).padStart(8,'0')).join('');
  const size  = 21;
  const cells = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const bit = bits[(r * size + c) % bits.length];
      cells.push({ r, c, on: bit === '1' || (r < 3 && c < 3) || (r < 3 && c > size-4) || (r > size-4 && c < 3) });
    }
  }
  return cells;
}

function QRCode({ ticketId, size = 120 }) {
  const cells = generateQR(ticketId);
  const cell = size / 21;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ background: '#fff', borderRadius: 6, padding: 4 }}>
      {cells.map(({ r, c, on }) =>
        on ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0a0f1a" /> : null
      )}
    </svg>
  );
}

// ── Colour helpers ──────────────────────────────────────────────────────────────
const CAT_COLOURS = {
  standard: { base: 0x3d6f8c, selected: 0xffd35a, sold: 0x23242a, hover: 0x4f88a8 },
  premium:  { base: 0x6b4f86, selected: 0xffd35a, sold: 0x23242a, hover: 0x8363a0 },
  recliner: { base: 0x2f6a55, selected: 0xffd35a, sold: 0x23242a, hover: 0x3f856c },
  balcony:  { base: 0xa67550, selected: 0xffd35a, sold: 0x23242a, hover: 0xc07e62 },
};

// ── Main component ──────────────────────────────────────────────────────────────
export default function TheatreBooking() {
  const { movieId } = useParams();
  const navigate    = useNavigate();
  const mountRef    = useRef(null);

  // Movie info
  const [movie, setMovie]       = useState(null);
  const [loading, setLoading]   = useState(true);

  // Theatre & showtime selection
  const [city, setCity] = useState(THEATRES[0].city);
  const [cityInput, setCityInput] = useState(THEATRES[0].city);
  const [cityLookupAttempt, setCityLookupAttempt] = useState(0);
  const [mappedTheatres, setMappedTheatres] = useState([]);
  const [theatreLookupLoading, setTheatreLookupLoading] = useState(false);
  const [theatreLookupError, setTheatreLookupError] = useState('');
  const [theatreIdx, setTheatreIdx] = useState(0);
  const demoTheatres = THEATRES.filter(item => item.city.toLowerCase() === city.trim().toLowerCase());
  const sampleTheatre = {
    name: `Sample cinema · ${city}`,
    city,
    dist: 0,
    layout: { rowCount: 10, sections: [5, 8, 5], seatWidth: 0.56, rowSpacing: 0.9, ceilingHeight: 9.5 },
  };
  const cityTheatres = mappedTheatres.length
    ? mappedTheatres
    : demoTheatres.length
      ? demoTheatres
      : [sampleTheatre];
  const theatre = cityTheatres[theatreIdx] || cityTheatres[0] || THEATRES[0];
  // Stable key so OSM list refresh does not rebuild the whole WebGL hall mid-drag.
  const theatreKey = `${theatre?.name || ''}|${theatre?.city || ''}|${theatre?.layout?.rowCount || 0}|${theatreIdx}`;
  const HALL = useMemo(() => buildHall(theatre), [theatreKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const PRESETS = useMemo(() => buildCameraPresets(HALL), [HALL]);
  const [sceneError, setSceneError] = useState('');
  const paintSeatsRef = useRef(null); // (selectedIds: string[]) => void — sync 3D colours
  const [showtimes, setShowtimes]   = useState([]);
  const [showIdx, setShowIdx]       = useState(0);

  // 3D state (communicated to loop via refs)
  const [currentPreset, setCurrentPreset] = useState('overview');
  const presetRef    = useRef('overview');
  const isAutoRef    = useRef(false);
  const [isAuto, setIsAuto] = useState(false);
  const [seatView, setSeatView] = useState(null);   // { rowId, seat } or null

  // Booking state
  const [step, setStep] = useState(1); // 1=seats, 2=snacks, 3=review, 4=pay, 5=ticket
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [cart, setCart] = useState({});   // snackId → qty
  const [payLoading, setPayLoading] = useState(false);
  const [ticket, setTicket] = useState(null);

  // Refs for 3D interaction
  const selectedSeatsRef = useRef([]);
  const camTargetPos     = useRef(new THREE.Vector3(0, 7.5, 11.5));
  const camTargetLook    = useRef(new THREE.Vector3(0, 1.5, 0));
  const tourIdxRef       = useRef(0);
  const tourTimer        = useRef(0);
  const stepRef          = useRef(step);

  // ── Fetch movie ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!movieId) return;
    setLoading(true);
    tmdbGet(`/movie/${movieId}`, { append_to_response: 'videos' })
      .then(data => {
        setMovie(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [movieId]);

  // ── Generate showtimes when theatre or movie changes ──────────────────────
  useEffect(() => {
    if (!movieId) return;
    const st = generateShowtimes(movieId, theatreIdx);
    setShowtimes(st);
    setShowIdx(0);
  }, [movieId, theatreIdx]);

  useEffect(() => {
    if (!city.trim()) return undefined;
    const controller = new AbortController();
    let active = true;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 24000);
    setTheatreLookupError('');
    setTheatreIdx(0);
    selectedSeatsRef.current = [];
    setSelectedSeats([]);

    // Instant paint from session cache — avoids empty "Searching…" flicker.
    const cached = readCinemaCache(city.trim());
    if (cached?.length) {
      setMappedTheatres(cached);
      setTheatreLookupLoading(false);
    } else {
      setMappedTheatres([]);
      setTheatreLookupLoading(true);
    }

    // Slight delay so the WebGL hall can boot before OSM network work competes.
    const startId = setTimeout(() => {
      findMappedCinemas(city.trim(), controller.signal)
        .then(items => {
          if (!active) return;
          setMappedTheatres(items);
          if (!items.length) setTheatreLookupError(`No named cinemas are mapped near ${city}.`);
        })
        .catch(error => {
          if (!active) return;
          if (timedOut) {
            setTheatreLookupError('The cinema search took too long. Try again or open the BookMyShow city listings.');
          } else if (error.name !== 'AbortError') {
            setTheatreLookupError(error.message || 'Could not load cinemas from OpenStreetMap.');
          }
        })
        .finally(() => {
          if (active) setTheatreLookupLoading(false);
        });
    }, cached?.length ? 0 : 350);

    return () => {
      active = false;
      clearTimeout(timeoutId);
      clearTimeout(startId);
      controller.abort();
    };
  }, [city, cityLookupAttempt]);

  const searchCityTheatres = () => {
    const nextCity = cityInput.trim();
    if (!nextCity) return;
    if (nextCity.toLowerCase() === city.trim().toLowerCase()) {
      setCityLookupAttempt(attempt => attempt + 1);
    } else {
      setCity(nextCity);
    }
  };

  useEffect(() => {
    selectedSeatsRef.current = [];
    setSelectedSeats([]);
    setSeatView(null);
    setCurrentPreset('overview');
    presetRef.current = 'overview';
    isAutoRef.current = false;
    setIsAuto(false);
    tourIdxRef.current = 0;
  }, [theatreIdx]);

  // ── Snap camera to preset (via ref) ───────────────────────────────────────
  const goPreset = useCallback((name) => {
    const p = PRESETS[name];
    if (!p) return;
    camTargetPos.current.set(...p.pos);
    camTargetLook.current.set(...p.look);
    presetRef.current = name;
    setCurrentPreset(name);
    setSeatView(null);
  }, [PRESETS]);

  // ── Main Three.js effect ───────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;          // Wait until movie data loaded
    if (step !== 1) return;       // Tear down when leaving the seat step (avoids detached-canvas crashes)
    const container = mountRef.current;
    if (!container) return;

    let animId;
    let disposed = false;
    setSceneError('');

    // ── Renderer ─────────────────────────────────────────────────────────
    // Use fallback dimensions if container hasn't laid out yet
    const getW = () => container.clientWidth  || window.innerWidth;
    const getH = () => container.clientHeight || (window.innerHeight - 160);

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: window.devicePixelRatio < 2,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
      });
    } catch (error) {
      console.error('[TheatreBooking] WebGL init failed', error);
      setSceneError('3D theatre could not start on this device. Try refreshing, or open BookMyShow for live booking.');
      return undefined;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(getW(), getH());
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);
    const onContextLost = (event) => {
      event.preventDefault();
      setSceneError('Graphics context was lost. Refresh the page to reload the theatre.');
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';
    // Make canvas fill the container absolutely so it doesn't collapse to 0
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    const cssRenderer = new CSS3DRenderer();
    cssRenderer.setSize(getW(), getH());
    Object.assign(cssRenderer.domElement.style, {
      position: 'absolute',
      inset: '0',
      overflow: 'hidden',
      pointerEvents: 'none',
    });
    container.appendChild(cssRenderer.domElement);
    // ── Scene ─────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0c090d);
    scene.fog = new THREE.FogExp2(0x0c090d, 0.028);

    // ── Camera ────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      58, container.clientWidth / container.clientHeight, 0.1, 120
    );
    camera.position.set(...PRESETS.overview.pos);
    camera.lookAt(...PRESETS.overview.look);
    const cameraLook = new THREE.Vector3(0, 1.5, 0);

    // ── Lighting (few lights only — dozens of PointLights tank FPS) ───────
    scene.add(new THREE.HemisphereLight(0xe8eef8, 0x140a10, 0.95));
    const houseLight = new THREE.PointLight(0xffc982, 1.05, 36);
    houseLight.position.set(0, Math.min(8.2, HALL.hallH - 1.2), 2.5);
    scene.add(houseLight);

    const screenGlow = new THREE.PointLight(0x9bb6ff, 2.2, 28);
    screenGlow.position.set(0, HALL.screenY, HALL.screenZ + 1.4);
    scene.add(screenGlow);

    const rearFill = new THREE.PointLight(0xffaa78, 0.45, 22);
    rearFill.position.set(0, HALL.balconyFloorY + 1.2, HALL.balconyCenterZ);
    scene.add(rearFill);

    // ── Cinema screen ─────────────────────────────────────────────────────
    const scrW = HALL.screenW, scrH = HALL.screenH;
    const scrY = HALL.screenY;
    const scrGeo = new THREE.PlaneGeometry(scrW, scrH);
    const scrMat = new THREE.MeshBasicMaterial({ color: 0x131a2d });
    const screen = new THREE.Mesh(scrGeo, scrMat);
    screen.position.set(0, scrY, HALL.screenZ);
    scene.add(screen);

    let screenTexture = null;
    const videos = movie?.videos?.results || [];
    const trailer = videos.find(video => video.site === 'YouTube' && video.type === 'Trailer' && video.key)
      || videos.find(video => video.site === 'YouTube' && /trailer|teaser/i.test(video.type || '') && video.key)
      || videos.find(video => video.site === 'YouTube' && video.key);

    const paintScreenImage = (imagePath) => {
      if (!imagePath) return;
      const textureLoader = new THREE.TextureLoader();
      screenTexture = textureLoader.load(
        tmdbImageUrl(imagePath, 'w1280'),
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
          const imageAspect = texture.image.width / texture.image.height;
          const screenAspect = scrW / scrH;
          if (imageAspect > screenAspect) {
            texture.repeat.x = screenAspect / imageAspect;
            texture.offset.x = (1 - texture.repeat.x) / 2;
          } else {
            texture.repeat.y = imageAspect / screenAspect;
            texture.offset.y = (1 - texture.repeat.y) / 2;
          }
          screen.material.map = texture;
          screen.material.color.setHex(0xffffff);
          screen.material.needsUpdate = true;
        },
        undefined,
        () => {
          if (screenTexture) {
            screenTexture.dispose();
            screenTexture = null;
          }
        }
      );
    };

    // Still sits on the WebGL screen until (and behind) the playing trailer.
    paintScreenImage(movie?.backdrop_path || movie?.poster_path);

    if (trailer) {
      const isMobile = getW() < 768;
      const baseWidth = isMobile ? Math.max(320, getW()) : 1280;
      const baseHeight = baseWidth * 9 / 16;
      const frame = document.createElement('div');
      Object.assign(frame.style, {
        width: `${baseWidth}px`,
        height: `${baseHeight}px`,
        background: '#000',
        overflow: 'hidden',
      });

      const iframe = document.createElement('iframe');
      const videoId = encodeURIComponent(trailer.key);
      const mobileParams = 'autoplay=1&mute=1&controls=1&playsinline=1&rel=0&modestbranding=1';
      const desktopParams = `autoplay=1&mute=1&loop=1&playlist=${videoId}&playsinline=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
      iframe.src = `https://www.youtube.com/embed/${videoId}?${isMobile ? mobileParams : desktopParams}`;
      iframe.title = `${movie?.title || 'Movie'} trailer`;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      Object.assign(iframe.style, {
        width: '100%',
        height: '100%',
        border: '0',
        display: 'block',
        pointerEvents: isMobile ? 'auto' : 'none',
      });
      frame.appendChild(iframe);

      const trailerScreen = new CSS3DObject(frame);
      trailerScreen.position.set(0, scrY, HALL.screenZ + 0.06);
      trailerScreen.scale.set(scrW / baseWidth, scrH / baseHeight, 1);
      scene.add(trailerScreen);
    } else if (movie?.backdrop_path || movie?.poster_path) {
      const screenImagePath = movie.backdrop_path || movie.poster_path;
      const textureLoader = new THREE.TextureLoader();
      screenTexture = textureLoader.load(
        tmdbImageUrl(screenImagePath, 'w1280'),
        (texture) => {
          if (disposed) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
          const imageAspect = texture.image.width / texture.image.height;
          const screenAspect = scrW / scrH;
          if (imageAspect > screenAspect) {
            texture.repeat.x = screenAspect / imageAspect;
            texture.offset.x = (1 - texture.repeat.x) / 2;
          } else {
            texture.repeat.y = imageAspect / screenAspect;
            texture.offset.y = (1 - texture.repeat.y) / 2;
          }
          screen.material.map = texture;
          screen.material.color.setHex(0xffffff);
          screen.material.needsUpdate = true;
        },
        undefined,
        () => {
          if (screenTexture) {
            screenTexture.dispose();
            screenTexture = null;
          }
        }
      );
    }

    // Screen border frame
    const frameGeo = new THREE.BoxGeometry(scrW + 0.4, scrH + 0.4, 0.15);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x241a20,
      roughness: 0.72,
      metalness: 0.22,
      emissive: 0x12090b,
    });
    const screenFrame = new THREE.Mesh(frameGeo, frameMat);
    screenFrame.position.set(0, scrY, HALL.screenZ - 0.08);
    scene.add(screenFrame);

    const trimMat = new THREE.MeshBasicMaterial({ color: 0xd7ae69 });
    const screenTrim = new THREE.Group();
    [
      [scrW + 0.3, 0.035, 0.12, 0, scrY + scrH / 2 + 0.17, HALL.screenZ + 0.02],
      [scrW + 0.3, 0.035, 0.12, 0, scrY - scrH / 2 - 0.17, HALL.screenZ + 0.02],
      [0.035, scrH + 0.3, 0.12, -scrW / 2 - 0.17, scrY, HALL.screenZ + 0.02],
      [0.035, scrH + 0.3, 0.12, scrW / 2 + 0.17, scrY, HALL.screenZ + 0.02],
    ].forEach(([w, h, d, x, y, z]) => {
      const trim = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), trimMat);
      trim.position.set(x, y, z);
      screenTrim.add(trim);
    });
    scene.add(screenTrim);

    // ── Hall structure ─────────────────────────────────────────────────────
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1f1218, roughness: 0.92, metalness: 0.04 });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x121014, roughness: 0.94, metalness: 0.08 });
    const ceilMat  = new THREE.MeshStandardMaterial({ color: 0x0d0b10, roughness: 0.95 });

    // Floor — gentle rake toward the screen
    const floorGeo = new THREE.PlaneGeometry(HALL.hallW * 2 + 2, HALL.hallD + 4, 1, 8);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2 + 0.035;
    floor.position.set(0, -0.05, 3);
    floor.receiveShadow = true;
    scene.add(floor);

    // Ceiling
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(HALL.hallW * 2 + 2, HALL.hallD + 4), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, HALL.hallH, 3);
    scene.add(ceil);

    // Side walls
    const makeWall = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      scene.add(m);
      return m;
    };
    makeWall(0.4, HALL.hallH, HALL.hallD + 4, -HALL.hallW, HALL.hallH / 2, 3);
    makeWall(0.4, HALL.hallH, HALL.hallD + 4,  HALL.hallW, HALL.hallH / 2, 3);
    makeWall(HALL.hallW * 2 + 2, HALL.hallH, 0.4, 0, HALL.hallH / 2, HALL.hallD / 2 + 3); // back
    makeWall(HALL.hallW * 2 + 2, HALL.hallH, 0.4, 0, HALL.hallH / 2, HALL.screenZ - 0.5); // front/screen wall

    // Acoustic wall panels + emissive sconces (no per-panel PointLights).
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x2e171e,
      roughness: 0.92,
      emissive: 0x100608,
    });
    const sconceMat = new THREE.MeshBasicMaterial({ color: 0xd4a06a });
    for (let z = HALL.screenZ + 1.8; z < HALL.hallD / 2 + 1.5; z += 2.6) {
      for (const side of [-1, 1]) {
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5.1, 1.4), panelMat);
        panel.position.set(side * (HALL.hallW - 0.34), HALL.hallH * 0.42, z);
        scene.add(panel);

        const sconce = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), sconceMat);
        sconce.position.set(side * (HALL.hallW - 0.48), HALL.hallH * 0.3, z);
        scene.add(sconce);
      }
    }

    const ceilingStripMat = new THREE.MeshBasicMaterial({
      color: 0x9b8272,
      transparent: true,
      opacity: 0.28,
    });
    for (let x = -1; x <= 1; x++) {
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.045, 0.035, HALL.hallD - 2),
        ceilingStripMat
      );
      strip.position.set(x * 4.3, HALL.hallH - 0.12, 3);
      scene.add(strip);
    }

    const aisleLightMat = new THREE.MeshBasicMaterial({
      color: 0xa97749,
      transparent: true,
      opacity: 0.58,
    });
    [-1, 1].forEach(side => {
      const aisleLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.055, 0.035, HALL.hallD - 3),
        aisleLightMat
      );
      aisleLight.position.set(side * (HALL.hallW - 0.7), 0.015, 3);
      scene.add(aisleLight);
    });

    // ── Seats ─────────────────────────────────────────────────────────────
    const seatMeshes = [];

    const cushionShape = new THREE.Shape();
    const cushionW = HALL.seatW * 0.99;
    const cushionH = 0.24;
    const cushionR = 0.07;
    cushionShape.moveTo(-cushionW / 2 + cushionR, -cushionH / 2);
    cushionShape.lineTo(cushionW / 2 - cushionR, -cushionH / 2);
    cushionShape.quadraticCurveTo(cushionW / 2, -cushionH / 2, cushionW / 2, -cushionH / 2 + cushionR);
    cushionShape.lineTo(cushionW / 2, cushionH / 2 - cushionR);
    cushionShape.quadraticCurveTo(cushionW / 2, cushionH / 2, cushionW / 2 - cushionR, cushionH / 2);
    cushionShape.lineTo(-cushionW / 2 + cushionR, cushionH / 2);
    cushionShape.quadraticCurveTo(-cushionW / 2, cushionH / 2, -cushionW / 2, cushionH / 2 - cushionR);
    cushionShape.lineTo(-cushionW / 2, -cushionH / 2 + cushionR);
    cushionShape.quadraticCurveTo(-cushionW / 2, -cushionH / 2, -cushionW / 2 + cushionR, -cushionH / 2);
    const seatDepth = HALL.seatD * 0.78;
    const seatGeo = new THREE.ExtrudeGeometry(cushionShape, {
      depth: seatDepth,
      bevelEnabled: true,
      bevelSegments: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
      steps: 1,
    });
    seatGeo.translate(0, 0, -seatDepth / 2);
    const seatBackShape = new THREE.Shape();
    seatBackShape.moveTo(-HALL.seatW * 0.49, -0.36);
    seatBackShape.lineTo(HALL.seatW * 0.49, -0.36);
    seatBackShape.lineTo(HALL.seatW * 0.49, 0.2);
    seatBackShape.quadraticCurveTo(HALL.seatW * 0.49, 0.42, HALL.seatW * 0.27, 0.42);
    seatBackShape.lineTo(-HALL.seatW * 0.27, 0.42);
    seatBackShape.quadraticCurveTo(-HALL.seatW * 0.49, 0.42, -HALL.seatW * 0.49, 0.2);
    seatBackShape.closePath();
    const backGeo = new THREE.ExtrudeGeometry(seatBackShape, {
      depth: 0.12,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.02,
      bevelThickness: 0.02,
    });
    const armGeo = new THREE.BoxGeometry(0.13, 0.22, HALL.seatD * 0.82);
    const footGeo = new THREE.BoxGeometry(HALL.seatW * 0.68, 0.1, HALL.seatD * 0.56);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x201b21, roughness: 0.96 });
    const armMat = new THREE.MeshStandardMaterial({ color: 0x211b22, roughness: 0.76 });
    const rowEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x352a2a,
      roughness: 0.9,
      emissive: 0x100807,
      emissiveIntensity: 0.22,
    });

    const seatCapacity = HALL.rows.length * HALL.seatsPerRow;
    const seatInstances = {};
    const backInstances = {};
    const seatMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.08,
      emissive: 0x141820,
      emissiveIntensity: 0.35,
    });
    const backMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.62,
      metalness: 0.08,
      emissive: 0x141820,
      emissiveIntensity: 0.35,
    });
    Object.entries(CAT_COLOURS).forEach(([cat, cols]) => {
      const seatMesh = new THREE.InstancedMesh(seatGeo, seatMaterial, seatCapacity);
      seatMesh.count = 0;
      seatMesh.userData.seatData = [];
      seatMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(seatMesh);
      seatInstances[cat] = seatMesh;
      seatMeshes.push(seatMesh);

      const backMesh = new THREE.InstancedMesh(backGeo, backMaterial, seatCapacity);
      backMesh.count = 0;
      backMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      scene.add(backMesh);
      backInstances[cat] = backMesh;
    });

    const footInstances = new THREE.InstancedMesh(footGeo, armMat, seatCapacity);
    const armInstances = new THREE.InstancedMesh(armGeo, armMat, seatCapacity * 2);
    footInstances.count = 0;
    armInstances.count = 0;
    footInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    armInstances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    scene.add(footInstances, armInstances);

    const transform = new THREE.Object3D();
    const localTransform = new THREE.Matrix4();
    const finalMatrix = new THREE.Matrix4();
    const setPartTransform = (mesh, instanceId, x, y, z, rotationY, offsetX, offsetY, offsetZ) => {
      transform.position.set(x, y, z);
      transform.rotation.set(0, rotationY, 0);
      transform.updateMatrix();
      localTransform.makeTranslation(offsetX, offsetY, offsetZ);
      // Reuse matrices — avoid clone() per seat (was a major hitch on hall build).
      finalMatrix.copy(transform.matrix).multiply(localTransform);
      mesh.setMatrixAt(instanceId, finalMatrix);
    };
    const makeCurvedRowGeometry = (width, depth, centerX) => {
      const geometry = new THREE.BoxGeometry(width, 0.16, depth, 4, 1, 2);
      const positions = geometry.attributes.position;
      const centerCurve = (centerX * centerX) / (2 * HALL.curveRadius);
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const x = positions.getX(vertex);
        const globalX = centerX + x;
        positions.setZ(
          vertex,
          positions.getZ(vertex) + (globalX * globalX) / (2 * HALL.curveRadius) - centerCurve
        );
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
      return geometry;
    };

    // Keep demo availability stable for a movie and theatre.
    HALL.rows.forEach((row, ri) => {
      const rng = seededRand(hashStr(`sold-${movieId}-${theatreIdx}-${ri}`));
      const rowY = row.floorY;

      let seatNumber = 0;
      const rowSeatCount = row.sections.reduce((total, count) => total + count, 0);
      let sectionStart = -(rowSeatCount * HALL.seatW + (row.sections.length - 1) * HALL.aisleWidth) / 2;
      let x = -(rowSeatCount * HALL.seatW + (row.sections.length - 1) * HALL.aisleWidth) / 2
        + HALL.seatW / 2;

      row.sections.forEach((sectionCount, sectionIndex) => {
        const sectionWidth = sectionCount * HALL.seatW;
        const sectionCenter = sectionStart + sectionWidth / 2;
        const platform = new THREE.Mesh(
          makeCurvedRowGeometry(sectionWidth + 0.36, 0.92, sectionCenter),
          platformMat
        );
        const centerCurve = (sectionCenter * sectionCenter) / (2 * HALL.curveRadius);
        platform.position.set(sectionCenter, rowY - 0.08, row.z + centerCurve + 0.42);
        scene.add(platform);

        const rowEdge = new THREE.Mesh(
          makeCurvedRowGeometry(sectionWidth + 0.32, 0.055, sectionCenter),
          rowEdgeMat
        );
        rowEdge.position.set(sectionCenter, rowY - 0.005, row.z + centerCurve + 0.01);
        scene.add(rowEdge);

        for (let seatInSection = 0; seatInSection < sectionCount; seatInSection++) {
          const seatNum = ++seatNumber;
          const seatX = x;
          x += HALL.seatW;
          const z = row.z + (seatX * seatX) / (2 * HALL.curveRadius);
          const y = rowY;

          const isSold = rng() < 0.28;
          const cat    = row.cat;
          const rotationY = Math.atan2(seatX, HALL.curveRadius * 1.5);
          const seatMesh = seatInstances[cat];
          const backMesh = backInstances[cat];
          const seatInstanceId = seatMesh.count;
          const backInstanceId = backMesh.count;
          const data = {
            rowId: row.id, seatNum, cat, price: row.price,
            sold: isSold, x: seatX, z, y: y + 0.24,
            backInstanceId,
            baseColor: CAT_COLOURS[cat].base,
            selectedColor: CAT_COLOURS[cat].selected,
          };
          seatMesh.userData.seatData[seatInstanceId] = data;
          seatMesh.count++;
          seatMesh.setColorAt(
            seatInstanceId,
            new THREE.Color(isSold ? CAT_COLOURS[cat].sold : CAT_COLOURS[cat].base)
          );
          setPartTransform(seatMesh, seatInstanceId, seatX, y, z, rotationY, 0, 0.26, 0);

          backMesh.count++;
          backMesh.setColorAt(
            backInstanceId,
            new THREE.Color(isSold ? CAT_COLOURS[cat].sold : CAT_COLOURS[cat].base)
          );
          setPartTransform(backMesh, backInstanceId, seatX, y, z, rotationY, 0, 0.64, HALL.seatD * 0.18);

          const footInstanceId = footInstances.count++;
          setPartTransform(footInstances, footInstanceId, seatX, y, z, rotationY, 0, 0.1, 0);

          [-1, 1].forEach(side => {
            const armInstanceId = armInstances.count++;
            setPartTransform(
              armInstances,
              armInstanceId,
              seatX,
              y,
              z,
              rotationY,
              side * HALL.seatW * 0.39,
              0.34,
              0
            );
          });
        }
        if (sectionIndex < row.sections.length - 1) {
          sectionStart += sectionWidth + HALL.aisleWidth;
          x += HALL.aisleWidth;
        }
      });
    });

    // Sync selected seats from state to 3D on mount (in case of re-mount)
    seatMeshes.forEach(mesh => {
      mesh.userData.seatData.forEach((data, instanceId) => {
        const id = `${data.rowId}${data.seatNum}`;
        if (selectedSeatsRef.current.includes(id) && !data.sold) {
          mesh.setColorAt(instanceId, new THREE.Color(CAT_COLOURS[data.cat].selected));
          backInstances[data.cat].setColorAt(
            data.backInstanceId,
            new THREE.Color(CAT_COLOURS[data.cat].selected)
          );
        }
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    Object.values(backInstances).forEach(mesh => {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
    [...seatMeshes, ...Object.values(backInstances), footInstances, armInstances].forEach(mesh => {
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    });

    // ── Pointer handling ─────────────────────────────────────────────────
    let activePointerId = null;
    let lastPointer = { x: 0, y: 0 };
    let dragDistance = 0;
    let isDragMode = false;

    const raycaster = new THREE.Raycaster();
    const mouse     = new THREE.Vector2();

    const onPointerDown = (e) => {
      if (e.button !== 0) return;
      activePointerId = e.pointerId;
      isDragMode = false;
      lastPointer = { x: e.clientX, y: e.clientY };
      dragDistance = 0;
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e) => {
      if (e.pointerId !== activePointerId) return;
      const dx = e.clientX - lastPointer.x;
      const dy = e.clientY - lastPointer.y;
      dragDistance += Math.hypot(dx, dy);
      if (dragDistance > 6) isDragMode = true;
      if (isDragMode) {
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camTargetPos.current.clone().sub(camTargetLook.current));
        spherical.theta -= (dx / Math.max(1, canvas.clientWidth)) * Math.PI * 0.9;
        spherical.phi = THREE.MathUtils.clamp(
          spherical.phi + (dy / Math.max(1, canvas.clientHeight)) * Math.PI * 0.55,
          0.4,
          1.45
        );
        spherical.radius = THREE.MathUtils.clamp(
          spherical.radius,
          Math.max(8, HALL.hallW * 0.78),
          Math.min(28, HALL.hallD * 1.05)
        );

        const newPos = new THREE.Vector3().setFromSpherical(spherical).add(camTargetLook.current);
        newPos.x = THREE.MathUtils.clamp(newPos.x, -HALL.hallW + 0.8, HALL.hallW - 0.8);
        newPos.y = THREE.MathUtils.clamp(newPos.y, 0.85, HALL.hallH - 0.65);
        newPos.z = THREE.MathUtils.clamp(newPos.z, HALL.screenZ + 1, HALL.hallD / 2 + 2.2);

        camTargetPos.current.copy(newPos);
        lastPointer = { x: e.clientX, y: e.clientY };
      }
    };

    const selectSeatAt = (clientX, clientY) => {
      if (stepRef.current !== 1) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      camera.updateMatrixWorld();
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(seatMeshes, false);
      const hit = hits.find(({ object, instanceId }) =>
        Number.isInteger(instanceId) && object.userData.seatData[instanceId]
          && !object.userData.seatData[instanceId].sold
      );
      if (!hit) return;

      const { object: mesh, instanceId } = hit;
      const data = mesh.userData.seatData[instanceId];
      if (!data || data.sold) return;

      const seatId = `${data.rowId}${data.seatNum}`;

      if (selectedSeatsRef.current.includes(seatId)) {
        // Deselect
        selectedSeatsRef.current = selectedSeatsRef.current.filter(s => s !== seatId);
        mesh.setColorAt(instanceId, new THREE.Color(data.baseColor));
        backInstances[data.cat].setColorAt(
          data.backInstanceId,
          new THREE.Color(data.baseColor)
        );
        setSeatView(null);
      } else {
        // Select — nudge camera toward the seat without a hard POV slam
        // (hard seat-eye jumps felt like UI "overlap" with the panel).
        selectedSeatsRef.current = [...selectedSeatsRef.current, seatId];
        mesh.setColorAt(instanceId, new THREE.Color(data.selectedColor));
        backInstances[data.cat].setColorAt(
          data.backInstanceId,
          new THREE.Color(data.selectedColor)
        );
        const overview = PRESETS.overview;
        const eyePos = new THREE.Vector3(
          THREE.MathUtils.clamp(data.x * 0.35, -HALL.hallW * 0.35, HALL.hallW * 0.35),
          THREE.MathUtils.clamp((overview.pos[1] + data.y) * 0.55, 2.2, HALL.hallH - 1.2),
          THREE.MathUtils.clamp(data.z + 4.5, HALL.screenZ + 6, HALL.hallD / 2 + 1.5)
        );
        camTargetPos.current.copy(eyePos);
        camTargetLook.current.set(data.x * 0.2, HALL.screenY * 0.85, HALL.screenZ);
        setSeatView({ rowId: data.rowId, seatNum: data.seatNum, cat: data.cat });
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      backInstances[data.cat].instanceColor.needsUpdate = true;

      setSelectedSeats([...selectedSeatsRef.current]);
    };

    // Expose a colour sync so "Suggest Best Seats" can update the mesh without remount.
    paintSeatsRef.current = (selectedIds) => {
      const selected = new Set(selectedIds);
      seatMeshes.forEach(mesh => {
        mesh.userData.seatData.forEach((data, instanceId) => {
          if (!data || data.sold) return;
          const id = `${data.rowId}${data.seatNum}`;
          const color = selected.has(id) ? data.selectedColor : data.baseColor;
          mesh.setColorAt(instanceId, new THREE.Color(color));
          backInstances[data.cat].setColorAt(data.backInstanceId, new THREE.Color(color));
        });
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
      Object.values(backInstances).forEach(mesh => {
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
    };

    const onPointerUp = (e) => {
      if (e.pointerId !== activePointerId) return;
      if (!isDragMode) selectSeatAt(e.clientX, e.clientY);
      activePointerId = null;
    };

    const onPointerCancel = (e) => {
      if (e.pointerId === activePointerId) activePointerId = null;
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      if (disposed) return;
      const w = container.clientWidth  || window.innerWidth;
      const h = container.clientHeight || (window.innerHeight - 160);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      cssRenderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(container);
    // Apply immediately to handle initial narrow viewport
    onResize();

    // ── Animation loop ────────────────────────────────────────────────────
    let lastNow = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (disposed || stepRef.current !== 1) return;
      const now = performance.now();
      const dt  = Math.min(now - lastNow, 100);
      lastNow = now;

      // Auto-tour
      if (isAutoRef.current) {
        tourTimer.current += dt;
        if (tourTimer.current > 3200) {
          tourTimer.current = 0;
          const presetKeys = Object.keys(PRESETS);
          tourIdxRef.current = (tourIdxRef.current + 1) % presetKeys.length;
          const p = PRESETS[presetKeys[tourIdxRef.current]];
          camTargetPos.current.set(...p.pos);
          camTargetLook.current.set(...p.look);
        }
      }

      // Smooth camera — slightly snappier so the hall never feels sticky.
      const smoothFactor = 1 - Math.exp(-dt / 72);
      camera.position.lerp(camTargetPos.current, smoothFactor);
      cameraLook.lerp(camTargetLook.current, smoothFactor);
      camera.lookAt(cameraLook);

      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    };

    animate();

    // Initial preset
    const p0 = PRESETS[presetRef.current] || PRESETS.overview;
    if (p0) {
      camTargetPos.current.set(...p0.pos);
      camTargetLook.current.set(...p0.look);
      cameraLook.copy(camTargetLook.current);
    }

    return () => {
      disposed = true;
      paintSeatsRef.current = null;
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      window.removeEventListener('resize', onResize);
      ro.disconnect();
      scene.traverse(object => {
        object.geometry?.dispose();
        const materials = Array.isArray(object.material)
          ? object.material
          : object.material ? [object.material] : [];
        materials.forEach(material => {
          Object.values(material).forEach(value => {
            if (value?.isTexture) value.dispose();
          });
          material.dispose();
        });
      });
      renderer.dispose();
      cssRenderer.domElement.remove();
      if (container && renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  // Rebuild when cinema identity changes, or when returning to the seat step.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId, loading, theatreKey, step]);

  // Keep step ref in sync for the closure
  useEffect(() => { stepRef.current = step; }, [step]);

  // ── Override onClick in 3D to use current step ────────────────────────────
  // (we pass step via a ref in the closure above — no re-mount needed)

  // ── Totals ────────────────────────────────────────────────────────────────
  const seatTotal = selectedSeats.reduce((sum, id) => {
    const row = HALL.rows
      .filter(candidate => id.startsWith(candidate.id))
      .sort((a, b) => b.id.length - a.id.length)[0];
    return sum + (row?.price || 0);
  }, 0);

  const snackTotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = SNACKS.find(s => s.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const grandTotal = seatTotal + snackTotal;

  // ── Pay & generate ticket ─────────────────────────────────────────────────
  const handlePay = () => {
    setPayLoading(true);
    setTimeout(() => {
      const ticketId = `CS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      const selectedTheatre = cityTheatres[theatreIdx] || theatre;
      const show     = showtimes[showIdx];
      const newTicket = {
        id: ticketId,
        movieId,
        movieTitle: movie?.title || 'Movie',
        moviePoster: movie?.poster_path ? tmdbImageUrl(movie.poster_path, 'w342') : null,
        theatre: selectedTheatre.name,
        city: selectedTheatre.city,
        time: show?.time,
        format: show?.format,
        seats: selectedSeats,
        snacks: Object.entries(cart).map(([id, qty]) => {
          const item = SNACKS.find(s => s.id === id);
          return item ? `${item.name} x${qty}` : null;
        }).filter(Boolean),
        total: grandTotal,
        bookedAt: new Date().toISOString(),
        demo: true,
      };
      // Save to localStorage
      const existing = JSON.parse(localStorage.getItem('cineshelf_tickets') || '[]');
      localStorage.setItem('cineshelf_tickets', JSON.stringify([newTicket, ...existing]));
      setTicket(newTicket);
      setPayLoading(false);
      setStep(5);
    }, 2200);
  };

  // ── UI helpers ────────────────────────────────────────────────────────────
  const addSnack = (id) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const removeSnack = (id) => setCart(c => {
    const next = { ...c };
    if (next[id] > 1) next[id]--; else delete next[id];
    return next;
  });

  const CAT_LABEL = { standard: 'Standard', premium: 'Premium', recliner: 'Recliner', balcony: 'Balcony' };
  const STEP_LABELS = ['', 'Pick Seats (Demo)', 'Snacks', 'Review', 'Demo Checkout', 'Demo Ticket'];
  const show    = showtimes[showIdx];

  // ── Suggest best seats ─────────────────────────────────────────────────────
  const suggestBestSeats = useCallback(() => {
    // Build a list of all available seats from HALL
    const available = [];
    HALL.rows.forEach((row, ri) => {
      const rng = seededRand(hashStr(`sold-${movieId}-${theatreIdx}-${ri}`));
      let seatNumber = 0;
      row.sections.forEach(sectionCount => {
        for (let i = 0; i < sectionCount; i++) {
          const seatNum = ++seatNumber;
          const isSold = rng() < 0.28;
          if (!isSold) available.push({ rowId: row.id, seatNum, ri, row });
        }
      });
    });

    if (available.length < 2) return;

    // Target middle rows (around 55-75% from front)
    const midRi = Math.floor(HALL.rows.length * 0.65);
    const totalSeatsPerRow = HALL.rows.map(r => r.sections.reduce((a, b) => a + b, 0));
    const maxSeats = Math.max(...totalSeatsPerRow);

    // Score: prefer rows near midRi and seats near center
    const scored = available.map(s => {
      const rowDist = Math.abs(s.ri - midRi);
      const seatCenter = totalSeatsPerRow[s.ri] / 2 + 0.5;
      const seatDist = Math.abs(s.seatNum - seatCenter);
      return { ...s, score: rowDist * 10 + seatDist };
    });
    scored.sort((a, b) => a.score - b.score);

    // Find 2 adjacent seats in the same row from top candidates
    let best = null;
    for (let i = 0; i < scored.length - 1; i++) {
      const a = scored[i];
      for (let j = i + 1; j < Math.min(scored.length, i + 20); j++) {
        const b = scored[j];
        if (a.rowId === b.rowId && Math.abs(a.seatNum - b.seatNum) === 1) {
          best = [a, b];
          break;
        }
      }
      if (best) break;
    }
    if (!best) best = [scored[0], scored[1]];

    // Clear current selection and apply suggestion
    selectedSeatsRef.current = best.map(s => `${s.rowId}${s.seatNum}`);
    setSelectedSeats([...selectedSeatsRef.current]);
    paintSeatsRef.current?.(selectedSeatsRef.current);
    setSeatView({
      rowId: best[0].rowId,
      seatNum: best[0].seatNum,
      cat: best[0].row.cat,
    });
  }, [HALL, movieId, theatreIdx]);

  return (
    <div style={{ minHeight: '100vh', background: '#07090f', color: '#f5f0e8' }}>
      <Navbar />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          .theatre-camera-controls {
            top: 8px !important;
            right: 8px !important;
            max-width: 118px !important;
            gap: 0.28rem !important;
          }
          .theatre-camera-controls button {
            padding: 0.32rem 0.55rem !important;
            font-size: 0.64rem !important;
          }
          .theatre-selection-dock {
            left: 8px !important;
            right: 8px !important;
            bottom: 8px !important;
            padding: 0.55rem 0.65rem !important;
          }
        }
      `}</style>

      {/* Loading overlay */}
      {loading && (
        <div style={{
          position: 'fixed', top: 58, left: 0, right: 0, bottom: 0,
          background: '#07090f', zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ textAlign: 'center', color: '#f5f0e8', fontFamily: 'var(--vc-font-body)' }}>
            <div style={{
              width: 28, height: 28, margin: '0 auto 1rem', borderRadius: '50%',
              border: '2px solid rgba(245,240,232,0.18)', borderTopColor: '#d4af37',
              animation: 'spin 0.7s linear infinite',
            }} aria-hidden="true" />
            <p style={{ color: 'rgba(245,240,232,0.6)' }}>Loading theatre…</p>
          </div>
        </div>
      )}

      {/* ── Step indicator ── */}
      <div className="theatre-steps" style={{
        position: 'sticky', top: 58, zIndex: 50,
        background: 'rgba(7,9,15,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0.6rem 1.5rem',
        display: 'flex', alignItems: 'center', gap: '0.4rem',
        overflowX: 'auto',
      }}>
        {[1,2,3,4].map(s => (
          <React.Fragment key={s}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              opacity: step >= s ? 1 : 0.4,
              cursor: step > s && step < 5 ? 'pointer' : 'default',
              flexShrink: 0,
            }}
              onClick={() => { if (step > s && step < 5) setStep(s); }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: step > s ? '#d4af37' : step === s ? 'linear-gradient(135deg,#d4af37,#f5cc50)' : 'rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.7rem', fontWeight: 700,
                color: step >= s ? '#0a0f1a' : '#f5f0e8',
              }}>
                {step > s ? '✓' : s}
              </div>
              <span style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                {STEP_LABELS[s]}
              </span>
            </div>
            {s < 4 && <div style={{ flex: 1, minWidth: 20, height: 1, background: step > s ? '#d4af37' : 'rgba(255,255,255,0.1)' }} />}
          </React.Fragment>
        ))}
        <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--vc-font-display)', fontSize: '0.9rem', fontWeight: 700 }}>
            {movie?.title}
          </span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          STEP 1 — 3D Seat Picker
      ═══════════════════════════════════════════════════════════════ */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 58px - 46px)' }}>

          {/* Theatre + showtime selectors */}
          <div className="theatre-booking-selectors" style={{
            padding: '0.75rem 1.5rem',
            background: 'rgba(255,255,255,0.03)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
          }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontFamily: 'var(--vc-font-body)', fontSize: '0.68rem', color: 'rgba(245,240,232,0.6)' }}>
              City in India
              <input
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') searchCityTheatres();
                }}
                list="indian-cinema-cities"
                placeholder="Enter a city"
                aria-label="Search cinemas by Indian city"
                style={{
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 8, color: '#f5f0e8', fontFamily: 'var(--vc-font-body)',
                  fontSize: '0.82rem', padding: '0.4rem 0.8rem',
                }}
              />
              <datalist id="indian-cinema-cities">
                {INDIAN_CITIES.map(item => <option key={item} value={item} />)}
              </datalist>
            </label>
            <button
              type="button"
              onClick={searchCityTheatres}
              disabled={!cityInput.trim() || theatreLookupLoading}
              style={{
                ...primaryBtnStyle,
                padding: '0.55rem 0.9rem',
                fontSize: '0.75rem',
                opacity: theatreLookupLoading ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
              }}
            >
              {theatreLookupLoading && (
                <span style={{
                  width: 12, height: 12, borderRadius: '50%',
                  border: '1.5px solid rgba(10,15,26,0.25)', borderTopColor: '#0a0f1a',
                  animation: 'spin 0.65s linear infinite', display: 'inline-block',
                }} aria-hidden="true" />
              )}
              {theatreLookupLoading ? 'Finding…' : 'Find theatres'}
            </button>

            {/* Demo theatre selector */}
            <select
              value={theatreIdx}
              onChange={e => setTheatreIdx(Number(e.target.value))}
              disabled={!cityTheatres.length}
              style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, color: '#f5f0e8', fontFamily: 'var(--vc-font-body)',
                fontSize: '0.82rem', padding: '0.4rem 0.8rem', cursor: 'pointer',
              }}
            >
              {cityTheatres.map((t, i) => (
                <option key={`${t.name}-${i}`} value={i} style={{ background: '#0a0f1a' }}>
                  {t.name}{t.source === 'OpenStreetMap' ? ` · ${t.dist} km` : ' · demo preview'}
                </option>
              ))}
              {!cityTheatres.length && (
                <option value={0} style={{ background: '#0a0f1a' }}>
                  {theatreLookupLoading ? 'Searching mapped cinemas…' : 'No theatres found'}
                </option>
              )}
            </select>
            <span role="status" style={{ fontFamily: 'var(--vc-font-body)', color: 'rgba(245,240,232,0.65)', fontSize: '0.72rem' }}>
              {mappedTheatres.length ? `${mappedTheatres.length} mapped cinemas within 50 km` : 'Sample preview only'}
            </span>
            {mappedTheatres.length > 0 && (
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'rgba(245,240,232,0.55)', fontFamily: 'var(--vc-font-body)', fontSize: '0.68rem' }}
              >
                © OpenStreetMap contributors
              </a>
            )}

            {/* Showtimes */}
            <div className="vc-mobile-wrap theatre-showtimes" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', flex: 1 }}>
              {showtimes.map((s, i) => (
                <button key={i} onClick={() => setShowIdx(i)} style={{
                  padding: '0.4rem 0.9rem', borderRadius: 8, whiteSpace: 'nowrap',
                  background: showIdx === i ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.05)',
                  border: showIdx === i ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.1)',
                  color: showIdx === i ? '#d4af37' : 'rgba(245,240,232,0.75)',
                  fontFamily: 'var(--vc-font-body)', fontSize: '0.78rem', cursor: 'pointer',
                }}>
                  <div style={{ fontWeight: 700 }}>{s.time}</div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.8 }}>{s.format}</div>
                </button>
              ))}
            </div>
            <a
              href={getBookMyShowUrl(city, movie?.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="vc-btn vc-btn-primary"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
            >
              Live shows on BookMyShow
            </a>
          </div>
          <div style={{
            padding: '0.55rem 1.5rem',
            background: 'rgba(212,175,55,0.08)',
            borderBottom: '1px solid rgba(212,175,55,0.16)',
            color: 'rgba(245,240,232,0.72)',
            fontFamily: 'var(--vc-font-body)',
            fontSize: '0.75rem',
          }}>
            {mappedTheatres.length
              ? 'Theatre names and distances are public OpenStreetMap listings. Seat layout, showtimes, availability and prices are estimates for preview only—not live booking data.'
              : `Seat layout, showtimes, availability and prices are sample data. ${theatreLookupError ? `${theatreLookupError} ` : ''}Use the links for live listings and real bookings.`}
          </div>

          {theatreLookupError && !mappedTheatres.length && (
            <p role="status" style={{ margin: '0.5rem 1.5rem', color: '#f0d060', fontFamily: 'var(--vc-font-body)', fontSize: '0.78rem' }}>
              Map lookup failed: {theatreLookupError} A clearly labeled sample seat preview is available; use BookMyShow for actual cinemas and shows.
            </p>
          )}

          {/* 3D canvas + controls */}
          <div style={{ flex: 1, position: 'relative', minHeight: 420 }}>

            {/* 3D canvas */}
            <div ref={mountRef} style={{ width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }} />

            {/* Camera presets — top-right rail so the seat rake stays clear */}
            <div style={{
              position: 'absolute', top: 12, right: 12, zIndex: 12,
              display: 'flex', flexDirection: 'column', gap: '0.35rem',
              alignItems: 'stretch',
              maxWidth: 140,
            }} className="theatre-camera-controls">
              {Object.keys(PRESETS).map(name => (
                <button key={name} type="button" onClick={() => { goPreset(name); isAutoRef.current = false; setIsAuto(false); }} style={{
                  padding: '0.38rem 0.7rem',
                  background: currentPreset === name ? 'rgba(212,175,55,0.22)' : 'rgba(0,0,0,0.62)',
                  border: currentPreset === name ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 6, color: currentPreset === name ? '#d4af37' : 'rgba(245,240,232,0.75)',
                  fontFamily: 'var(--vc-font-body)', fontSize: '0.7rem', cursor: 'pointer',
                  textAlign: 'left', backdropFilter: 'blur(8px)',
                }}>
                  {name === 'birdsEye' ? "Bird's Eye" : name === 'fromStage' ? 'From Stage' : name.charAt(0).toUpperCase() + name.slice(1)}
                </button>
              ))}
              <button type="button" onClick={() => {
                isAutoRef.current = !isAutoRef.current;
                setIsAuto(a => !a);
                tourTimer.current = 0;
              }} style={{
                padding: '0.38rem 0.7rem',
                background: isAuto ? 'rgba(212,175,55,0.22)' : 'rgba(0,0,0,0.62)',
                border: isAuto ? '1px solid #d4af37' : '1px solid rgba(255,255,255,0.14)',
                borderRadius: 6, color: isAuto ? '#d4af37' : 'rgba(245,240,232,0.75)',
                fontFamily: 'var(--vc-font-body)', fontSize: '0.7rem', cursor: 'pointer',
                textAlign: 'left', backdropFilter: 'blur(8px)',
              }}>
                {isAuto ? 'Stop Tour' : 'Auto Tour'}
              </button>
            </div>

            {/* Seat view badge — top-left */}
            {seatView && (
              <div style={{
                position: 'absolute', top: 12, left: 12,
                background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)',
                borderRadius: 8, padding: '0.4rem 0.85rem',
                fontFamily: 'var(--vc-font-body)', fontSize: '0.78rem', color: '#d4af37',
                zIndex: 12, backdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', gap: '0.65rem',
              }}>
                <span>Seat {seatView.rowId}{seatView.seatNum} · {CAT_LABEL[seatView.cat]}</span>
                <button type="button" onClick={() => { goPreset('overview'); setSeatView(null); }}
                  style={{ background: 'none', border: 'none', color: '#d4af37', cursor: 'pointer', fontSize: '0.78rem', padding: 0 }}>
                  Reset view
                </button>
              </div>
            )}

            {sceneError && (
              <div role="alert" style={{
                position: 'absolute', inset: 12, zIndex: 20,
                display: 'grid', placeItems: 'center',
                background: 'rgba(7,9,15,0.88)', borderRadius: 12,
                padding: '1.25rem', textAlign: 'center',
                fontFamily: 'var(--vc-font-body)', color: 'rgba(245,240,232,0.85)',
              }}>
                <div>
                  <p style={{ margin: '0 0 0.85rem' }}>{sceneError}</p>
                  <a
                    href={getBookMyShowUrl(city, movie?.title)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#d4af37', fontWeight: 700 }}
                  >
                    Open BookMyShow
                  </a>
                </div>
              </div>
            )}

            {/* Bottom dock — legend lives here so seats stay visible in the 3D view */}
            <div className="theatre-selection-dock" style={{
              position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 14,
              display: 'grid',
              gap: '0.55rem',
              padding: '0.65rem 0.85rem',
              background: 'rgba(8,10,16,0.94)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              backdropFilter: 'blur(14px)',
              boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
            }}>
              <div className="theatre-seat-legend" style={{
                display: 'flex', flexWrap: 'wrap', gap: '0.45rem 0.85rem',
                fontFamily: 'var(--vc-font-body)', fontSize: '0.66rem',
                color: 'rgba(245,240,232,0.62)',
              }}>
                {[
                  ['#3d6f8c', 'Standard ₹180'],
                  ['#6b4f86', 'Premium ₹280'],
                  ['#2f6a55', 'Recliner ₹450'],
                  ['#a67550', 'Balcony ₹320'],
                  ['#ffd35a', 'Selected'],
                  ['#23242a', 'Sold'],
                ].map(([col, label]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <div style={{ width: 10, height: 10, background: col, borderRadius: 2 }} />
                    {label}
                  </div>
                ))}
              </div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem 0.85rem',
              }}>
                {movie?.poster_path && (
                  <img
                    src={tmdbImageUrl(movie.poster_path, 'w92')}
                    alt=""
                    style={{ width: 36, height: 54, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                  />
                )}
                <div style={{ minWidth: 0, flex: '1 1 140px' }}>
                  <div style={{
                    fontFamily: 'var(--vc-font-display)', fontSize: '0.92rem', fontWeight: 600,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {movie?.title || 'Select seats'}
                  </div>
                  <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.72rem', color: 'rgba(245,240,232,0.55)' }}>
                    {show?.time} · {show?.format} · {theatre?.name}
                  </div>
                  <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.74rem', color: 'rgba(245,240,232,0.75)', marginTop: 2 }}>
                    {selectedSeats.length
                      ? `Seats ${selectedSeats.join(', ')}`
                      : 'Drag to rotate · tap a seat to select'}
                  </div>
                </div>
                <div style={{
                  fontFamily: 'var(--vc-font-body)', fontWeight: 700, fontSize: '0.95rem',
                  color: '#d4af37', whiteSpace: 'nowrap',
                }}>
                  ₹{seatTotal}
                </div>
                <button
                  type="button"
                  onClick={suggestBestSeats}
                  style={{
                    padding: '0.45rem 0.75rem',
                    background: 'rgba(212,175,55,0.08)',
                    border: '1px solid rgba(212,175,55,0.3)', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'var(--vc-font-body)', fontWeight: 600, fontSize: '0.74rem',
                    color: '#d4af37',
                  }}
                >
                  Suggest best
                </button>
                <button
                  type="button"
                  disabled={!selectedSeats.length}
                  onClick={() => setStep(2)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: selectedSeats.length
                      ? 'linear-gradient(135deg,#d4af37,#f5cc50)'
                      : 'rgba(255,255,255,0.08)',
                    border: 'none', borderRadius: 8,
                    cursor: selectedSeats.length ? 'pointer' : 'not-allowed',
                    fontFamily: 'var(--vc-font-body)', fontWeight: 700, fontSize: '0.8rem',
                    color: selectedSeats.length ? '#0a0f1a' : 'rgba(245,240,232,0.35)',
                    opacity: selectedSeats.length ? 1 : 0.7,
                  }}
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 2 — Snacks
      ═══════════════════════════════════════════════════════════════ */}
      {step === 2 && (
        <div style={{ maxWidth: 740, margin: '0 auto', padding: '1.5rem 1rem' }}>
          <h2 style={{ fontFamily: 'var(--vc-font-display)', fontSize: '1.6rem', marginBottom: '0.4rem' }}>
            Add Snacks
          </h2>
          <p style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.85rem', color: 'rgba(245,240,232,0.55)', marginBottom: '1.5rem' }}>
            Pre-order at the counter price — no queues!
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.9rem', marginBottom: '2rem' }}>
            {SNACKS.map(item => (
              <div key={item.id} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.4rem',
              }}>
                <img
                  src={item.img}
                  alt={item.name}
                  style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: '8px 8px 0 0', display: 'block' }}
                  loading="lazy"
                />
                <div style={{ padding: '0 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1 }}>
                  <div style={{ fontFamily: 'var(--vc-font-body)', fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                  <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.75rem', color: 'rgba(245,240,232,0.5)' }}>{item.desc}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                    <span style={{ fontFamily: 'var(--vc-font-body)', fontWeight: 700, color: '#d4af37' }}>₹{item.price}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {cart[item.id] ? (
                        <>
                          <button onClick={() => removeSnack(item.id)} style={qtyBtnStyle}>−</button>
                          <span style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.9rem', minWidth: 20, textAlign: 'center' }}>{cart[item.id]}</span>
                          <button onClick={() => addSnack(item.id)} style={qtyBtnStyle}>+</button>
                        </>
                      ) : (
                        <button onClick={() => addSnack(item.id)} style={{
                          padding: '0.3rem 0.9rem', background: 'rgba(212,175,55,0.1)',
                          border: '1px solid rgba(212,175,55,0.3)', borderRadius: 6,
                          color: '#d4af37', fontFamily: 'var(--vc-font-body)', fontSize: '0.78rem', cursor: 'pointer',
                        }}>Add</button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setStep(1)} style={backBtnStyle}>← Back</button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
              {snackTotal > 0 && (
                <span style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.85rem', color: 'rgba(245,240,232,0.6)' }}>
                  Snacks: <strong style={{ color: '#d4af37' }}>₹{snackTotal}</strong>
                </span>
              )}
              <button onClick={() => setStep(3)} style={primaryBtnStyle}>Review Order →</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 3 — Review
      ═══════════════════════════════════════════════════════════════ */}
      {step === 3 && (
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem 1rem' }}>
          <h2 style={{ fontFamily: 'var(--vc-font-display)', fontSize: '1.6rem', marginBottom: '1.5rem' }}>
            Order Summary
          </h2>

          {/* Movie card */}
          <div style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: '1.2rem', marginBottom: '1rem',
            display: 'flex', gap: '1rem',
          }}>
            {movie?.poster_path && (
              <img src={tmdbImageUrl(movie.poster_path, 'w92')} alt="" style={{ width: 56, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontFamily: 'var(--vc-font-display)', fontWeight: 700, fontSize: '1.05rem' }}>{movie?.title}</div>
              <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.8rem', color: 'rgba(245,240,232,0.6)', marginTop: '0.3rem' }}>
                {theatre?.name} · {theatre?.city}<br />
                {show?.time} · {show?.format}
              </div>
            </div>
          </div>

          <ReviewLine label="Seats" value={selectedSeats.join(', ')} />
          <ReviewLine label="Seat total" value={`₹${seatTotal}`} gold />
          {Object.entries(cart).map(([id, qty]) => {
            const item = SNACKS.find(s => s.id === id);
            return item ? <ReviewLine key={id} label={`${item.name} x${qty}`} value={`₹${item.price * qty}`} /> : null;
          })}
          {snackTotal > 0 && <ReviewLine label="Snack total" value={`₹${snackTotal}`} gold />}

          <div style={{
            margin: '1rem 0', padding: '0.9rem 1rem',
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10,
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--vc-font-body)', fontWeight: 700, fontSize: '1rem',
          }}>
            <span>Grand Total</span>
            <span style={{ color: '#d4af37' }}>₹{grandTotal}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
            <button onClick={() => setStep(2)} style={backBtnStyle}>← Back</button>
            <button onClick={() => setStep(4)} style={primaryBtnStyle}>Continue to Demo Checkout →</button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 4 — Demo checkout
      ═══════════════════════════════════════════════════════════════ */}
      {step === 4 && (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '1.5rem 1rem' }}>
          <h2 style={{ fontFamily: 'var(--vc-font-display)', fontSize: '1.6rem', marginBottom: '0.5rem' }}>Demo checkout</h2>
          <p style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.85rem', color: 'rgba(245,240,232,0.5)', marginBottom: '1.5rem' }}>
            No live ticket inventory or payment provider is connected. This only creates a sample ticket in this browser.
          </p>

          <div style={{
            padding: '1rem',
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.25)',
            borderRadius: 10,
            fontFamily: 'var(--vc-font-body)',
            fontSize: '0.85rem',
            lineHeight: 1.6,
          }}>
            For real showtimes, seat availability and booking, open the official BookMyShow listings for {city}.
            <a href={getBookMyShowUrl(city, movie?.title)} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '0.5rem', color: '#d4af37', fontWeight: 700 }}>
              Open {movie?.title || 'movies'} on BookMyShow
            </a>
          </div>

          <div style={{
            margin: '1.5rem 0', padding: '0.9rem 1rem',
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: 10,
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--vc-font-body)', fontWeight: 700, fontSize: '1rem',
          }}>
            <span>Sample total (not charged)</span>
            <span style={{ color: '#d4af37' }}>₹{grandTotal}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button onClick={() => setStep(3)} style={backBtnStyle} disabled={payLoading}>← Back</button>
            <button
              onClick={handlePay}
              disabled={payLoading}
              style={{
                ...primaryBtnStyle,
                opacity: payLoading ? 0.7 : 1,
                minWidth: 160,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {payLoading ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '1.5px solid rgba(10,15,26,0.25)', borderTopColor: '#0a0f1a',
                    animation: 'spin 0.65s linear infinite', display: 'inline-block',
                  }} aria-hidden="true" />
                  Creating demo…
                </>
              ) : 'Create Demo Ticket'}
            </button>
          </div>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          STEP 5 — Ticket
      ═══════════════════════════════════════════════════════════════ */}
      {step === 5 && ticket && (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '1.5rem 1rem', textAlign: 'center' }}>
          <div style={{
            width: 42, height: 42, margin: '0 auto 0.75rem', borderRadius: '50%',
            background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.45)',
            display: 'grid', placeItems: 'center', color: '#d4af37',
            fontFamily: 'var(--vc-font-body)', fontWeight: 700, fontSize: '0.85rem',
          }}>OK</div>
          <h2 style={{ fontFamily: 'var(--vc-font-display)', fontSize: '1.8rem', marginBottom: '0.3rem' }}>
            Demo ticket created
          </h2>
          <p style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.85rem', color: 'rgba(245,240,232,0.72)', marginBottom: '2rem' }}>
            This is a sample only—not a real booking or entry ticket. Ticket ID: <strong style={{ color: '#d4af37' }}>{ticket.id}</strong>
          </p>

          {/* Ticket card */}
          <div style={{
            background: 'linear-gradient(145deg, #0d1628, #12203a)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: 16, padding: '1.5rem', marginBottom: '1.5rem',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            {/* Dashed tear line */}
            <div style={{ borderTop: '2px dashed rgba(212,175,55,0.2)', margin: '1rem -1.5rem', position: 'relative' }}>
              <div style={{ position: 'absolute', left: -12, top: -10, width: 20, height: 20, background: '#07090f', borderRadius: '50%' }} />
              <div style={{ position: 'absolute', right: -12, top: -10, width: 20, height: 20, background: '#07090f', borderRadius: '50%' }} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', alignItems: 'flex-start' }}>
              {ticket.moviePoster && (
                <img src={ticket.moviePoster} alt="" style={{ width: 64, borderRadius: 8, flexShrink: 0, objectFit: 'cover', aspectRatio: '2/3' }} />
              )}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontFamily: 'var(--vc-font-display)', fontWeight: 700, fontSize: '1.1rem' }}>{ticket.movieTitle}</div>
                <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.78rem', color: 'rgba(245,240,232,0.6)', marginTop: '0.3rem', lineHeight: 1.6 }}>
                  {ticket.theatre}<br />
                  {ticket.time} · {ticket.format}<br />
                  Seats: <strong style={{ color: '#f5f0e8' }}>{ticket.seats.join(', ')}</strong>
                </div>
              </div>
            </div>

            {ticket.snacks.length > 0 && (
              <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.75rem', color: 'rgba(245,240,232,0.5)', textAlign: 'left', marginBottom: '1rem' }}>
                Snacks: {ticket.snacks.join(' · ')}
              </div>
            )}

            {/* QR Code */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <QRCode ticketId={ticket.id} size={130} />
            </div>
            <div style={{ fontFamily: 'var(--vc-font-body)', fontSize: '0.7rem', color: 'rgba(245,240,232,0.4)', letterSpacing: '0.08em' }}>
              DEMO QR — NOT VALID FOR ENTRY · {ticket.id}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/my-tickets" style={primaryBtnStyle}>View My Tickets</Link>
            <Link to="/" style={backBtnStyle}>← Home</Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function ReviewLine({ label, value, gold }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '0.55rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
      fontFamily: 'var(--vc-font-body)', fontSize: '0.84rem',
    }}>
      <span style={{ color: 'rgba(245,240,232,0.6)' }}>{label}</span>
      <span style={{ color: gold ? '#d4af37' : '#f5f0e8', fontWeight: gold ? 700 : 400, textAlign: 'right', maxWidth: '55%', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}

const primaryBtnStyle = {
  display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
  padding: '0.6rem 1.5rem',
  background: 'linear-gradient(135deg,#d4af37,#f5cc50)',
  border: 'none', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'var(--vc-font-body)', fontWeight: 700, fontSize: '0.85rem',
  color: '#0a0f1a', textDecoration: 'none',
};

const backBtnStyle = {
  display: 'inline-flex', alignItems: 'center',
  padding: '0.6rem 1.2rem',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, cursor: 'pointer',
  fontFamily: 'var(--vc-font-body)', fontSize: '0.82rem',
  color: 'rgba(245,240,232,0.75)', textDecoration: 'none',
};

const qtyBtnStyle = {
  width: 26, height: 26, borderRadius: 6,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  color: '#f5f0e8', cursor: 'pointer', fontFamily: 'var(--vc-font-body)', fontSize: '1rem',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
