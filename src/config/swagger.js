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
    tags: [
      { name: 'Auth' },
      { name: 'Profile' },
      { name: 'Dashboard' },
      { name: 'Vitals', description: 'Patient self-logged and hospital vitals' },
      { name: 'Medicines' },
      { name: 'Exercise' },
      { name: 'Diet', description: 'Patient diet compliance, meal logging and food catalog' },
      { name: 'Appointments', description: 'Patient appointment booking and management' },
      { name: 'Branches' },
      { name: 'Careplans' },
      { name: 'Activity' },
      { name: 'Steps & Walking' },
      { name: 'Rewards' },
      { name: 'Survey' },
      { name: 'Chat' },
      { name: 'History' },
      { name: 'Notifications', description: 'Patient and doctor notification APIs' },
      { name: 'Sleep', description: 'Patient sleep tracking' },
      { name: 'Patient', description: 'Patient-specific APIs (medicines, popups)' },
      { name: 'Doctor', description: 'Doctor-facing APIs for schedule, patients and appointments' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        FoodItem: {
          type: 'object',
          properties: {
            id:            { type: 'string', example: 'roti' },
            name:          { type: 'string', example: 'Roti' },
            imageUrl:      { type: 'string', example: '' },
            quantityLabel: { type: 'string', example: '1 piece' },
            calories:      { type: 'integer', example: 70 },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.js', './src/routes/doctor/*.js'],
};

module.exports = swaggerJsdoc(options);
