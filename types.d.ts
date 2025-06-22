// src/types.d.ts

export interface VideoResult {
  type: string;
  site: string;
  key: string;
}

export interface CrewMember {
  job: string;
  known_for_department: string;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface ReleaseDate {
  iso_3166_1: string;
  release_dates: Array<{ certification: string }>;
}

export interface Genre {
  name: string;
}

export interface TmdbMovieResponse {
  id: number;
  title: string;
  overview: string;
  vote_average: number;
  release_date: string;
  runtime: number;
  revenue: number;
  budget: number;
  poster_path: string | null;
  backdrop_path: string | null;
  videos?: {
    results: VideoResult[];
  };
  credits?: {
    crew: CrewMember[];
    cast: CastMember[];
  };
  genres?: Genre[];
  release_dates?: {
    results: ReleaseDate[];
  };
  status?: string;
}

export interface MovieDetail {
  id: number;
  title: string;
  overview: string;
  rating: number;
  releaseDate: string | null;
  runtime: string;
  revenue: string;
  budget: string;
  poster_path: string;
  backdrop_path: string | null;
  trailer: string | null;
  director: string;
  cast: Array<{
    id: number;
    name: string;
    character: string;
    profile_path: string;
  }>;
  genres: string[];
  certification: string;
  status: string;
}