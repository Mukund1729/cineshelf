import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ShowHeader from "../components/ShowHeader";
import TrailerEmbed from "../components/TrailerEmbed";
import MetaInfoPanel from "../components/MetaInfoPanel";
import ReviewBox from "../components/ReviewBox";
import SuggestionsCarousel from "../components/SuggestionsCarousel";
import Spinner from "../components/Spinner";
import axios from "axios";
import { API_KEY } from "../api/tmdb";

const TVDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [streaming, setStreaming] = useState([]);
  const [boxOffice, setBoxOffice] = useState(null);
  const [actorSuggestions, setActorSuggestions] = useState([]);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      setError(null);
      try {
        const [detailRes, reviewsRes, recsRes] = await Promise.all([
          axios.get(`https://api.themoviedb.org/3/tv/${id}`, {
            params: {
              api_key: API_KEY,
              language: 'en-US',
              append_to_response: 'credits,release_dates,videos,images,external_ids,content_ratings,watch/providers'
            }
          }),
          axios.get(`https://api.themoviedb.org/3/tv/${id}/reviews`, {
            params: { api_key: API_KEY, language: 'en-US' }
          }),
          axios.get(`https://api.themoviedb.org/3/tv/${id}/recommendations`, {
            params: { api_key: API_KEY, language: 'en-US' }
          })
        ]);
        const showData = detailRes.data;
        setShow(showData);
        setReviews(reviewsRes.data.results || []);
        setRecommendations(recsRes.data.results || []);
        setStreaming(showData["watch/providers"]?.results?.IN?.flatrate || []);
        // Box office and actor suggestions can be fetched here if available
      } catch (e) {
        setError("Failed to load TV show.");
        setShow(null);
      }
      setLoading(false);
    }
    fetchAll();
  }, [id]);

  if (loading) return <Spinner />;
  if (error) return <div className="text-center text-red-400 py-10">{error}</div>;
  if (!show) return <div className="text-center text-gray-400 py-10">TV show not found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-zinc-900 to-[#1a1333] text-white font-lato">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        <ShowHeader show={show} />
        <div className="my-8">
          <TrailerEmbed videos={show.videos?.results || []} title={show.name || show.title} />
        </div>
        <MetaInfoPanel show={show} streaming={streaming} boxOffice={boxOffice} />
        <div className="my-8">
          <ReviewBox reviews={reviews} showId={show.id} />
        </div>
        <div className="my-8">
          <SuggestionsCarousel title={`More from ${show.credits?.cast?.[0]?.name || "Lead Actor"}`} items={actorSuggestions} type="actor" />
        </div>
        <div className="my-8">
          <SuggestionsCarousel title="More Like This" items={recommendations} type="show" />
        </div>
      </div>
    </div>
  );
};

export default TVDetailsPage;
