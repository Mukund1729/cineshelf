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
- TMDB API key

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
   
   # TMDB API
   VITE_TMDB_KEY=your-tmdb-api-key
   
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