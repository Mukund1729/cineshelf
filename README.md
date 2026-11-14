# 🎬 Visual.Cineaste - Cinematic Discovery Platform

A modern, cinematic movie discovery platform built with React, Node.js, and MongoDB. Discover films by vision, director, style — not just genre.

## ✨ Features

### 🎯 Core Features
- **Movie Discovery**: Browse trending, popular, and curated films
- **AI-Powered Recommendations**: Get personalized movie suggestions
- **Watchlist Management**: Save and organize movies you want to watch
- **Review System**: Rate and review your favorite films
- **Custom Lists**: Create and share themed movie collections
- **Box Office Tracking**: Monitor movie performance and revenue data

### 🎨 Cinematic Features
- **Cinematic Picks**: Curated collections by editors and community
- **Visual Themes**: Discover films by cinematography and style
- **Director Spotlights**: Explore filmmaker catalogs
- **Genre Discovery**: Find films beyond traditional categories

### 👤 User Features
- **User Authentication**: Secure login/signup system
- **Profile Management**: Customize your profile and preferences
- **Social Features**: Connect with other cinephiles
- **Data Export**: Export your watchlist, reviews, and lists
- **Notification System**: Stay updated with new features

### 🏢 Admin Features
- **User Management**: Admin panel for user oversight
- **Content Curation**: Manage cinematic picks and featured content
- **System Analytics**: Monitor platform usage and performance

## 🚀 Quick Start

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- TMDB API read access token

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cineshelf
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Database
   MONGO_URI=mongodb://localhost:27017/cineshelf
   
   # JWT Secret
   JWT_SECRET=your-super-secret-jwt-key
   
   # TMDB read access token (server only; never use a VITE_ prefix)
   TMDB_READ_ACCESS_TOKEN=your-tmdb-read-access-token

   # Allowed frontend origins
   CORS_ORIGINS=http://localhost:5173,http://localhost:5174

   # Leave blank for local Vite proxy; use the Render API origin in production
   VITE_API_BASE_URL=
   
   # OpenRouter API (for AI features)
   OPENROUTER_API_KEY=your-openrouter-api-key
   OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
   
   # Server Port
   PORT=5000
   ```

4. **Start the application**

   **Option 1: Run both frontend and backend together**
   ```bash
   npm run dev:full
   ```

   **Option 2: Run separately**
   ```bash
   # Terminal 1 - Backend
   npm run server
   
   # Terminal 2 - Frontend
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5174
   - Backend API: http://localhost:5000

## ☁️ Deployment (Vercel + Render)

The frontend is a Vite SPA deployed to Vercel; the Express API and MongoDB remain separate services. `vercel.json` configures the Vite build and client-side routes, while `render.yaml` describes the Node API service.

1. Create a MongoDB Atlas database and allow connections from your API host.
2. Import this repository into Render and create the service from `render.yaml`. Set `MONGO_URI`, a strong random `JWT_SECRET`, and `TMDB_READ_ACCESS_TOKEN` in the Render dashboard. Set `CORS_ORIGINS` to the exact comma-separated frontend origins. `OPENROUTER_API_KEY` remains a server-side setting for AI features.
3. Import the same repository into Vercel. Set `VITE_API_BASE_URL` to the Render service origin (for example `https://cineshelf-api.onrender.com`, without a trailing slash). Do not set or expose a TMDB credential in Vercel. Add the API URL to Production and Preview environments as needed, then redeploy.
4. Verify `/health`, `/api/tmdb/movie/popular`, and a `/api/tmdb/image/w500/<poster-filename>` URL on Render, then test data and image loading from Vercel.

All browser TMDB requests use the Express proxy. The server sends `TMDB_READ_ACCESS_TOKEN` as a Bearer token to fixed TMDB API/image origins, validates endpoint/query parameters, and applies request limits. API responses use a bounded in-memory cache and in-flight request deduplication (per server process); image responses use long-lived cache headers. For multi-instance scale, put a CDN in front of the image route or add a shared cache rather than relying on per-process memory.

Vercel Hobby is limited by Vercel's terms to personal or non-commercial use. Its `*.vercel.app` address is included; a `.in` or `.com` custom domain can be connected, but the domain registration itself is paid separately. Add the domain under Vercel Project Settings → Domains and follow the DNS records shown there.

The Render free web service may sleep when idle. Existing user avatars are stored as MongoDB binary data (not Base64); friend chat messages are stored separately and are not TTL-deleted. Chat retrieval uses cursor pagination. The 3D seat map and payment flow are demo-only; bookings are stored in the user's browser, not in a production booking/payment system.

## Box Office ingestion and MongoDB storage

The existing `/boxoffice` page uses source-attributed data only. The API automatically polls the Indian Box Office RSS on startup and every few hours; this runs inside the existing API service and does not require a separate Render worker. It provides selected daily briefs and lifetime India-nett/worldwide-gross reports, not a complete daily chart or full historical day-wise dataset. Those figures are publisher estimates. Box Office History is queried on demand for documented US daily charts, TMDB-ID lookup, US weekend history, and US opening records. It is not an India-nett provider. Other providers are not enabled unless their API access and reuse permissions can be verified.

The scheduler interval defaults to four hours and can be set from 3 to 6 hours with `BOX_OFFICE_SYNC_INTERVAL_HOURS`. The MongoDB sync lease prevents overlapping imports across API instances or an optional standalone worker. If you need a separate process instead of the API scheduler, run:

```bash
npm run server
npm run worker:boxoffice
```

`BOX_OFFICE_SYNC_INTERVAL_HOURS` defaults to 4 and must be between 3 and 6. The worker retries provider requests and records its last successful synchronization. Older US/movie history is fetched only when requested and cached for `BOX_OFFICE_CACHE_TTL_SECONDS` (default 24 hours). RSS reports expire after `BOX_OFFICE_REPORT_TTL_DAYS` (default 30 days); report counts are capped by `BOX_OFFICE_MAX_DAILY_REPORTS` and `BOX_OFFICE_MAX_LIFETIME_REPORTS`. Missing dates and unavailable figures are never synthesized. TMDB matching uses the server-only `TMDB_READ_ACCESS_TOKEN`; unmatched or ambiguous titles remain unmatched.

Available endpoints include:

- `GET /api/boxoffice/overview`
- `GET /api/boxoffice/daily?date=YYYY-MM-DD&market=india|us`
- `GET /api/boxoffice/india?date=YYYY-MM-DD&period=daily|weekly|monthly`
- `GET /api/boxoffice/worldwide?date=YYYY-MM-DD`
- `GET /api/boxoffice/weekly?date=YYYY-MM-DD`
- `GET /api/boxoffice/yearly?year=YYYY`
- `GET /api/boxoffice/records`
- `GET /api/boxoffice/movie/:tmdbId`
- `GET /api/boxoffice/movie/:tmdbId/history`
- `GET /api/boxoffice/sources`
- `GET /api/boxoffice/last-updated`

Only Box Office reports/cache use TTL indexes. Permanent users, reviews, watchlists, and chat messages do not. MongoDB storage checks use `dbStats`; the API logs threshold warnings at 60%, 75%, 85%, and 90% of `MONGO_STORAGE_LIMIT_BYTES` (default 512 MiB). `MONGO_STORAGE_BLOCK_AT_PERCENT` (default 85) pauses non-essential Box Office cache writes only. Admins can read the current snapshot at `GET /api/admin/storage`.

### Encrypted S3-compatible backups

MongoDB backups are encrypted locally with AES-256-GCM before upload. The backup process requires MongoDB Database Tools (`mongodump`) and AWS CLI v2. Configure `MONGO_URI`, `S3_BUCKET`, `S3_PREFIX`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_DEFAULT_REGION`, and a 32-byte Base64 `BACKUP_ENCRYPTION_KEY`; set `S3_ENDPOINT_URL` for R2/B2/other compatible services. Keep all credentials and the encryption key in the deployment secret store, not in source control.

Run a one-time backup with `npm run backup:mongodb`. Run `npm run worker:backups` as a separate always-on process for daily backups; failures retry after one hour. `BACKUP_RETENTION_DAYS` defaults to 30 and applies only to backup objects. Protect the encryption key separately from the bucket; the project cannot restore encrypted backups without it.

## 📁 Project Structure

```
cineshelf/
├── src/                    # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Page components
│   ├── api/               # API integration
│   └── hooks/             # Custom React hooks
├── controllers/           # Backend route controllers
├── models/               # MongoDB schemas
├── routes/               # Express.js routes
├── middleware/           # Custom middleware
├── server.js             # Main server file
└── package.json          # Dependencies and scripts
```

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update profile
- `GET /api/user/preferences` - Get user preferences
- `PUT /api/user/preferences` - Update preferences

### Content Management
- `GET /api/watchlist` - Get user watchlist
- `POST /api/watchlist` - Add to watchlist
- `GET /api/review` - Get user reviews
- `POST /api/review` - Add review
- `GET /api/list` - Get user lists
- `POST /api/list` - Create list

### Box Office
- `GET /api/boxoffice/year/:year` - Box office by year
- `GET /api/boxoffice/person/:personId` - Box office by person
- `GET /api/boxoffice/india` - India box office data

### Cinematic Picks
- `GET /api/picks` - Get all picks
- `GET /api/picks/type/:type` - Get picks by type
- `GET /api/picks/community` - Get community lists

### Notifications
- `GET /api/notifications` - Get user notifications
- `PUT /api/notifications/:id/read` - Mark as read

### Data Export
- `GET /api/export/all` - Export all user data
- `GET /api/export/watchlist` - Export watchlist

### Admin (Protected)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/stats` - System statistics

## 🎨 UI/UX Features

- **Dark Theme**: Cinematic dark interface
- **Responsive Design**: Works on all devices
- **Glassmorphism**: Modern glass-like UI elements
- **Smooth Animations**: Framer Motion powered transitions
- **Infinite Scroll**: Seamless content loading
- **Search & Filter**: Advanced movie discovery

## 🔒 Security Features

- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt password encryption
- **Rate Limiting**: API request throttling
- **CORS Protection**: Cross-origin request security
- **Input Validation**: Server-side data validation

## 🛠️ Development

### Adding New Features
1. Create backend routes in `routes/`
2. Add controllers in `controllers/`
3. Create models in `models/` if needed
4. Build frontend components in `src/components/`
5. Add pages in `src/pages/`

### Database Schema
The application uses MongoDB with the following main collections:
- `users` - User accounts and preferences
- `watchlists` - User movie watchlists
- `reviews` - User movie reviews
- `lists` - Custom movie lists
- `picks` - Curated cinematic picks
- `notifications` - User notifications

## 🚀 Deployment

### Backend Deployment
1. Set up MongoDB Atlas or local MongoDB
2. Configure environment variables
3. Deploy to Heroku, Vercel, or your preferred platform

### Frontend Deployment
1. Build the application: `npm run build`
2. Deploy the `dist` folder to Netlify, Vercel, or your preferred platform

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **TMDB**: Movie data and images
- **OpenRouter**: AI-powered recommendations
- **React & Node.js**: Core technologies
- **Tailwind CSS**: Styling framework

---

**Made with ❤️ for cinephiles everywhere** 