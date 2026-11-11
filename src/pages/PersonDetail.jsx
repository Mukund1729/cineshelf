import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PersonDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchPerson() {
      setLoading(true);
      setError(null);
      try {
        const apiKey = import.meta.env.VITE_TMDB_API_KEY;
        const res = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${apiKey}&append_to_response=movie_credits,images`);
        if (!res.ok) throw new Error('Failed to fetch person details');
        const data = await res.json();
        setPerson(data);
      } catch (err) {
        setError('Could not load person details.');
      } finally {
        setLoading(false);
      }
    }
    fetchPerson();
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="text-center text-red-400 py-12">{error}</div>;
  if (!person) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-[#181c24] to-[#1a1333] text-white font-lato relative overflow-x-hidden">
      {/* Header Row (no logo, homepage style) */}
      <div className="fixed top-0 left-0 right-0 z-30 flex items-center w-full px-6 py-4 bg-gradient-to-b from-black/80 via-[#181c24]/60 to-transparent backdrop-blur-md">
        <Link to="/" className="text-xl md:text-2xl font-bold font-playfair text-cyan-300 tracking-wide select-none hover:underline transition-all">
          visual.cineaste
        </Link>
        <span className="ml-4 text-base md:text-lg font-semibold text-gray-300 tracking-wide select-none">Person Details</span>
      </div>
      <div className="pt-24 pb-16 container mx-auto px-4">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <img
            src={person.profile_path ? `https://image.tmdb.org/t/p/w400${person.profile_path}` : '/actor-placeholder.jpg'}
            alt={person.name}
            className="rounded-2xl shadow-2xl w-[120px] md:w-[180px] object-cover aspect-[2/3] border-2 border-[#232526] bg-[#181c24]"
          />
          <div className="flex-1">
            <h2 className="text-2xl md:text-3xl font-bold mb-1 font-playfair text-cyan-200">{person.name}</h2>
            <p className="text-cyan-400 mb-1 text-sm md:text-base italic">{person.known_for_department}</p>
            <div className="mb-2 text-gray-300 text-sm md:text-base">
              <span className="font-semibold text-cyan-300">Birthday:</span> {person.birthday || 'N/A'}
              {person.place_of_birth && <span className="ml-4 font-semibold text-cyan-300">Place:</span>} {person.place_of_birth || ''}
            </div>
            {person.homepage && (
              <a href={person.homepage} target="_blank" rel="noopener noreferrer" className="text-pink-300 underline hover:text-pink-400 text-sm md:text-base">Official Website</a>
            )}
            <p className="mt-3 mb-4 text-gray-200 text-sm md:text-base line-clamp-5">{person.biography || 'No biography available.'}</p>
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2 text-cyan-200">Known For</h3>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-cyan-900 scrollbar-track-transparent">
                {person.movie_credits?.cast?.slice(0, 10).map(movie => (
                  <Link to={`/movie/${movie.id}`} key={movie.id} className="block min-w-[90px] max-w-[90px]">
                    <img
                      src={movie.poster_path ? `https://image.tmdb.org/t/p/w200${movie.poster_path}` : '/placeholder.jpg'}
                      alt={movie.title}
                      className="rounded-lg shadow w-full aspect-[2/3] object-cover border border-[#232526] bg-[#181c24]"
                    />
                    <span className="block text-xs text-center text-gray-200 line-clamp-2 mt-1">{movie.title}</span>
                  </Link>
                ))}
              </div>
            </div>
            {/* Filmography and Box Office Section */}
            <div className="mt-10 flex flex-col md:flex-row gap-4">
              <div>
                <h3 className="text-base font-semibold mb-2 text-cyan-200">Full Filmography</h3>
                <Link
                  to={`/person/${id}/filmography`}
                  className="inline-block px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold shadow transition mt-2 text-sm"
                >
                  View Full Filmography
                </Link>
              </div>
              <div>
                <h3 className="text-base font-semibold mb-2 text-cyan-200">Box Office Collection</h3>
                <Link
                  to={`/person/${id}/boxoffice`}
                  className="inline-block px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-lg font-semibold shadow transition mt-2 text-sm"
                >
                  View Box Office Collection
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="bg-gray-800 py-2 w-full fixed bottom-0 left-0 z-50">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs text-gray-400 font-lato">© {new Date().getFullYear()} visual.cineaste. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
