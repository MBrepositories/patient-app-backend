const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Madhavbaug Patient App API',
      version: '1.0.0',
      description: 'Backend API documentation for Madhavbaug Patient Mobile Application',
    },
    servers: [
      { url: 'https://powderblue-snake-781644.hostingersite.com/api', description: 'Production' },
      { url: 'http://localhost:8080/api', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.js'],
};

module.exports = swaggerJsdoc(options);
