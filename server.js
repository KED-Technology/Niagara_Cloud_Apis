// require('dotenv').config({ path: './dashboard.env' });
// const express = require('express');
// const axios = require('axios');
// const https = require('https');
// const path = require('path');

// const app = express();
// const PORT = 3000;

// // Serve static files
// app.use(express.static(path.join(__dirname, 'views')));
// app.use(express.static(path.join(__dirname, 'public')));

// // HTTPS agent with keep-alive
// const agent = new https.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 20 });

// // Config
// const config = {
//     clientId: process.env.CLIENT_ID,
//     clientSecret: process.env.CLIENT_SECRET,
//     systemGuid: process.env.SYSTEM_GUID,
//     tokenUrl: process.env.PING_TOKEN_URL,
//     customerId: process.env.CUSTOMER_ID // Add this in your dashboard.env
// };

// // Token caching
// let tokenInfo = { token: null, expiresAt: 0 };
// async function getAccessToken() {
//     const now = Date.now() / 1000;
//     if (tokenInfo.token && tokenInfo.expiresAt - now > 60) return tokenInfo.token;

//     const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
//     const res = await axios.post(
//         config.tokenUrl,
//         'grant_type=client_credentials&scope=ncp:read',
//         {
//             headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${auth}` },
//             httpsAgent: agent
//         }
//     );

//     tokenInfo.token = res.data.access_token;
//     tokenInfo.expiresAt = now + res.data.expires_in;
//     console.log(`✅ Token obtained, expires in ${res.data.expires_in}s`);
//     return tokenInfo.token;
// }

// // SSE clients
// const clients = new Set();

// // SSE endpoint
// app.get('/api/stream-points', (req, res) => {
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive'
//     });

//     clients.add(res);
//     req.on('close', () => clients.delete(res));
// });

// // Fetch Scope points (name + cloudId)
// async function getScopePoints() {
//     try {
//         const token = await getAccessToken();
//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/entitymodel/customers/${config.customerId}/pointNames`,
//             {
//                 systemGuid: config.systemGuid,
//                 searchType: "pointName",
//                 comparisonType: "startswith",
//                 searchItems: ["Scope"]
//             },
//             {
//                 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
//                 httpsAgent: agent
//             }
//         );

//         return response.data._embedded.pointModels.map(p => ({
//             name: p.name,
//             cloudId: p.cloudId
//         }));
//     } catch (err) {
//         console.error("❌ Error fetching Scope points:", err.response ? err.response.data : err.message);
//         return [];
//     }
// }

// let fetching = false;

// async function fetchAndPush() {
//     if (fetching) return; // skip if previous fetch still running
//     fetching = true;

//     const timerLabel = `⏱ Fetching points ${Date.now()}`;
//     console.time(timerLabel);

//     try {
//         const pointsList = await getScopePoints();
//         const token = await getAccessToken();

//         const cloudIds = pointsList.map(p => p.cloudId);
//         if (!cloudIds.length) return;

//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`,
//             { cloudIds, requestProcessingPriority: 255 },
//             { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, httpsAgent: agent }
//         );

//         const points = response.data.pointReadDetails.map(p => {
//             const match = pointsList.find(pl => pl.cloudId === p.cloudId);
//             return {
//                 cloudId: p.cloudId,
//                 name: match ? match.name : p.cloudId,
//                 value: p.value
//             };
//         });

//         const payload = JSON.stringify(points);
//         for (const client of clients) {
//             client.write(`data: ${payload}\n\n`);
//         }

//     } catch (err) {
//         console.error('❌ Error fetching points:', err.response ? err.response.data : err.message);
//     } finally {
//         console.timeEnd(timerLabel);
//         fetching = false;
//     }
// }

// setInterval(fetchAndPush, 2000);

// // Fetch Water points (name + cloudId)
// async function getWaterPoints() {
//     try {
//         const token = await getAccessToken();
//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/entitymodel/customers/${config.customerId}/pointNames`,
//             {
//                 systemGuid: config.systemGuid,
//                 searchType: "pointName",
//                 comparisonType: "startswith",
//                 searchItems: ["Total_DOMESTIC", "Total_FLUSHING"]
//             },
//             {
//                 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
//                 httpsAgent: agent
//             }
//         );

//         return response.data._embedded.pointModels.map(p => ({
//             name: p.name,
//             cloudId: p.cloudId
//         }));
//     } catch (err) {
//         console.error("❌ Error fetching Water points:", err.response ? err.response.data : err.message);
//         return [];
//     }
// }

// // SSE endpoint for water chart
// app.get('/api/stream-water', (req, res) => {
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive'
//     });

//     clients.add(res);
//     req.on('close', () => clients.delete(res));
// });

// let fetchingWater = false;
// async function fetchAndPushWater() {
//     if (fetchingWater) return;
//     fetchingWater = true;

//     try {
//         const pointsList = await getWaterPoints();
//         const token = await getAccessToken();

//         const cloudIds = pointsList.map(p => p.cloudId);
//         if (!cloudIds.length) return;

//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`,
//             { cloudIds, requestProcessingPriority: 255 },
//             { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, httpsAgent: agent }
//         );

//         const points = response.data.pointReadDetails.map(p => {
//             const match = pointsList.find(pl => pl.cloudId === p.cloudId);
//             return {
//                 cloudId: p.cloudId,
//                 name: match ? match.name : p.cloudId,
//                 value: p.value
//             };
//         });

//         const payload = JSON.stringify(points);
//         for (const client of clients) {
//             client.write(`data: ${payload}\n\n`);
//         }

//     } catch (err) {
//         console.error('❌ Error fetching Water points:', err.response ? err.response.data : err.message);
//     } finally {
//         fetchingWater = false;
//     }
// }

// setInterval(fetchAndPushWater, 2000);

// // Fetch Occupancy points (name + cloudId)
// async function getOccupancyPoints() {
//     try {
//         const token = await getAccessToken();
//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/entitymodel/customers/${config.customerId}/pointNames`,
//             {
//                 systemGuid: config.systemGuid,
//                 searchType: "pointName",
//                 comparisonType: "startswith",
//                 searchItems: ["Occupancy"]
//             },
//             {
//                 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
//                 httpsAgent: agent
//             }
//         );

//         return response.data._embedded.pointModels.map(p => ({
//             name: p.name,
//             cloudId: p.cloudId
//         }));
//     } catch (err) {
//         console.error("❌ Error fetching Occupancy points:", err.response ? err.response.data : err.message);
//         return [];
//     }
// }

// // SSE endpoint for Occupancy
// app.get('/api/stream-occupancy', (req, res) => {
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive'
//     });

//     clients.add(res);
//     req.on('close', () => clients.delete(res));
// });

// let fetchingOccupancy = false;
// async function fetchAndPushOccupancy() {
//     if (fetchingOccupancy) return;
//     fetchingOccupancy = true;

//     try {
//         const pointsList = await getOccupancyPoints();
//         const token = await getAccessToken();

//         const cloudIds = pointsList.map(p => p.cloudId);
//         if (!cloudIds.length) return;

//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`,
//             { cloudIds, requestProcessingPriority: 255 },
//             { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, httpsAgent: agent }
//         );

//         const points = response.data.pointReadDetails.map(p => {
//             const match = pointsList.find(pl => pl.cloudId === p.cloudId);
//             return {
//                 cloudId: p.cloudId,
//                 name: match ? match.name : p.cloudId,
//                 value: p.value
//             };
//         });

//         const payload = JSON.stringify(points);
//         for (const client of clients) {
//             client.write(`data: ${payload}\n\n`);
//         }

//     } catch (err) {
//         console.error('❌ Error fetching Occupancy points:', err.response ? err.response.data : err.message);
//     } finally {
//         fetchingOccupancy = false;
//     }
// }

// setInterval(fetchAndPushOccupancy, 2000);


// // Fetch IAQ points (name + cloudId)
// async function getIAQPoints() {
//     try {
//         const token = await getAccessToken();
//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/entitymodel/customers/${config.customerId}/pointNames`,
//             {
//                 systemGuid: config.systemGuid,
//                 searchType: "pointName",
//                 comparisonType: "startswith",
//                 searchItems: ["IAQ"]
//             },
//             {
//                 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
//                 httpsAgent: agent
//             }
//         );

//         return response.data._embedded.pointModels.map(p => ({
//             name: p.name,
//             cloudId: p.cloudId
//         }));
//     } catch (err) {
//         console.error("❌ Error fetching IAQ points:", err.response ? err.response.data : err.message);
//         return [];
//     }
// }

// // SSE endpoint for IAQ
// app.get('/api/stream-iaq', (req, res) => {
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive'
//     });

//     clients.add(res);
//     req.on('close', () => clients.delete(res));
// });

// let fetchingIAQ = false;
// async function fetchAndPushIAQ() {
//     if (fetchingIAQ) return;
//     fetchingIAQ = true;

//     try {
//         const pointsList = await getIAQPoints();
//         const token = await getAccessToken();

//         const cloudIds = pointsList.map(p => p.cloudId);
//         if (!cloudIds.length) return;

//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`,
//             { cloudIds, requestProcessingPriority: 255 },
//             { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, httpsAgent: agent }
//         );

//         const points = response.data.pointReadDetails.map(p => {
//             const match = pointsList.find(pl => pl.cloudId === p.cloudId);
//             return {
//                 cloudId: p.cloudId,
//                 name: match ? match.name : p.cloudId,
//                 value: p.value
//             };
//         });

//         const payload = JSON.stringify(points);
//         for (const client of clients) {
//             client.write(`data: ${payload}\n\n`);
//         }

//     } catch (err) {
//         console.error('❌ Error fetching IAQ points:', err.response ? err.response.data : err.message);
//     } finally {
//         fetchingIAQ = false;
//     }
// }

// setInterval(fetchAndPushIAQ, 2000);

// // Fetch EPI points (HVAC, UPS, RP_LTG, TotalEpi)
// async function getEPIPoints() {
//     try {
//         const token = await getAccessToken();
//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/entitymodel/customers/${config.customerId}/pointNames`,
//             {
//                 systemGuid: config.systemGuid,
//                 searchType: "pointName",
//                 comparisonType: "exact",
//  searchItems: [ "EPI_RP_LTG", "EPI_UPS", "EPI_HVAC", "TotalEpi" ]
//             },
//             {
//                 headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
//                 httpsAgent: agent
//             }
//         );

//         return response.data._embedded.pointModels.map(p => ({
//             name: p.name,
//             cloudId: p.cloudId
//         }));
//     } catch (err) {
//         console.error("❌ Error fetching EPI points:", err.response ? err.response.data : err.message);
//         return [];
//     }
// }

// // SSE endpoint for EPI
// app.get('/api/stream-epi', (req, res) => {
//     res.writeHead(200, {
//         'Content-Type': 'text/event-stream',
//         'Cache-Control': 'no-cache',
//         'Connection': 'keep-alive'
//     });

//     clients.add(res);
//     req.on('close', () => clients.delete(res));
// });

// let fetchingEPI = false;
// async function fetchAndPushEPI() {
//     if (fetchingEPI) return;
//     fetchingEPI = true;

//     try {
//         const pointsList = await getEPIPoints();
//         const token = await getAccessToken();
//         const cloudIds = pointsList.map(p => p.cloudId);

//         if (!cloudIds.length) return;

//         const response = await axios.post(
//             `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`,
//             { cloudIds, requestProcessingPriority: 255 },
//             { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, httpsAgent: agent }
//         );

//         const points = response.data.pointReadDetails.map(p => {
//             const match = pointsList.find(pl => pl.cloudId === p.cloudId);
//             return {
//                 cloudId: p.cloudId,
//                 name: match ? match.name : p.cloudId,
//                 value: p.value
//             };
//         });

//         const payload = JSON.stringify(points);
//         for (const client of clients) {
//             client.write(`data: ${payload}\n\n`);
//         }

//     } catch (err) {
//         console.error("❌ Error fetching EPI points:", err.response ? err.response.data : err.message);
//     } finally {
//         fetchingEPI = false;
//     }
// }

// setInterval(fetchAndPushEPI, 5000); // every 5s


// // Serve dashboarddemo.html
// app.get('/dashboard', (req, res) => {
//     res.sendFile(path.join(__dirname, 'views', 'index.html'));
// });

// // Start server
// app.listen(PORT, () => {
//     console.log(`✅ Server running at http://localhost:${PORT}`);
// });


require('dotenv').config({ path: './dashboard.env' });
const express = require('express');
const axios = require('axios');
const https = require('https');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'testing')));

// HTTPS agent with keep-alive
const agent = new https.Agent({ keepAlive: true, maxSockets: 50, maxFreeSockets: 20 });

// Config
const config = {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    systemGuid: process.env.SYSTEM_GUID,
    tokenUrl: process.env.PING_TOKEN_URL,
    customerId: process.env.CUSTOMER_ID
};

// Token caching
let tokenInfo = { token: null, expiresAt: 0 };
async function getAccessToken() {
    const now = Date.now() / 1000;
    if (tokenInfo.token && tokenInfo.expiresAt - now > 60) return tokenInfo.token;

    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const res = await axios.post(
        config.tokenUrl,
        'grant_type=client_credentials&scope=ncp:read',
        {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${auth}` },
            httpsAgent: agent
        }
    );

    tokenInfo.token = res.data.access_token;
    tokenInfo.expiresAt = now + res.data.expires_in;
    console.log(`✅ Token obtained, expires in ${res.data.expires_in}s`);
    return tokenInfo.token;
}

// --- SSE client sets ---
const clients = {
    scope: new Set(),
    water: new Set(),
    occupancy: new Set(),
    iaq: new Set(),
    epi: new Set()
};

// --- SSE endpoints ---
function createSSEEndpoint(route, group) {
    app.get(route, (req, res) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        clients[group].add(res);
        req.on('close', () => clients[group].delete(res));
    });
}

createSSEEndpoint('/api/stream-points', 'scope');
createSSEEndpoint('/api/stream-water', 'water');
createSSEEndpoint('/api/stream-occupancy', 'occupancy');
createSSEEndpoint('/api/stream-iaq', 'iaq');
createSSEEndpoint('/api/stream-epi', 'epi');

// --- Fetch helpers ---
async function fetchPoints(searchItems, comparisonType = "startswith") {
    const token = await getAccessToken();
    const response = await axios.post(
        `https://www.niagara-cloud.com/api/v1/entitymodel/customers/${config.customerId}/pointNames`,
        { systemGuid: config.systemGuid, searchType: "pointName", comparisonType, searchItems },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, httpsAgent: agent }
    );
    return response.data._embedded.pointModels.map(p => ({ name: p.name, cloudId: p.cloudId }));
}

async function readValues(pointsList) {
    if (!pointsList.length) return [];
    const token = await getAccessToken();
    const cloudIds = pointsList.map(p => p.cloudId);
    const response = await axios.post(
        `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`,
        { cloudIds, requestProcessingPriority: 255 },
        { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, httpsAgent: agent }
    );
    return response.data.pointReadDetails.map(p => {
        const match = pointsList.find(pl => pl.cloudId === p.cloudId);
        return { cloudId: p.cloudId, name: match ? match.name : p.cloudId, value: p.value };
    });
}

function pushToClients(group, payload) {
    for (const client of clients[group]) {
        client.write(`data: ${payload}\n\n`);
    }
}

// --- Scope ---
let fetchingScope = false;
async function fetchAndPushScope() {
    if (fetchingScope) return;
    fetchingScope = true;
    try {
        const pointsList = await fetchPoints(["Scope"]);
        const points = await readValues(pointsList);
        if (points.length) pushToClients("scope", JSON.stringify(points));
    } catch (err) {
        console.error("❌ Scope error:", err.response ? err.response.data : err.message);
    } finally {
        fetchingScope = false;
    }
}
setInterval(fetchAndPushScope, 60000);

// --- Water ---
let fetchingWater = false;
async function fetchAndPushWater() {
    if (fetchingWater) return;
    fetchingWater = true;
    try {
        const pointsList = await fetchPoints(["Total_DOMESTIC", "Total_FLUSHING"]);
        const points = await readValues(pointsList);
        if (points.length) pushToClients("water", JSON.stringify(points));
    } catch (err) {
        console.error("❌ Water error:", err.response ? err.response.data : err.message);
    } finally {
        fetchingWater = false;
    }
}
setInterval(fetchAndPushWater, 60000);

// --- Occupancy ---
let fetchingOccupancy = false;
async function fetchAndPushOccupancy() {
    if (fetchingOccupancy) return;
    fetchingOccupancy = true;
    try {
        const pointsList = await fetchPoints(["Occupancy"]);
        const points = await readValues(pointsList);
        if (points.length) pushToClients("occupancy", JSON.stringify(points));
    } catch (err) {
        console.error("❌ Occupancy error:", err.response ? err.response.data : err.message);
    } finally {
        fetchingOccupancy = false;
    }
}
setInterval(fetchAndPushOccupancy, 60000);

// --- IAQ ---
let fetchingIAQ = false;
async function fetchAndPushIAQ() {
    if (fetchingIAQ) return;
    fetchingIAQ = true;
    try {
        const pointsList = await fetchPoints(["IAQ"]);
        const points = await readValues(pointsList);
        if (points.length) pushToClients("iaq", JSON.stringify(points));
    } catch (err) {
        console.error("❌ IAQ error:", err.response ? err.response.data : err.message);
    } finally {
        fetchingIAQ = false;
    }
}
setInterval(fetchAndPushIAQ, 60000);

// --- EPI ---
let fetchingEPI = false;
async function fetchAndPushEPI() {
    if (fetchingEPI) return;
    fetchingEPI = true;
    try {
        const pointsList = await fetchPoints(["EPI_RP_LTG", "EPI_UPS", "EPI_HVAC", "TotalEpi"], "exact");
        const points = await readValues(pointsList);
        if (points.length) pushToClients("epi", JSON.stringify(points));
    } catch (err) {
        console.error("❌ EPI error:", err.response ? err.response.data : err.message);
    } finally {
        fetchingEPI = false;
    }
}
setInterval(fetchAndPushEPI, 5000);

// Endpoint to fetch today’s telemetry for a cloudId
app.get('/api/telemetry/:cloudId', async (req, res) => {
    try {
        const cloudId = req.params.cloudId;
        const accessToken = await getAccessToken();

        const startTime = new Date();
        startTime.setHours(0, 0, 0, 0);
        const startISO = startTime.toISOString();

        const endTime = new Date();
        endTime.setHours(23, 59, 59, 999);
        const endISO = endTime.toISOString();

        const requestBody = {
            systemGuid: config.systemGuid,
            cloudId: [cloudId],
            startTime: startISO,
            endTime: endISO,
            recordLimit: 500,
            includePreRecord: false,
            includePostRecord: false,
            sortAscending: true
        };

        const response = await axios.post(
            "https://www.niagara-cloud.com/api/v1/egress/telemetry",
            requestBody,
            {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${accessToken}`
                },
                httpsAgent: agent
            }
        );

        const data = response.data;

        if (!data.pointDetails?.length) return res.json([]);

        const history = data.pointDetails[0].historyRecords || [];

        const result = history.map(record => ({
            time: new Date(record.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: Number(record.value)
        }));

        res.json(result);
    } catch (err) {
        console.error("❌ Telemetry error:", err.response?.data || err.message);
        res.status(500).json({ error: err.message });
    }
});

// Cache discovered points for tags
const tagPointsCache = {};
async function initializeTagPoints() {
    const tagName = "same:t"; // your tag
    try {
        const points = await discoverPointsByTag(tagName);
        if (points.length) {
            tagPointsCache[tagName] = points; // store in cache
            console.log(`✅ Points cached for tag "${tagName}":`, points);
        } else {
            console.warn(`⚠️ No points found for tag "${tagName}"`);
        }
    } catch (err) {
        console.error("❌ Failed to initialize tag points:", err.response?.data || err.message);
    }
}

// Call it once at startup
initializeTagPoints();

// --- Discover Points by Tag ---
async function discoverPointsByTag(tagName) {
  try {
    const accessToken = await getAccessToken();

    const res = await axios.post(
      `https://www.niagara-cloud.com/api/v1/entitymodel/customers/${config.customerId}/tagNames`,
      {
        systemGuid: config.systemGuid,
        searchType: "tagName",
        searchItems: [tagName]   // e.g. ["same:t"]
      },
      { 
        headers: { Authorization: `Bearer ${accessToken}` }, 
        httpsAgent: agent 
      }
    );

    const points = res.data._embedded?.pointModels?.map(p => ({
      name: p.name,
      cloudId: p.cloudId
    })) || [];

    // console.log(`📌 Points discovered for tagName "${tagName}":`, points);
    return points;
  } catch (err) {
    console.error("❌ Error discovering points by tagName:", err.response?.data || err.message);
    return [];
  }
}


// --- Read Values for Tagged Points ---
async function readTaggedValues() {
  const points = tagPointsCache["same:t"] || [];
  if (!points.length) return {};

  try {
    const accessToken = await getAccessToken();
    const cloudIds = points.map(p => p.cloudId);
    const res = await axios.post(
      `https://www.niagara-cloud.com/api/v1/control/devices/${config.systemGuid}/commands/read`,
      { cloudIds },
      { headers: { Authorization: `Bearer ${accessToken}` }, httpsAgent: agent }
    );

    const values = {};
res.data.pointReadDetails.forEach(r => {
  const point = points.find(p => p.cloudId === r.cloudId);
  if (point) {
    // Use r.value directly
    values[point.name] = r.value ?? "--";
  }
});


    // ✅ Log values to server console for debugging
    // console.log("🔹 Live Tagged Values:", values);
    // console.log("🔹 Raw API response:", JSON.stringify(res.data, null, 2));


    return values;
  } catch (err) {
    console.error("❌ Error reading values:", err.response?.data || err.message);
    return {};
  }
}



// --- SSE Endpoint ---
app.get("/api/stream", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });

  // Default tag to "Clouddemo" (from your Postman response)
  const tagName = req.query.tag || "Clouddemo";

  async function push() {
    const values = await readTaggedValues(tagName);
    res.write(`data: ${JSON.stringify(values)}\n\n`);
  }

  push();
  const interval = setInterval(push, 60000);

  req.on("close", () => clearInterval(interval));
});


// Serve dashboarddemo.html
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
app.get('/dash', (req, res) => {
    res.sendFile(path.join(__dirname, 'testing', 'clouddemo.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}/dashboard`);
});
