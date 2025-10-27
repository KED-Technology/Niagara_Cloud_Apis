require('dotenv').config({ path: './dashboard.env' });
const express = require('express');
const axios = require('axios');
const path = require('path');
const https = require('https');
const compression = require('compression');

const app = express();
const PORT = 3000;

app.use(compression());

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 20,
  maxFreeSockets: 10,
  timeout: 60000
});

// Setup
app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// ===== Middleware to measure response time =====
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.log(`[SLOW] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Config
const config = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  customerId: process.env.CUSTOMER_ID,
  systemGuid: process.env.SYSTEM_GUID,
  tokenUrl: process.env.PING_TOKEN_URL,
  powerCloudId: "93572754-b3fc-4788-880a-4ddd9503c044"
};

// Token cache
let tokenInfo = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const now = Date.now() / 1000;
  if (tokenInfo.token && tokenInfo.expiresAt - now > 60) return tokenInfo.token;
  const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
  const res = await axios.post(config.tokenUrl, 'grant_type=client_credentials&scope=ncp:read', {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    httpsAgent: agent
  });
  tokenInfo.token = res.data.access_token;
  tokenInfo.expiresAt = now + res.data.expires_in;
  return tokenInfo.token;
}

// Cached responses
let latestDashboardData = null;
let lastUpdated = null;

async function fetchAllPoints(token) {
  const url = `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`;

  const cloudIds = [
    // ReadPoints
    "827ddd08-a8a0-4fd9-9963-f65a73099665", "c853dc68-38d1-4d0b-a8b7-0bfb52096623", "3a04d9d0-c99b-4235-a08a-e94c6c01d546",

    // AQI
    "ce9d0677-f9ea-485e-ac33-3057b9c3f01d",

    // Occupancy
    "be042b19-642a-45ea-b692-c44d80898a3e",

    // Water
    "facbfc69-a2d0-447f-95f1-c99f2da1270c", "5b23005a-3d7a-4d6b-9c91-3837eab3bee5",

    // EPI percent
    "6eb36121-d41e-4062-b33e-b1e8064cd8d1", "3dd24b2d-c496-4185-8a1f-333e179ad56b", "515c41b2-ac5d-48cf-aeb4-48eb36410155",

    // EPI unit
    "560a653f-7c90-418f-927e-9512b8ce8eee", "baec119d-cba1-49de-9b6b-92ee518558e0", "ddbe2cbe-719c-4b54-9008-50b04b5279ff",

    // EPI total
    "5f7ed7ac-8daf-4fe5-9287-66331bdd1646"
  ];

  const payload = {
    cloudIds,
    requestProcessingPriority: 255
  };

  const res = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Accept-Encoding': 'gzip,deflate',
      'Content-Type': 'application/json'
    },
    httpsAgent: agent
  });

  return res.data.pointReadDetails;
}

// async function fetchPowerData(token) {
//  const now = new Date();

// // Set start time to today 00:00:00 (midnight)
// const start = new Date(now);
// start.setUTCHours(0, 0, 0, 0); // UTC 12:00 AM
// const startTime = start.toISOString();

// // Set end time to today 23:59:59.999
// const end = new Date(now);
// end.setUTCHours(23, 59, 59, 999); // UTC 11:59 PM
// const endTime = end.toISOString();

// console.log("Start Time: " + startTime);
// console.log("End Time: " + endTime);

//   const url = 'https://www.niagara-cloud.com/api/v1/egress/telemetry';
//   const payload = {
//     systemGuid: config.systemGuid,
//     cloudId: [config.powerCloudId],
//     startTime,
//     endTime,
//     recordLimit: 100,
//     includePreRecord: false,
//     includePostRecord: false,
//     sortAscending: false
//   };

//   const res = await axios.post(url, payload, {
//     headers: {
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     },
//     httpsAgent: agent
//   });

//   return res. data.pointDetails[0]?.historyRecords || [];
// }

// Background refresh every 10 seconds

async function fetchPowerData(token) {
  const now = new Date();

  // Set start time to today 00:00:00 (midnight UTC)
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  const startTime = start.toISOString();

  // Set end time to today 23:59:59.999 UTC
  const end = new Date(now);
  end.setUTCHours(23, 59, 59, 999);
  const endTime = end.toISOString();

  console.log("Start Time: " + startTime);
  console.log("End Time: " + endTime);

  const url = 'https://www.niagara-cloud.com/api/v1/egress/telemetry';
  const payload = {
    systemGuid: config.systemGuid,
    cloudId: [config.powerCloudId],
    startTime,
    endTime,
    recordLimit: 100,
    includePreRecord: false,
    includePostRecord: false,
    sortAscending: false
  };

  try {
    const res = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      httpsAgent: agent
    });

    const records = res.data.pointDetails[0]?.historyRecords || [];
    
    console.log("✅ Telemetry Records Retrieved:", records.length);
    console.log(JSON.stringify(records.slice(0, 3), null, 2)); // Show first 3 records

    return records;

  } catch (error) {
    console.error("❌ Error fetching telemetry data:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
    return [];
  }
}


async function refreshDashboardData() {
  try {
    const token = await getAccessToken();
    const allPoints = await fetchAllPoints(token);
    const powerData = await fetchPowerData(token);

    const pointMap = {};
    for (const p of allPoints) {
      pointMap[p.cloudId] = parseFloat(p.value || 0);
    }

    // Process power data for chart
    const formattedPowerData = powerData.map(record => ({
      time: new Date(record.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: record.value // Convert to watts if needed
    })).reverse(); // Reverse to show oldest first

    const readPoints = [
      pointMap["827ddd08-a8a0-4fd9-9963-f65a73099665"],
      pointMap["c853dc68-38d1-4d0b-a8b7-0bfb52096623"],
      pointMap["3a04d9d0-c99b-4235-a08a-e94c6c01d546"]
    ];

    const aqi = { value: pointMap["ce9d0677-f9ea-485e-ac33-3057b9c3f01d"] };
    const occupancy = { value: pointMap["be042b19-642a-45ea-b692-c44d80898a3e"] };

    const water = [
      { country: "Domestic", litres: pointMap["facbfc69-a2d0-447f-95f1-c99f2da1270c"] },
      { country: "Flushing", litres: pointMap["5b23005a-3d7a-4d6b-9c91-3837eab3bee5"] }
    ];

    const epi = {
      labels: ["HVAC", "UPS", "RP & LTG"],
      percentValues: [
        pointMap["6eb36121-d41e-4062-b33e-b1e8064cd8d1"],
        pointMap["3dd24b2d-c496-4185-8a1f-333e179ad56b"],
        pointMap["515c41b2-ac5d-48cf-aeb4-48eb36410155"]
      ],
      unitValues: [
        pointMap["560a653f-7c90-418f-927e-9512b8ce8eee"],
        pointMap["baec119d-cba1-49de-9b6b-92ee518558e0"],
        pointMap["ddbe2cbe-719c-4b54-9008-50b04b5279ff"]
      ],
      totalEPI: pointMap["5f7ed7ac-8daf-4fe5-9287-66331bdd1646"]
    };

    latestDashboardData = { readPoints, aqi, occupancy, water, epi, powerData: formattedPowerData };
    lastUpdated = new Date();
    console.log(`[CACHE] Refreshed dashboard data at ${lastUpdated.toISOString()}`);
  } catch (e) {
    console.error('❌ Error refreshing background cache:', e.message);
  }
}

// Initialize and refresh every 10 seconds
setInterval(refreshDashboardData, 10000);
refreshDashboardData(); // initial call

// ========================
// Routes
// ========================
app.get('/dashboard', async (req, res) => {
  res.render('dashboard');
});

app.get('/dashboard-data', async (req, res) => {
  while (!latestDashboardData) {
    await new Promise(resolve => setTimeout(resolve, 500)); // wait 0.5 sec
  }
  res.json(latestDashboardData);
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});

// ============================
// Optimized server.js
// ============================
// require('dotenv').config({ path: './dashboard.env' });
// const express = require('express');
// const axios = require('axios');
// const path = require('path');
// const https = require('https');

// const compression = require('compression');



// const app = express();
// const PORT = 3000;

// app.use(compression());

// const agent = new https.Agent({
//   keepAlive: true,
//   maxSockets: 20,
//   maxFreeSockets: 10,
//   timeout: 60000
// });

// // Setup
// app.use(express.static('public'));
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');

// // ===== Middleware to measure response time =====
// app.use((req, res, next) => {
//   const start = Date.now();
//   res.on('finish', () => {
//     const duration = Date.now() - start;
//     if (duration > 1000) {
//       console.log(`[SLOW] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
//     }
//   });
//   next();
// });



// // Config
// const config = {
//   clientId: process.env.CLIENT_ID,
//   clientSecret: process.env.CLIENT_SECRET,
//   customerId: process.env.CUSTOMER_ID,
//   systemGuid: process.env.SYSTEM_GUID,
//   tokenUrl: process.env.PING_TOKEN_URL
// };

// // Token cache
// let tokenInfo = { token: null, expiresAt: 0 };

// async function getAccessToken() {
//   const now = Date.now() / 1000;
//   if (tokenInfo.token && tokenInfo.expiresAt - now > 60) return tokenInfo.token;
//   const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
//   const res = await axios.post(config.tokenUrl, 'grant_type=client_credentials&scope=ncp:read', {
//     headers: {
//       'Content-Type': 'application/x-www-form-urlencoded',
//       'Authorization': `Basic ${auth}`
//     },
//     httpsAgent: agent
//   });
//   tokenInfo.token = res.data.access_token;
//   tokenInfo.expiresAt = now + res.data.expires_in;
//   return tokenInfo.token;
// }

// // Cached responses
// let cache = {
//   occupancy: { data: null, ts: 0 },
//   aqi: { data: null, ts: 0 },
//   water: { data: null, ts: 0 },
//   epi: { data: null, ts: 0 }
// };
// const CACHE_TIME = 10000;

// async function fetchAllPoints(token) {
//   const url = `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`;

//   const cloudIds = [
//     // ReadPoints
//     "827ddd08-a8a0-4fd9-9963-f65a73099665", "c853dc68-38d1-4d0b-a8b7-0bfb52096623", "3a04d9d0-c99b-4235-a08a-e94c6c01d546",

//     // AQI
//     "ce9d0677-f9ea-485e-ac33-3057b9c3f01d",

//     // Occupancy
//     "be042b19-642a-45ea-b692-c44d80898a3e",

//     // Water
//     "facbfc69-a2d0-447f-95f1-c99f2da1270c", "5b23005a-3d7a-4d6b-9c91-3837eab3bee5",

//     // EPI percent
//     "6eb36121-d41e-4062-b33e-b1e8064cd8d1", "3dd24b2d-c496-4185-8a1f-333e179ad56b", "515c41b2-ac5d-48cf-aeb4-48eb36410155",

//     // EPI unit
//     "560a653f-7c90-418f-927e-9512b8ce8eee", "baec119d-cba1-49de-9b6b-92ee518558e0", "ddbe2cbe-719c-4b54-9008-50b04b5279ff",

//     // EPI total
//     "5f7ed7ac-8daf-4fe5-9287-66331bdd1646"
//   ];

//   const payload = {
//     cloudIds,
//     requestProcessingPriority: 255
//   };

//   const res = await axios.post(url, payload, {
//     headers: {
//   Authorization: `Bearer ${token}`,
//   'Accept-Encoding': 'gzip,deflate',
//   'Content-Type': 'application/json'
// },
//     httpsAgent: agent
//   });

//   return res.data.pointReadDetails;
// }

// // ========================
// // Combined Endpoint
// // ========================
// app.get('/dashboard', async (req, res) => {
//   res.render('dashboard');
// });

// let latestDashboardData = null;
// let lastUpdated = null;

// // Background refresh every 10 seconds
// async function refreshDashboardData() {
//   try {
//     const token = await getAccessToken();
//     const allPoints = await fetchAllPoints(token);

//     const pointMap = {};
//     for (const p of allPoints) {
//       pointMap[p.cloudId] = parseFloat(p.value || 0);
//     }

//     const readPoints = [
//       pointMap["827ddd08-a8a0-4fd9-9963-f65a73099665"],
//       pointMap["c853dc68-38d1-4d0b-a8b7-0bfb52096623"],
//       pointMap["3a04d9d0-c99b-4235-a08a-e94c6c01d546"]
//     ];

//     const aqi = { value: pointMap["ce9d0677-f9ea-485e-ac33-3057b9c3f01d"] };
//     const occupancy = { value: pointMap["be042b19-642a-45ea-b692-c44d80898a3e"] };

//     const water = [
//       { country: "Domestic", litres: pointMap["facbfc69-a2d0-447f-95f1-c99f2da1270c"] },
//       { country: "Flushing", litres: pointMap["5b23005a-3d7a-4d6b-9c91-3837eab3bee5"] }
//     ];

//     const epi = {
//       labels: ["HVAC", "UPS", "RP & LTG"],
//       percentValues: [
//         pointMap["6eb36121-d41e-4062-b33e-b1e8064cd8d1"],
//         pointMap["3dd24b2d-c496-4185-8a1f-333e179ad56b"],
//         pointMap["515c41b2-ac5d-48cf-aeb4-48eb36410155"]
//       ],
//       unitValues: [
//         pointMap["560a653f-7c90-418f-927e-9512b8ce8eee"],
//         pointMap["baec119d-cba1-49de-9b6b-92ee518558e0"],
//         pointMap["ddbe2cbe-719c-4b54-9008-50b04b5279ff"]
//       ],
//       totalEPI: pointMap["5f7ed7ac-8daf-4fe5-9287-66331bdd1646"]
//     };

//     latestDashboardData = { readPoints, aqi, occupancy, water, epi };
//     lastUpdated = new Date();
//     console.log(`[CACHE] Refreshed dashboard data at ${lastUpdated.toISOString()}`);
//   } catch (e) {
//     console.error('❌ Error refreshing background cache:', e.message);
//   }
// }

// setInterval(refreshDashboardData, 10000); // every 10 seconds
// refreshDashboardData(); // initial call

// // Serve cached data
// app.get('/dashboard-data', async (req, res) => {
//   while (!latestDashboardData) {
//     await new Promise(resolve => setTimeout(resolve, 500)); // wait 0.5 sec
//   }
//   res.json(latestDashboardData);
// });




// app.listen(PORT, () => {
//   console.log(`✅ Server running at http://localhost:${PORT}`);
// });


// require('dotenv').config({ path: './dashboard.env' });
// const express = require('express');
// const axios = require('axios');
// const path = require('path');

// const app = express();
// const PORT = 3000;

// // ========== Express Setup ==========
// app.use(express.static('public'));
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');

// // ========== Config from .env ==========
// const config = {
//   clientId: process.env.CLIENT_ID,
//   clientSecret: process.env.CLIENT_SECRET,
//   customerId: process.env.CUSTOMER_ID,
//   systemGuid: process.env.SYSTEM_GUID,
//   tokenUrl: process.env.PING_TOKEN_URL
// };

// // ========== Token Management ==========
// let tokenInfo = {
//   token: null,
//   expiresAt: 0
// };

// async function getAccessToken() {
//   const now = Date.now() / 1000;

//   if (tokenInfo.token && tokenInfo.expiresAt - now > 60) {
//     return tokenInfo.token;
//   }

//   const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

//   const response = await axios.post(
//     config.tokenUrl,
//     'grant_type=client_credentials&scope=ncp:read',
//     {
//       headers: {
//         'Content-Type': 'application/x-www-form-urlencoded',
//         'Authorization': `Basic ${basicAuth}`
//       }
//     }
//   );

//   const data = response.data;
//   tokenInfo.token = data.access_token;
//   tokenInfo.expiresAt = now + data.expires_in;

//   return tokenInfo.token;
// }

// // ========== Fetch Point Names ==========
// async function fetchPointData() {
//   const token = await getAccessToken();
//   const url = `https://www.niagara-cloud.com/api/v1/entitymodel/customers/${config.customerId}/pointNames?page=0&size=100`;

//   const response = await axios.post(url, {
//     systemGuid: config.systemGuid,
//     searchType: "pointName",
//     comparisonType: "any"
//   }, {
//     headers: {
//       'Authorization': `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     }
//   });

//   return response.data;
// }

// // ========== Fetch Telemetry ==========
// async function fetchTelemetryData() {
//   const token = await getAccessToken();
//   const url = 'https://www.niagara-cloud.com/api/v1/egress/telemetry';

//   const payload = {
//     systemGuid: config.systemGuid,
//     cloudId: [
//       '631d3613-061a-4128-9cc6-0f5b17acf028',
//       '82638d68-6eba-41fa-b324-6abaf072ceab',
//       '0dadf777-7fa9-4bba-9080-ded2c79610f4'
//     ],
//     startTime: "2025-06-13T05:15:00.000Z",
//     endTime: "2025-06-23T05:09:00.000Z",
//     recordLimit: 5000,
//     includePreRecord: true,
//     includePostRecord: true,
//     sortAscending: false
//   };

//   const response = await axios.post(url, payload, {
//     headers: {
//       'Authorization': `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     }
//   });

//   return response.data;
// }

// // ========== Fetch Real-Time Point Values ==========
// async function fetchReadCommandData() {
//   const token = await getAccessToken();
//   const url = `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`;

//   const payload = {
//     cloudIds: [
//       "827ddd08-a8a0-4fd9-9963-f65a73099665",
//       "c853dc68-38d1-4d0b-a8b7-0bfb52096623",
//       "3a04d9d0-c99b-4235-a08a-e94c6c01d546"
//     ],
//     requestProcessingPriority: 255
//   }

//   const response = await axios.post(url, payload, {
//     headers: {
//       'Authorization': `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     }
//   });

//   return response.data;
// }

// // ========== Routes ==========

// // Home Route: Point Names
// app.get('/', async (req, res) => {
//   try {
//     const pointData = await fetchPointData();
//     if (!pointData._embedded?.pointModels) {
//       return res.status(500).send('Unexpected API response format');
//     }
//     res.render('index', { points: pointData._embedded.pointModels });
//   } catch (error) {
//     console.error('Error:', error.message || error);
//     res.status(500).send('Error fetching point names');
//   }
// });

// app.get('/dashboard', async (req, res) => {
//   res.render('dashboard'); // don’t pass static data; use frontend fetch
// });

// // Telemetry Route
// app.get('/telemetry', async (req, res) => {
//   try {
//     const telemetryData = await fetchTelemetryData();
//     res.render('telemetry', { telemetry: telemetryData });
//   } catch (error) {
//     console.error('Telemetry Error:', error.message || error);
//     res.status(500).send('Error fetching telemetry data');
//   }
// });

// // Read Real-Time Points Route
// app.get('/read-points', async (req, res) => {
//   try {
//     const readData = await fetchReadCommandData();
//     res.json(readData.pointReadDetails);
//   } catch (error) {
//     console.error('Read Command Error:', error.message || error);
//     res.status(500).send('Error fetching real-time read points');
//   }
// });

// // In your Express server (e.g., app.js or server.js)
// app.get('/line-chart-data', async (req, res) => {
//   try {
//     const token = await getAccessToken(); // Use your existing token logic
//     const response = await axios.post(
//       'https://www.niagara-cloud.com/api/v1/egress/telemetry',
//       {
//         systemGuid: "64db6363-56d9-4c0c-8aa8-99137f126d65",
//         cloudId: ["93572754-b3fc-4788-880a-4ddd9503c044"],
//         startTime: "2025-06-25T06:30:00Z",
//         endTime: "2025-06-25T12:30:00Z",
//         recordLimit: "10",
//         includePreRecord: false,
//         includePostRecord: false,
//         sortAscending: false
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           'Content-Type': 'application/json'
//         }
//       }
//     );

//     const records = response.data?.pointDetails?.[0]?.historyRecords || [];

//     // Format for chart
//     const formattedData = records.map(record => ({
//       time: new Date(record.time).toLocaleTimeString("en-IN", {
//         timeZone: "Asia/Kolkata",
//         hour: "2-digit",
//         minute: "2-digit"
//       }),
//       value: parseFloat(record.value)
//     }));

//     res.json(formattedData);
//   } catch (error) {
//     console.error('❌ Error in /line-chart-data:', error.message);
//     res.status(500).json({ error: 'Failed to fetch telemetry data' });
//   }
// });

// app.get('/occupancy-data', async (req, res) => {
//   try {
//     const token = await getAccessToken();
//     const url = `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`;

//     const payload = {
//       cloudIds: ["be042b19-642a-45ea-b692-c44d80898a3e"],
//       requestProcessingPriority: 255
//     };

//     const response = await axios.post(url, payload, {
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     const value = parseFloat(response.data?.pointReadDetails?.[0]?.value || 0);
//     res.json({ value });

//   } catch (error) {
//     console.error("Error fetching occupancy data:", error.message);
//     res.status(500).json({ error: 'Failed to fetch occupancy data' });
//   }
// });

// app.get('/aqi-data', async (req, res) => {
//   try {
//     const token = await getAccessToken();
//     const url = `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`;

//     const payload = {
//       cloudIds: ["ce9d0677-f9ea-485e-ac33-3057b9c3f01d"], // Your AQI sensor ID
//       requestProcessingPriority: 255
//     };

//     const response = await axios.post(url, payload, {
//       headers: {
//         Authorization: `Bearer ${token}`,
//         'Content-Type': 'application/json'
//       }
//     });

//     const value = parseFloat(response.data?.pointReadDetails?.[0]?.value || 0);
//     res.json({ value });
//   } catch (error) {
//     console.error("❌ AQI API Error:", error.message);
//     res.status(500).json({ error: 'Failed to fetch AQI data' });
//   }
// });

// // EPI Donut Chart Data Route
// app.get('/epi-donut-data', async (req, res) => {
//   try {
//     const token = await getAccessToken();
//     const headers = {
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     };

//     // Cloud ID payloads
//     const percentPayload = {
//       cloudIds: [
//         "6eb36121-d41e-4062-b33e-b1e8064cd8d1", // HVAC %
//         "3dd24b2d-c496-4185-8a1f-333e179ad56b", // UPS %
//         "515c41b2-ac5d-48cf-aeb4-48eb36410155"  // RP & LTG %
//       ],
//       requestProcessingPriority: 255
//     };

//     const unitPayload = {
//       cloudIds: [
//         "560a653f-7c90-418f-927e-9512b8ce8eee", // HVAC units
//         "baec119d-cba1-49de-9b6b-92ee518558e0", // UPS units
//         "ddbe2cbe-719c-4b54-9008-50b04b5279ff"  // RP & LTG units
//       ],
//       requestProcessingPriority: 255
//     };

//     const totalPayload = {
//       cloudIds: ["5f7ed7ac-8daf-4fe5-9287-66331bdd1646"], // total EPI
//       requestProcessingPriority: 255
//     };

//     // 🔁 Fetch all 3 in parallel
//     const [percentRes, unitRes, totalEpiRes] = await Promise.all([
//       axios.post(`https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`, percentPayload, { headers }),
//       axios.post(`https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`, unitPayload, { headers }),
//       axios.post(`https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`, totalPayload, { headers })
//     ]);

//     // 🔁 Correct ordering using cloudId lookup
//     const percentValues = percentPayload.cloudIds.map(id => {
//       const match = percentRes.data.pointReadDetails.find(p => p.cloudId === id);
//       return match ? parseFloat(match.value) : 0;
//     });

//     const unitValues = unitPayload.cloudIds.map(id => {
//       const match = unitRes.data.pointReadDetails.find(p => p.cloudId === id);
//       return match ? parseFloat(match.value) : 0;
//     });

//     const totalEPI = parseFloat(totalEpiRes.data.pointReadDetails?.[0]?.value || 0);

//     res.json({
//       labels: ["HVAC", "UPS", "RP & LTG"],
//       percentValues,
//       unitValues,
//       totalEPI
//     });

//   } catch (error) {
//     console.error("❌ EPI Donut API Error:", error.message);
//     res.status(500).json({ error: 'Failed to fetch EPI donut data' });
//   }
// });

// app.get('/water-usage-data', async (req, res) => {
//   try {
//     const token = await getAccessToken();
//     const headers = {
//       Authorization: `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     };

//     const payload = {
//       cloudIds: [
//         "facbfc69-a2d0-447f-95f1-c99f2da1270c", // Domestic
//         "5b23005a-3d7a-4d6b-9c91-3837eab3bee5"  // Flushing
//       ],
//       requestProcessingPriority: 255
//     };

//     const response = await axios.post(
//       `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`,
//       payload,
//       { headers }
//     );

//     const pointMap = {
//       "facbfc69-a2d0-447f-95f1-c99f2da1270c": "Domestic",
//       "5b23005a-3d7a-4d6b-9c91-3837eab3bee5": "Flushing"
//     };

//     const chartData = payload.cloudIds.map(id => {
//       const match = response.data.pointReadDetails.find(p => p.cloudId === id);
//       return {
//         country: pointMap[id],
//         litres: match ? parseFloat(match.value) : 0
//       };
//     });

//     res.json(chartData);
//   } catch (error) {
//     console.error("❌ Water Usage API Error:", error.message);
//     res.status(500).json({ error: "Failed to fetch water usage data" });
//   }
// });





// // ========== Start Server ==========
// app.listen(PORT, () => {
//   console.log(`✅ Server running at http://localhost:${PORT}`);
// });
