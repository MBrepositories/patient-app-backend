const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./src/config/swagger');

const authRoutes = require('./src/routes/auth.routes');
const profileRoutes = require('./src/routes/profile.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');
const branchRoutes = require('./src/routes/branch.routes');
const careplanRoutes = require('./src/routes/careplan.routes');
const medicinesRoutes = require('./src/routes/medicines.routes');
const activityRoutes = require('./src/routes/activity.routes');
const exerciseRoutes = require('./src/routes/exercise.routes');
const chatRoutes = require('./src/routes/chat.routes');
const surveyRoutes = require('./src/routes/survey.routes');
const { stepsRouter, walkingRouter } = require('./src/routes/steps.routes');
const vitalsRoutes = require('./src/routes/vitals.routes');
const rewardsRoutes = require('./src/routes/rewards.routes');
const appointmentsRoutes = require('./src/routes/appointments.routes');
const { dietRouter, dietchartRouter, mealsRouter, foodsRouter } = require('./src/routes/diet.routes');
const adherenceRoutes = require('./src/routes/adherence.routes');
const historyRoutes = require('./src/routes/history.routes');
const careplanSummaryRoutes = require('./src/routes/careplan.summary.routes');
const doctorRoutes = require('./src/routes/doctor/doctor.routes');
const doctorPatientChatRoutes = require('./src/routes/doctor-patient-chat.routes');
const publicRoutes = require('./src/routes/public.routes');
const notificationsRoutes = require('./src/routes/notifications.routes');
const sleepRoutes = require('./src/routes/sleep.routes');
const patientRoutes = require('./src/routes/patient.routes');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/careplan-master', careplanRoutes);
app.use('/api/medicines', medicinesRoutes);
app.use('/api/medicine', medicinesRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/exercise', exerciseRoutes);
app.use('/api/wellness', exerciseRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/survey', surveyRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/diet', dietRouter);
app.use('/api/dietchart', dietchartRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/foods', foodsRouter);
app.use('/api/adherence', adherenceRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/careplan', careplanSummaryRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/doctor-patient-chat', doctorPatientChatRoutes);
app.use('/api/doctors', appointmentsRoutes);
app.use('/api/steps', stepsRouter);
app.use('/api/walking', walkingRouter);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/sleep', sleepRoutes);
app.use('/api/patient', patientRoutes);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));

// Global error handler
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({ success: false, message: err.message || 'Internal server error.' });
});

module.exports = app;