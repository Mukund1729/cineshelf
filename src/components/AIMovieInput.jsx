import React, { useState, useEffect } from "react";

const AIMovieInput = ({ onResults }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log("Prompt updated:", prompt);
  }, [prompt]);

  const handleFind = async () => {
    console.log("Submitted Prompt:", prompt);
    if (!prompt.trim()) {
      alert("Prompt is required");
      return;
    }

    setLoading(true);

    const apiPrompt = `
You are an intelligent film recommendation assistant for a cinephile-focused platform. 
When given a user's natural-language description of what they want to watch, suggest 5 movies that match the mood, theme, or style.  

For each movie include:
- Title  
- Director  
- Year  
- 1-2 sentence description  
- 3 mood tags (e.g., “Melancholic”, “Rebellious”, “Dreamlike”)  
- 2 visual style tags (e.g., “Minimalism”, “Neo-noir”)

Only respond with a clean JSON array. Be artistic and emotionally precise.

User prompt: "${prompt}"
`;

    try {
      const res = await fetch("/api/gpt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: apiPrompt }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`API error: ${res.status} - ${errorText}`);
      }
      const data = await res.json();
      if (!data.reply) throw new Error("No reply from AI");
      const parsed = JSON.parse(data.reply);
      onResults(parsed);
    } catch (err) {
      console.error("AI fetch or parse error:", err);
      onResults([]);
      alert("Sorry, there was a problem getting recommendations. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-4 mt-4">
      <input
        type="text"
        className="w-full bg-gray-800 text-white p-3 rounded-xl"
        placeholder="Describe a film you're in the mood for..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        onClick={handleFind}
        className="bg-cyan-500 px-4 py-2 rounded-xl hover:bg-cyan-600"
        disabled={loading}
      >
        {loading ? "Finding..." : "Find 🎥"}
      </button>
    </div>
  );
};

export default AIMovieInput;
