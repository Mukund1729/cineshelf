import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const FullFilmography = () => {
  const { id } = useParams();
  const [person, setPerson] = useState(null);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_TMDB_API_KEY;
    async function fetchFilmography() {
      setLoading(true);
      setError(null);
      try {
        const personRes = await fetch(`https://api.themoviedb.org/3/person/${id}?api_key=${apiKey}&append_to_response=combined_credits`);
        const personData = await personRes.json();
        setPerson(personData);
        // Combine cast and crew, remove duplicates by movie id
        let allMovies = [];
        if (personData.combined_credits) {
          allMovies = personData.combined_credits.cast.concat(personData.combined_credits.crew)
            .filter(m => m.media_type === 'movie' && m.id && m.release_date)
            .reduce((acc, curr) => {
              if (!acc.find(m => m.id === curr.id)) acc.push(curr);
              return acc;
            }, []);
        }
        // Sort by release date desc
        allMovies = allMovies.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
        setMovies(allMovies);
      } catch (err) {
        setError("Failed to fetch filmography.");
      } finally {
        setLoading(false);
      }
    }
    fetchFilmography();
  }, [id]);

  if (loading) return <div className="flex items-center justify-center h-64 text-cyan-400">Loading filmography...</div>;
  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="max-w-5xl mx-auto p-6 bg-[#0f1c2d] min-h-screen text-white">
      <h1 className="text-3xl font-bold mb-4">{person?.name}'s Full Filmography</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-[#181c24] rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-cyan-900/60 text-cyan-200">
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Year</th>
              <th className="px-4 py-2 text-left">Role/Job</th>
              <th className="px-4 py-2 text-left">Department</th>
            </tr>
          </thead>
          <tbody>
            {movies.map(movie => (
              <tr key={movie.id} className="border-b border-gray-700 hover:bg-cyan-900/20 transition">
                <td className="px-4 py-2">
                  <Link to={`/movie/${movie.id}`} className="text-cyan-300 hover:underline">{movie.title || movie.original_title}</Link>
                </td>
                <td className="px-4 py-2">{movie.release_date ? new Date(movie.release_date).getFullYear() : '-'}</td>
                <td className="px-4 py-2">{movie.character || movie.job || '-'}</td>
                <td className="px-4 py-2">{movie.department || movie.known_for_department || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FullFilmography;
