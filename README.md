# Flex Living Reviews Dashboard

A comprehensive full-stack reviews management dashboard for Flex Living properties built with React and Node.js.

## Tech Stack 
### Frontend
- **React 18** - Modern component-based UI library
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Beautiful icon library
- **Axios** - HTTP client for API requests

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **Axios** - HTTP client for external APIs
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## Features

### Manager Dashboard
- Real-time review filtering by property, rating, status, and date
- Visual statistics overview with key metrics
- Approval/rejection workflow for review management
- Multi-channel support (Hostaway, Airbnb, Booking.com)
- Responsive design for all devices

### Property Display Page
- Public-facing approved reviews section
- Professional property page styling
- Star ratings and guest feedback display
- Only shows manager-approved content

### API Integration
- GET /api/reviews/hostaway endpoint implemented
- Data normalisation across review channels
- Error handling with mock data fallback
- RESTful API design with proper status codes