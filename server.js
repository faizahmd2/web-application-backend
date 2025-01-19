require('dotenv').config({
    path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
});

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Initialize Socket.IO server
const socketServer = require('./src/web-socket/socket');
socketServer.initialize(server);

// Load routes from all application folders
async function loadRoutes() {
    const appsPath = path.join(__dirname, 'src');
    try {
        const items = fs.readdirSync(appsPath);
        const folders = (await Promise.all(
            items.map(async item => {
                const stat = fs.statSync(path.join(appsPath, item));
                return { name: item, isDirectory: stat.isDirectory() };
            })
        )).filter(item => item.isDirectory && item.name !== 'middleware');

        for (const folder of folders) {
            try {
                const routePath = path.join(appsPath, folder.name, 'routes.js');
                if (fs.existsSync(routePath)) {
                    require(`./src/${folder.name}/routes`)(app);
                    console.log(`✓ Loaded routes for ${folder.name}`);
                }
            } catch (err) {
                console.error(`Error loading routes for ${folder.name}:`, err);
            }
        }
    } catch (err) {
        console.error('Error reading directories:', err);
    }
}

// Root endpoint
app.get('/', (req, res) => {
    res.send('API service is running');
});

// Load all routes
loadRoutes().then(() => {
    console.log('✓ All routes loaded');

    // 404 handler
    app.all('*', (req, res) => {
        res.status(404).json({ error: 'Route not found' });
    });

    // Start server
    const PORT = process.env.PORT || 8888;
    server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
});

