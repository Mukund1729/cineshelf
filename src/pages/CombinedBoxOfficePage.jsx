import React, { useState } from 'react';
import BoxOfficePage from './BoxOfficePage';
import PersonBoxOfficeSearchPage from './PersonBoxOfficeSearchPage';
import BrandLogo from '../components/BrandLogo';

export default function CombinedBoxOfficePage() {
  const [tab, setTab] = useState('year');
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#181c24] to-[#1a1333] text-white font-lato relative overflow-x-hidden">
      {/* Header with the site logo */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center w-full px-6 py-4 bg-gradient-to-b from-black/80 via-[#181c24]/60 to-transparent backdrop-blur-md">
        <BrandLogo style={{ width: 175 }} />
      </div>
      <div className="pt-28 pb-4 max-w-5xl mx-auto">
        <div className="flex justify-center gap-4 mb-8">
          <button
            className={`px-6 py-2 rounded-full font-semibold text-base transition-all ${tab === 'year' ? 'bg-cyan-400 text-black shadow' : 'bg-[#232526] text-cyan-200 hover:bg-cyan-700 hover:text-white'}`}
            onClick={() => setTab('year')}
          >
            Box Office by Year
          </button>
          <button
            className={`px-6 py-2 rounded-full font-semibold text-base transition-all ${tab === 'person' ? 'bg-cyan-400 text-black shadow' : 'bg-[#232526] text-cyan-200 hover:bg-cyan-700 hover:text-white'}`}
            onClick={() => setTab('person')}
          >
            Box Office by Person
          </button>
        </div>
        <div className="mt-2">
          {tab === 'year' ? <BoxOfficePage /> : <PersonBoxOfficeSearchPage />}
        </div>
      </div>
    </div>
  );
}
