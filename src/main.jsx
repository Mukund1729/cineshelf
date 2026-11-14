import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import axios from 'axios';
import { API_BASE_URL } from './api/config';
import App from './App';
import './index.css';
import './LoadFonts';

// Configure axios base URL for API calls
axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true;

axios.interceptors.response.use(response => {
  const headers = response.config?.headers;
  const authorization = headers?.Authorization || headers?.authorization;
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    localStorage.removeItem('token');
  }
  return response;
}, async error => {
  const config = error.config;
  const requestUrl = config?.url || '';
  const isBackendApi = /^\/?api\//.test(requestUrl)
    || Boolean(API_BASE_URL && requestUrl.startsWith(`${API_BASE_URL}/api/`));
  const isTransientFailure = !error.response
    || [502, 503, 504].includes(error.response.status);

  if (!config || !isBackendApi || config.method?.toLowerCase() !== 'get'
    || !isTransientFailure || (config.cineshelfRetryCount || 0) >= 3) {
    return Promise.reject(error);
  }

  const retryCount = config.cineshelfRetryCount || 0;
  config.cineshelfRetryCount = retryCount + 1;
  await new Promise(resolve => window.setTimeout(resolve, 1000 * (2 ** retryCount)));
  return axios.request(config);
});

const queryClient = new QueryClient();
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);