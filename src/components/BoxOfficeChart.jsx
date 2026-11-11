import React from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const BoxOfficeChart = ({ data }) => {
  // Defensive: always work with an array
  let formatted = [];
  try {
    if (Array.isArray(data)) {
      formatted = data
        .filter(d => d && d.date && d.amount && !isNaN(parseFloat(d.amount)))
        .map(d => ({
          date: d.date,
          amount: parseFloat(d.amount),
        }));
    }
  } catch (e) {
    console.error('Error formatting box office data:', e, data);
    return <div className="text-red-400 italic">Box office data error.</div>;
  }

  if (!formatted.length) {
    return <div className="text-gray-400 italic">No box office data available.</div>;
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#232526] via-[#414345] to-[#181818] p-4 shadow-lg">
      <h3 className="text-lg font-bold mb-2 text-gradient bg-gradient-to-r from-yellow-400 via-pink-400 to-cyan-400 bg-clip-text text-transparent">Box Office Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="date" tick={{ fill: '#fff' }} axisLine={{ stroke: '#8884d8' }} />
          <YAxis tick={{ fill: '#fff' }} axisLine={{ stroke: '#8884d8' }} />
          <Tooltip contentStyle={{ background: '#232526', border: '1px solid #ffd200', color: '#fff' }} labelStyle={{ color: '#ffd200' }} />
          <Line type="monotone" dataKey="amount" stroke="#ffd200" strokeWidth={3} dot={{ r: 4, fill: '#00ffcc' }} activeDot={{ r: 6, fill: '#ff4ecd' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BoxOfficeChart;
