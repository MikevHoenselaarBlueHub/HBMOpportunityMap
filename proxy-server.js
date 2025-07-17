
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();

// Proxy middleware voor admin routes
const adminProxy = createProxyMiddleware({
    target: 'http://localhost:3000',
    changeOrigin: true,
    pathRewrite: {
        '^/admin': '/admin'
    },
    onError: (err, req, res) => {
        console.error('Proxy error:', err);
        res.status(503).send('Admin service temporarily unavailable');
    }
});

// Admin routes proxy
app.use('/admin', adminProxy);

// Serve static files voor de hoofdapplicatie
app.use(express.static('.', {
    index: 'index.html'
}));

// Fallback voor SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Proxy server draait op poort ${PORT}`);
    console.log(`Admin toegankelijk via /admin/`);
});
