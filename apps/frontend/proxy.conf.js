module.exports = {
    '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        secure: false,
        changeOrigin: true,
        ws: true,
    },
    '/socket.io': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:3000',
        secure: false,
        changeOrigin: true,
        ws: true,
    },
};
