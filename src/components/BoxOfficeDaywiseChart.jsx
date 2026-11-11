import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function formatINR(num) {
  if (!num || isNaN(num)) return '₹0';
  return '₹' + (num / 10000000).toFixed(1) + 'Cr';
}

function formatUSD(num) {
  if (!num || isNaN(num)) return '$0';
  return '$' + (num / 1000000).toFixed(1) + 'M';
}

export default function BoxOfficeDaywiseChart({ movieData, currency = 'INR' }) {
  const [currencyMode, setCurrencyMode] = useState(currency);

  if (!movieData || !movieData.daywise_data) {
    return (
      <div className="bg-[#181c24] rounded-xl p-6 text-center text-gray-400">
        No daywise data available for this movie.
      </div>
    );
  }

  const chartData = movieData.daywise_data.map(day => ({
    day: `Day ${day.day}`,
    date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: currencyMode === 'INR' ? day.revenue_inr : day.revenue_usd,
    formattedRevenue: currencyMode === 'INR' ? formatINR(day.revenue_inr) : formatUSD(day.revenue_usd)
  }));

  const totalRevenue = currencyMode === 'INR' 
    ? formatINR(movieData.total_revenue_inr)
    : formatUSD(movieData.total_revenue_usd);

  return (
    <div className="bg-[#181c24] rounded-xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-xl font-bold text-white mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
            {movieData.title}
          </h3>
          <p className="text-gray-400 text-sm">
            {movieData.year} • {movieData.language.toUpperCase()} • Total: {totalRevenue}
          </p>
        </div>
        <button
          onClick={() => setCurrencyMode(currencyMode === 'INR' ? 'USD' : 'INR')}
          className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-sm transition-all"
        >
          Show in {currencyMode === 'INR' ? 'USD' : 'INR'}
        </button>
      </div>

      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
            <XAxis 
              dataKey="day" 
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis 
              stroke="#94a3b8"
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              tickFormatter={(value) => currencyMode === 'INR' ? `${(value / 10000000).toFixed(0)}Cr` : `${(value / 1000000).toFixed(0)}M`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a202c', 
                border: '1px solid #2d3748', 
                borderRadius: '8px',
                color: '#fff'
              }}
              formatter={(value) => [currencyMode === 'INR' ? formatINR(value) : formatUSD(value), 'Revenue']}
              labelFormatter={(label) => {
                const dataPoint = chartData.find(d => d.day === label);
                return dataPoint ? `${label} (${dataPoint.date})` : label;
              }}
            />
            <Legend 
              wrapperStyle={{ color: '#94a3b8' }}
            />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#06b6d4" 
              strokeWidth={2}
              dot={{ fill: '#06b6d4', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="Daily Revenue"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Daywise Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Day</th>
              <th className="px-4 py-2 text-left text-gray-300 font-semibold">Date</th>
              <th className="px-4 py-2 text-right text-gray-300 font-semibold">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {movieData.daywise_data.map((day, idx) => (
              <tr key={idx} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                <td className="px-4 py-2 text-cyan-300 font-medium">Day {day.day}</td>
                <td className="px-4 py-2 text-gray-400">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                <td className="px-4 py-2 text-right font-bold text-green-400">
                  {currencyMode === 'INR' ? formatINR(day.revenue_inr) : formatUSD(day.revenue_usd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
