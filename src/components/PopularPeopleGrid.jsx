import React, { useEffect, useState } from 'react';
import { getPopularPeople } from '../api/tmdb';
import LoadingSpinner from './LoadingSpinner';

export default function PopularPeopleGrid() {
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getPopularPeople()
      .then(setPeople)
      .catch(() => setError('Failed to load popular people.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-red-500 text-center py-4">{error}</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <h2 className="text-3xl font-bold mb-6 text-gradient bg-gradient-to-r from-yellow-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">Popular People</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {people.map(person => (
          <div key={person.id} className="flex flex-col items-center bg-gradient-to-br from-[#232526] via-[#414345] to-[#181818] rounded-xl shadow-lg p-4">
            <img
              src={person.profile_path ? person.profile_path : '/placeholder-person.jpg'}
              alt={person.name}
              className="w-24 h-24 object-cover rounded-full mb-2 border-4 border-yellow-400 shadow-md bg-white"
              loading="lazy"
              onError={e => { e.target.onerror = null; e.target.src = '/placeholder-person.jpg'; }}
            />
            <div className="font-semibold text-center text-white text-lg mb-1 drop-shadow">{person.name}</div>
            <div className="text-xs text-pink-300 text-center mb-1 font-medium">{person.known_for}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
