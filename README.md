# Niagara Cloud APIs Dashboard

A real-time dashboard application for monitoring and visualizing data from Niagara Cloud IoT systems. This project provides live monitoring of various building metrics including energy performance, water usage, occupancy, and indoor air quality.

## Features

- **Real-time Data Streaming**: Server-Sent Events (SSE) for live data updates
- **Multiple Dashboards**: 
  - Main dashboard with comprehensive building metrics
  - Cloud demo dashboard with tagged point monitoring
- **Visualizations**:
  - Energy Performance Indicators (EPI) with donut charts
  - Water usage tracking (Domestic & Flushing)
  - Occupancy monitoring
  - Indoor Air Quality (IAQ) metrics
  - Historical power consumption data with line charts
- **Optimized Performance**: 
  - Token caching for API authentication
  - Background data refresh
  - HTTP compression
  - Connection pooling with persistent HTTPS agents

## Prerequisites

- Node.js (v14 or higher recommended)
- npm (Node Package Manager)
- Access to Niagara Cloud API credentials

## Installation

1. Clone the repository:
```bash
git clone https://github.com/KED-Technology/Niagara_Cloud_Apis.git
cd Niagara_Cloud_Apis
```

2. Install dependencies:
```bash
npm install
```

3. Create and configure the `dashboard.env` file in the root directory:
```env
CLIENT_ID=your_client_id
CLIENT_SECRET=your_client_secret
CUSTOMER_ID=your_customer_id
SYSTEM_GUID=your_system_guid
PING_TOKEN_URL=your_ping_token_url
```

## Usage

### Development Mode

Run the application with auto-reload on file changes:
```bash
npm run dev
```

### Production Mode

Start the server:
```bash
npm start
```

The server will start on `http://localhost:3000`

## Available Endpoints

### Web Pages

- `GET /dashboard` - Main dashboard with comprehensive building metrics
- `GET /dash` - Cloud demo dashboard with tagged point data

### API Endpoints

#### Data Endpoints
- `GET /dashboard-data` - Fetch all dashboard data (cached, refreshed every 10 seconds)
- `GET /api/telemetry/:cloudId` - Fetch today's telemetry data for a specific cloud ID
- `GET /api/stream` - Server-Sent Events stream for tagged points (query param: `tag`)

#### SSE Streaming Endpoints
- `GET /api/stream-points` - Real-time scope points data
- `GET /api/stream-water` - Real-time water usage data
- `GET /api/stream-occupancy` - Real-time occupancy data
- `GET /api/stream-iaq` - Real-time indoor air quality data
- `GET /api/stream-epi` - Real-time energy performance indicators

## Project Structure

```
.
├── server.js              # Main Express server with API routes
├── scripting.js           # Alternative server implementation
├── package.json           # Project dependencies and scripts
├── dashboard.env          # Environment variables (not in repo)
├── views/                 # EJS templates and HTML files
│   ├── dashboard.ejs
│   ├── index.html
│   └── ...
├── testing/               # Test HTML files
│   └── clouddemo.html
└── public/                # Static assets (CSS, JS, images, fonts)
    ├── css/
    ├── js/
    ├── Img/
    └── fonts/
```

## Technology Stack

- **Backend**: Node.js, Express.js
- **Template Engine**: EJS
- **HTTP Client**: Axios
- **Data Visualization**: Chart.js
- **Real-time Updates**: Server-Sent Events (SSE)
- **Environment Management**: dotenv
- **Performance**: compression, node-cache

## Dependencies

Main dependencies:
- `express`: ^5.1.0 - Web framework
- `axios`: ^1.10.0 - HTTP client for API requests
- `ejs`: ^3.1.10 - Template engine
- `dotenv`: ^16.6.1 - Environment variable management
- `compression`: ^1.8.0 - HTTP compression middleware
- `node-cache`: ^5.1.2 - In-memory caching
- `express-rate-limit`: ^7.5.1 - Rate limiting middleware

Development dependencies:
- `nodemon`: ^3.1.10 - Auto-reload during development

## API Integration

This application integrates with the Niagara Cloud Platform APIs:

1. **Authentication**: OAuth 2.0 client credentials flow
2. **Point Discovery**: Entity model API for discovering points by name or tags
3. **Real-time Reading**: Control API for reading current point values
4. **Historical Data**: Telemetry API for historical data retrieval

### Authentication Flow

The application uses token caching to minimize authentication requests:
- Tokens are cached and reused until 60 seconds before expiration
- Automatic token refresh when expired

## Development

### Running Tests

```bash
npm test
```

Note: Currently, no tests are specified. You may need to add test scripts.

### Code Style

The project uses:
- Async/await for asynchronous operations
- Error handling with try-catch blocks
- Console logging for monitoring and debugging

## Performance Optimizations

1. **Token Caching**: Reuses authentication tokens to reduce API calls
2. **Background Refresh**: Data is refreshed every 10 seconds in the background
3. **HTTP Compression**: Reduces response size with gzip compression
4. **Connection Pooling**: Persistent HTTPS connections with keep-alive
5. **Conditional Fetching**: Prevents concurrent fetches with locking mechanisms

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `CLIENT_ID` | Niagara Cloud API client ID |
| `CLIENT_SECRET` | Niagara Cloud API client secret |
| `CUSTOMER_ID` | Customer ID for API requests |
| `SYSTEM_GUID` | System GUID for the Niagara device |
| `PING_TOKEN_URL` | Token endpoint URL for authentication |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Create a Pull Request

## License

ISC

## Author

Vaishnavi

## Support

For issues and questions, please open an issue in the GitHub repository.
