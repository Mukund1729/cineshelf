import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import MovieCard from '../components/MovieCard';
import SearchBar from '../components/SearchBar';
import { fetchMovies } from '../api/tmdb';

export default function HomePage() {
  const [searchRef, inView] = useInView();
  const { data, fetchNextPage, isFetching } = useInfiniteQuery(
    ['movies'],
    fetchMovies,
    {
      getNextPageParam: (lastPage) => lastPage.page + 1,
    }
  );

  useEffect(() => {
    if (inView) fetchNextPage();
  }, [inView]);

  return (
    <>
      <SearchBar />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6 p-4">
        {data?.pages.map(page => 
          page.results.map(movie => (
            <MovieCard key={movie.id} {...movie} />
          ))
        )}
      </div>
      <div ref={searchRef} className="h-10" />
      {isFetching && <LoadingSpinner />}
    </>
  );
}