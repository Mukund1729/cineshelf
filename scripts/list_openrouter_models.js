// Script to list all enabled OpenRouter models for your API key
import dotenv from "dotenv";
dotenv.config();

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function listModels() {
  const res = await fetch("https://openrouter.ai/api/v1/models", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json"
    }
  });
  const data = await res.json();
  console.log("Enabled OpenRouter models:");
  console.log(data.data.map(m => m.id));
}

listModels();
