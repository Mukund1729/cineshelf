
import React, { useState, useEffect } from "react";
import axios from 'axios';
import rImg from '../pages/R.jpeg';
import visual21cImg from '../pages/avatar movie - namafilm (1).jpg';
import debutsImg from '../pages/quetin.jpg';
import avatarOverlay from '../pages/avatar movie - namafilm (1).jpg';
import collageBg from '../pages/4839475.jpg';

const TABS = [
  "All",
  "Editor's Choice",
  "Visual Themes",
  "Decade Picks",
  "Community Lists",
  "Director Spotlights",
];

export default function CinematicPicks() {
  const [activeTab, setActiveTab] = useState("All");
  const [picks, setPicks] = useState([]);
  const [editorsChoice, setEditorsChoice] = useState([]);
  const [visualThemes, setVisualThemes] = useState([]);
  const [decadePicks, setDecadePicks] = useState([]);
  const [communityLists, setCommunityLists] = useState([]);
  const [directorSpotlights, setDirectorSpotlights] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    // Fetch all picks for "All" tab
    axios.get('/api/picks').then(res => setPicks(res.data?.data || [])).catch(() => setPicks([])).finally(() => setLoading(false));
    // Editor's Choice
    axios.get('/api/picks/type/editor').then(res => setEditorsChoice(res.data?.data || [])).catch(() => setEditorsChoice([]));
    // Visual Themes
    axios.get('/api/picks/type/visual').then(res => setVisualThemes(res.data?.data || [])).catch(() => setVisualThemes([]));
    // Decade Picks
    axios.get('/api/picks/type/decade').then(res => setDecadePicks(res.data?.data || [])).catch(() => setDecadePicks([]));
    // Community Lists — correct endpoint
    axios.get('/api/picks/community').then(res => setCommunityLists(res.data?.data || [])).catch(() => setCommunityLists([]));
    // Director Spotlights — correct endpoint
    axios.get('/api/picks/directors').then(res => setDirectorSpotlights(res.data?.data || [])).catch(() => setDirectorSpotlights([]));
  }, []);

  return (
    <div className="min-h-screen relative text-white font-sans overflow-x-hidden">
      {/* Fullscreen fixed blurred/darkened collage background */}
      {/* Collage background */}
      <img
        src={collageBg}
        alt="movie collage background"
        className="fixed inset-0 w-full h-full object-cover object-center z-0 pointer-events-none select-none"
        aria-hidden="true"
        style={{
          filter: 'blur(10px) brightness(0.5)',
          WebkitFilter: 'blur(10px) brightness(0.5)',
          willChange: 'transform',
        }}
      />
      <div
        className="fixed inset-0 w-full h-full z-10 pointer-events-none"
        style={{
          background: `linear-gradient(to bottom, rgba(10,10,20,0.7) 0%, rgba(10,10,20,0.7) 100%)`,
        }}
      />

      {/* Fixed logo at top-left, styled like Movie Detail page */}
      <a
        href="/"
        className="fixed top-0 left-0 z-50 m-3 font-extrabold font-playfair text-lg md:text-xl lg:text-2xl tracking-tight select-none"
        style={{
          letterSpacing: '0.04em',
          background: 'linear-gradient(90deg, #fff 30%, #fbbf24 60%, #f59e42 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          textFillColor: 'transparent',
          textShadow: '0 2px 10px rgba(0,0,0,0.13)',
          fontFamily: 'Playfair Display, serif',
        }}
      >
        visual.cineaste
      </a>

      {/* ...removed Cinematic Picks heading... */}

      {/* Navigation Tabs Centered - moved up */}
      <div className="w-full flex justify-center items-center mb-8 z-30 relative" style={{marginTop: '2.5rem'}}>
        <nav className="flex flex-wrap gap-2 md:gap-4 bg-black/30 px-4 py-2 rounded-full shadow-lg backdrop-blur-md">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full font-semibold text-sm md:text-base transition-all duration-150 font-poppins focus:outline-none ${activeTab === tab
                ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-pink-400 text-gray-900 shadow-lg scale-105'
                : 'bg-[#181c24]/70 text-cyan-100 hover:bg-yellow-400/20 hover:text-yellow-200'}`}
              style={activeTab === tab ? {
                background: 'linear-gradient(90deg, #fbbf24 10%, #f59e42 60%, #ff7e5f 100%)',
                color: '#181c24',
                fontWeight: 700,
                boxShadow: '0 2px 12px 0 rgba(251,191,36,0.18)'
              } : {}}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {/* ...removed duplicate Featured Curated Lists section... */}

      {/* Main Content Sections - change based on active tab */}
      <section className="relative w-full px-4 pb-8 z-20">
        {activeTab === "All" && (
          <>
            {/* Featured Curated Lists (Top 3) with images from backend */}
            <div className="w-full max-w-4xl mx-auto mt-2 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
              {loading ? (
                <div className="text-center col-span-3">Loading...</div>
              ) : picks.length > 0 ? (
                picks.slice(0, 3).map((pick, idx) => (
                  <div key={pick._id || idx} className="bg-[#232526] rounded-xl shadow-xl overflow-hidden group cursor-pointer hover:scale-105 transition-transform duration-200 flex flex-col relative">
                    <div className="h-44 w-full bg-gray-800 flex items-center justify-center relative">
                      <img src={pick.image || collageBg} alt={pick.title} className="h-full w-full object-cover group-hover:opacity-90 transition z-10 relative" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10 z-30" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between z-40 relative">
                      <h3 className="text-lg font-bold text-cyan-200 mb-1 font-playfair tracking-tight line-clamp-2">{pick.title}</h3>
                      <p className="text-xs text-cyan-100 mb-1 font-poppins line-clamp-2">{pick.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center col-span-3">No picks found.</div>
              )}
            </div>
            {/* Editor's Choice */}
            <div className="max-w-4xl mx-auto mb-8">
              <h2 className="text-xl font-bold text-cyan-100 mb-3 font-playfair">Editor’s Choice</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {editorsChoice.length > 0 ? (
                  editorsChoice.map((pick, idx) => (
                    <div key={pick._id || idx} className="bg-[#232526] rounded-lg p-4 flex flex-col items-center">
                      <img src={pick.image || collageBg} alt={pick.title} className="h-32 w-full object-cover rounded mb-2" />
                      <div className="font-bold text-cyan-200">{pick.title}</div>
                      <div className="text-xs text-cyan-100">{pick.description}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center col-span-3">No editor's picks found.</div>
                )}
              </div>
            </div>
            {/* User-Voted Lists */}
            <div className="max-w-4xl mx-auto mb-8">
              <h2 className="text-xl font-bold text-cyan-100 mb-3 font-playfair">User-Voted Lists</h2>
              <div className="flex gap-2 mb-2">
                <button className="px-3 py-1 rounded-full bg-cyan-800 text-white text-xs font-semibold">Most Voted</button>
                <button className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Trending</button>
                <button className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Newest</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {communityLists.length > 0 ? (
                  communityLists.map((list, idx) => (
                    <div key={list._id || idx} className="bg-[#232526] rounded-lg p-4 flex flex-col items-center">
                      <div className="h-32 w-full bg-gray-700 rounded mb-2" />
                      <div className="font-bold text-cyan-200">{list.title}</div>
                      <div className="text-xs text-cyan-100">{list.description}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-center col-span-3">No community lists found.</div>
                )}
              </div>
            </div>
            {/* Filters (placeholder) */}
            <div className="max-w-4xl mx-auto mb-8 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Decade</span>
              <span className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Genre</span>
              <span className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Visual Style</span>
              <span className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Mood</span>
              <span className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Country</span>
            </div>
            {/* CTA Button */}
            <div className="max-w-4xl mx-auto text-center">
              <button className="px-6 py-2 rounded-full bg-cyan-700 text-white font-bold shadow hover:bg-cyan-800 transition">Create Your Own Cinematic Pick List</button>
            </div>
          </>
        )}

        {/* Editor's Choice Tab */}
        {activeTab === "Editor's Choice" && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            {/* Example cards, replace with real data */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
                <div className="h-32 w-full bg-gray-700 rounded mb-2" />
                <div className="font-bold text-cyan-200 mb-1">Noir Vibes</div>
                <div className="text-xs text-cyan-100 mb-1">Shadowy tales and moody visuals.</div>
                <div className="flex gap-1 flex-wrap mb-1"><span className="px-2 py-0.5 rounded bg-cyan-900 text-xs">Noir</span></div>
                <div className="text-xs text-cyan-300">6 Films</div>
              </div>
            ))}
          </div>
        )}

        {/* Visual Themes Tab */}
        {activeTab === "Visual Themes" && (
          <div className="max-w-4xl mx-auto mt-8">
            <div className="flex gap-2 mb-4">
              <button className="px-3 py-1 rounded-full bg-cyan-800 text-white text-xs font-semibold">Color</button>
              <button className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Camera Work</button>
              <button className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Aspect Ratios</button>
              <button className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Set Design</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
                <div className="h-32 w-full bg-gray-700 rounded mb-2" />
                <div className="font-bold text-cyan-200 mb-1">Neon Noir Nights</div>
                <div className="text-xs text-cyan-100 mb-1">Electric colors and moody cityscapes.</div>
              </div>
              <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
                <div className="h-32 w-full bg-gray-700 rounded mb-2" />
                <div className="font-bold text-cyan-200 mb-1">Desaturated Aesthetics</div>
                <div className="text-xs text-cyan-100 mb-1">Muted palettes, deep emotion.</div>
              </div>
              <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
                <div className="h-32 w-full bg-gray-700 rounded mb-2" />
                <div className="font-bold text-cyan-200 mb-1">Symmetry & Silence</div>
                <div className="text-xs text-cyan-100 mb-1">Perfectly composed, quietly powerful.</div>
              </div>
            </div>
          </div>
        )}

        {/* Decade Picks Tab */}
        {activeTab === "Decade Picks" && (
          <div className="max-w-4xl mx-auto mt-8">
            <div className="flex gap-2 mb-4 flex-wrap">
              {["60s","70s","80s","90s","2000s","2010s","2020s"].map(decade => (
                <span key={decade} className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">{decade}</span>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Example cards per decade */}
              <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
                <div className="h-32 w-full bg-gray-700 rounded mb-2" />
                <div className="font-bold text-cyan-200 mb-1">90s Standouts</div>
                <div className="text-xs text-cyan-100 mb-1">Defining films of the 1990s.</div>
              </div>
              <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
                <div className="h-32 w-full bg-gray-700 rounded mb-2" />
                <div className="font-bold text-cyan-200 mb-1">2000s Visuals</div>
                <div className="text-xs text-cyan-100 mb-1">A new millennium of style.</div>
              </div>
            </div>
          </div>
        )}

        {/* Community Lists Tab */}
        {activeTab === "Community Lists" && (
          <div className="max-w-4xl mx-auto mt-8">
            <div className="flex gap-2 mb-4">
              <button className="px-3 py-1 rounded-full bg-cyan-800 text-white text-xs font-semibold">Trending</button>
              <button className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Most Voted</button>
              <button className="px-3 py-1 rounded-full bg-[#181c24] text-cyan-200 text-xs font-semibold">Newest</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Example community lists */}
              <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
                <div className="h-10 w-10 bg-gray-700 rounded-full mb-2" />
                <div className="font-bold text-cyan-200 mb-1">User123’s List</div>
                <div className="text-xs text-cyan-100 mb-1">12 Films</div>
                <div className="flex gap-1"><span className="text-cyan-400">♥ 24</span></div>
              </div>
              <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
                <div className="h-10 w-10 bg-gray-700 rounded-full mb-2" />
                <div className="font-bold text-cyan-200 mb-1">CineFan’s Picks</div>
                <div className="text-xs text-cyan-100 mb-1">8 Films</div>
                <div className="flex gap-1"><span className="text-cyan-400">♥ 10</span></div>
              </div>
            </div>
            <div className="text-center mt-6">
              <button className="px-6 py-2 rounded-full bg-cyan-700 text-white font-bold shadow hover:bg-cyan-800 transition">Create Your Own List</button>
            </div>
          </div>
        )}

        {/* Director Spotlights Tab */}
        {activeTab === "Director Spotlights" && (
          <div className="max-w-4xl mx-auto mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Example director cards */}
            <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
              <div className="h-20 w-20 bg-gray-700 rounded-full mb-2" />
              <div className="font-bold text-cyan-200 mb-1">Kubrick’s Geometry</div>
              <div className="text-xs text-cyan-100 mb-1">“If it can be written, or thought, it can be filmed.”</div>
              <div className="text-xs text-cyan-300">12 Films</div>
            </div>
            <div className="bg-[#232526] rounded-xl p-4 flex flex-col items-center">
              <div className="h-20 w-20 bg-gray-700 rounded-full mb-2" />
              <div className="font-bold text-cyan-200 mb-1">Wes Anderson’s Whimsy</div>
              <div className="text-xs text-cyan-100 mb-1">“Whimsy is a serious thing.”</div>
              <div className="text-xs text-cyan-300">9 Films</div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
