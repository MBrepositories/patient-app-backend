const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getBookingOptions, getDoctorProfile, bookAppointment, getAppointmentsList, getAppointmentSummary, getRescheduleOptions, confirmReschedule, getCancelOptions, confirmCancel } = require('../controllers/appointments.controller');

/**
 * @swagger
 * /appointments/booking-options:
 *   get:
 *     summary: Get doctors list and patient status for booking
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Booking options fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     doctors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: dr-5
 *                           name:
 *                             type: string
 *                             example: Dr. Rajesh Kumar
 *                           specialty:
 *                             type: string
 *                             example: Diabetologist
 *                           rating:
 *                             type: number
 *                             example: 4.8
 *                           experienceLabel:
 *                             type: string
 *                             example: 12+ Years Exp.
 *                           nextAvailableLabel:
 *                             type: string
 *                             example: Today
 *                     totalFoundCount:
 *                       type: integer
 *                       example: 3
 *                     patientStatus:
 *                       type: string
 *                       enum: [new, existing]
 *                       example: existing
 *                     newPatientPolicy:
 *                       type: object
 */
router.get('/booking-options', authenticate, getBookingOptions);

/**
 * @swagger
 * /doctors/{doctorId}/profile:
 *   get:
 *     summary: Get doctor profile with available time slots
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: doctorId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Doctor's user ID (dbId from booking-options)
 *       - in: query
 *         name: date
 *         required: false
 *         schema:
 *           type: string
 *           example: "2026-08-24"
 *         description: Date to check slots for (defaults to today)
 *     responses:
 *       200:
 *         description: Doctor profile fetched successfully
 */
router.get('/:doctorId/profile', authenticate, getDoctorProfile);

/**
 * @swagger
 * /appointments/book:
 *   post:
 *     summary: Book an appointment with a doctor
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [doctorId, isoDate, timeSlot]
 *             properties:
 *               doctorId:
 *                 type: integer
 *                 example: 1745
 *               isoDate:
 *                 type: string
 *                 example: "2026-08-24"
 *               dateLabel:
 *                 type: string
 *                 example: "Mon, Aug 24"
 *               timeSlot:
 *                 type: string
 *                 example: "10:00 AM"
 *               branchId:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       200:
 *         description: Appointment booked successfully
 */
router.post('/book', authenticate, bookAppointment);

/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: Get patient's upcoming and history appointments
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Appointments list fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     upcoming:
 *                       type: array
 *                       items:
 *                         type: object
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 */
router.get('/', authenticate, getAppointmentsList);

/**
 * @swagger
 * /appointments/{id}/summary:
 *   get:
 *     summary: Get appointment detail and summary
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appointment DB id (from appointments list)
 *     responses:
 *       200:
 *         description: Appointment summary fetched successfully
 */
router.get('/:id/summary', authenticate, getAppointmentSummary);

/**
 * @swagger
 * /appointments/{id}/reschedule:
 *   get:
 *     summary: Get reschedule options for an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appointment DB id
 *     responses:
 *       200:
 *         description: Reschedule options fetched successfully
 */
router.get('/:id/reschedule', authenticate, getRescheduleOptions);

/**
 * @swagger
 * /appointments/{id}/reschedule:
 *   post:
 *     summary: Confirm rescheduling of an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [newDateIso, newTimeLabel]
 *             properties:
 *               newDateIso:
 *                 type: string
 *                 example: "2026-08-25"
 *               newTimeLabel:
 *                 type: string
 *                 example: "10:00 AM"
 *               reason:
 *                 type: string
 *                 example: "Schedule conflict"
 *     responses:
 *       200:
 *         description: Appointment rescheduled successfully
 */
router.post('/:id/reschedule', authenticate, confirmReschedule);

/**
 * @swagger
 * /appointments/{id}/cancel:
 *   get:
 *     summary: Get cancel reasons for an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cancel options fetched successfully
 */
router.get('/:id/cancel', authenticate, getCancelOptions);

/**
 * @swagger
 * /appointments/{id}/cancel:
 *   post:
 *     summary: Confirm cancellation of an appointment
 *     tags: [Appointments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reasonId]
 *             properties:
 *               reasonId:
 *                 type: string
 *                 example: "schedule-conflict"
 *               comments:
 *                 type: string
 *                 example: "Going out of town"
 *     responses:
 *       200:
 *         description: Appointment cancelled successfully
 */
router.post('/:id/cancel', authenticate, confirmCancel);

module.exports = router;
