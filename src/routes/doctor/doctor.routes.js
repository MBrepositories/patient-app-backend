const express = require('express');
const router = express.Router();
const { authenticateDoctor } = require('../../middleware/auth');
const { getDoctorSchedule } = require('../../controllers/doctor/schedule.controller');
const { getDashboardOverview } = require('../../controllers/doctor/dashboard.controller');
const { getAppointmentDetails, getVisitSession, completeVisit, getRescheduleOptions, confirmReschedule, getCancelOptions, confirmCancel } = require('../../controllers/doctor/appointments.controller');
const { getMessages } = require('../../controllers/doctor/messages.controller');
const { getFoodLogs } = require('../../controllers/doctor/food-logs.controller');
const { getEnrolledPatients, searchPatients, enrollPatient } = require('../../controllers/doctor/enrolled-patients.controller');
const { getPatients } = require('../../controllers/doctor/patients.controller');
const { getPatientExerciseCompliance } = require('../../controllers/doctor/exercise-compliance.controller');
const { getPatientCasePaper } = require('../../controllers/doctor/case-paper.controller');
const { getDoctorChatHistory, sendDoctorMessage } = require('../../services/doctor-patient-chat.service');
const { getAlerts } = require('../../services/doctor/alerts.service');
const { updatePatientDosage } = require('../../controllers/doctor/medicines.controller');

/**
 * @swagger
 * /doctor/schedule:
 *   get:
 *     summary: Get doctor's appointment schedule
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by patient name
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           example: "2026-08-25"
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           example: "2026-08-25"
 *         description: End date filter (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Schedule fetched successfully
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
 *                     totalCount:
 *                       type: integer
 *                       example: 12
 *                     appointments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "220478"
 *                           patientName:
 *                             type: string
 *                             example: Ramesh Sharma
 *                           uhid:
 *                             type: string
 *                             example: MB268841
 *                           isoDate:
 *                             type: string
 *                             example: "2026-08-26"
 *                           timeSlotLabel:
 *                             type: string
 *                             example: "10:30 AM"
 *                           appointmentTypeLabel:
 *                             type: string
 *                             example: Consultation
 *                           statusLabel:
 *                             type: string
 *                             example: Confirmed & Paid
 *                           statusVariant:
 *                             type: string
 *                             enum: [confirmed, confirmedPaid, pending]
 */
router.get('/schedule', authenticateDoctor, getDoctorSchedule);

/**
 * @swagger
 * /doctor/dashboard/overview:
 *   get:
 *     summary: Get doctor dashboard overview with stats and critical alerts
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard overview fetched successfully
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
 *                     stats:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: patients
 *                           value:
 *                             type: string
 *                             example: "24"
 *                           label:
 *                             type: string
 *                             example: Patients
 *                     criticalAlerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: alert-1
 *                           patientName:
 *                             type: string
 *                             example: Ramesh Sharma
 *                           phoneNumber:
 *                             type: string
 *                             example: "9876543210"
 *                           severity:
 *                             type: string
 *                             example: critical
 *                           metrics:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 label:
 *                                   type: string
 *                                   example: BP Systolic
 *                                 value:
 *                                   type: string
 *                                   example: 165 mmHg
 *                           highlightMetric:
 *                             type: object
 *                             properties:
 *                               label:
 *                                 type: string
 *                                 example: Blood Pressure
 *                               value:
 *                                 type: string
 *                                 example: 165/98 mmHg
 */
router.get('/dashboard/overview', authenticateDoctor, getDashboardOverview);

/**
 * @swagger
 * /doctor/appointments/{appointmentId}:
 *   get:
 *     summary: Get appointment details for doctor
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Appointment details fetched successfully
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
 *                     id:
 *                       type: string
 *                       example: "220478"
 *                     patientName:
 *                       type: string
 *                       example: Ramesh Sharma
 *                     uhid:
 *                       type: string
 *                       example: MB268841
 *                     ageGenderLabel:
 *                       type: string
 *                       example: 45 Years / Male
 *                     dateTimeLabel:
 *                       type: string
 *                       example: "Aug 26, 2026, 10:30 AM"
 *                     durationLabel:
 *                       type: string
 *                       example: 15 mins
 *                     consultationTypeLabel:
 *                       type: string
 *                       example: In-Person Clinic Visit
 *                     branchLocationLabel:
 *                       type: string
 *                       example: "Madhavbaug Clinic, Mumbai"
 *                     vitals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: bp
 *                           label:
 *                             type: string
 *                             example: Blood Pressure
 *                           value:
 *                             type: string
 *                             example: "128/82"
 *                           unit:
 *                             type: string
 *                             example: mmHg
 *                           status:
 *                             type: string
 *                             enum: [normal, high, low]
 *                           trend:
 *                             type: string
 *                             enum: [up, down, flat]
 *                           iconName:
 *                             type: string
 *                             example: monitor-heart
 *                     previousNotes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: note-1
 *                           dateLabel:
 *                             type: string
 *                             example: "Aug 10, 2026"
 *                           text:
 *                             type: string
 *                             example: Patient reported chest pain
 *       404:
 *         description: Appointment not found
 */
router.get('/appointments/:appointmentId', authenticateDoctor, getAppointmentDetails);

/**
 * @swagger
 * /doctor/appointments/{appointmentId}/visit-session:
 *   get:
 *     summary: Get visit session data to start a consultation
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Visit session data fetched successfully
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
 *                     appointmentId:
 *                       type: string
 *                       example: "220478"
 *                     patientName:
 *                       type: string
 *                       example: Ramesh Sharma
 *                     patientInitials:
 *                       type: string
 *                       example: RS
 *                     genderAgeLabel:
 *                       type: string
 *                       example: "Male, 45 Years"
 *                     patientCode:
 *                       type: string
 *                       example: "#MB268841"
 *                     hasHighAlertAllergies:
 *                       type: boolean
 *                       example: false
 *                     isInpatient:
 *                       type: boolean
 *                       example: false
 *                     medicalHistory:
 *                       type: object
 *                       properties:
 *                         chronicConditions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["Hypertension", "Type 2 Diabetes"]
 *                         recentSurgeryLabel:
 *                           type: string
 *                           example: No recent surgery on record.
 *                         familyHistoryLabel:
 *                           type: string
 *                           example: Not available.
 *                     vitals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           label:
 *                             type: string
 *                           value:
 *                             type: string
 *                           unit:
 *                             type: string
 *                           status:
 *                             type: string
 *                           iconName:
 *                             type: string
 *                     clinicalNoteDraft:
 *                       type: string
 *                       example: ""
 *                     diagnoses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           code:
 *                             type: string
 *                             example: DX-1
 *                           label:
 *                             type: string
 *                             example: Hypertension
 *       404:
 *         description: Appointment not found
 */
router.get('/appointments/:appointmentId/visit-session', authenticateDoctor, getVisitSession);

/**
 * @swagger
 * /doctor/appointments/{appointmentId}/complete:
 *   post:
 *     summary: Complete and finalize a visit
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Visit completed successfully
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
 *                     appointmentId:
 *                       type: string
 *                       example: "220478"
 *                     patientName:
 *                       type: string
 *                       example: Ramesh Sharma
 *                     durationLabel:
 *                       type: string
 *                       example: 30 mins
 *                     notesStatusLabel:
 *                       type: string
 *                       example: Saved to record
 *                     notesSecondaryLabel:
 *                       type: string
 *                       example: Encrypted & Archived
 *                     sessionId:
 *                       type: string
 *                       example: HCP-220478-RS-2026
 *                     isFinalized:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: Appointment not found
 */
router.post('/appointments/:appointmentId/complete', authenticateDoctor, completeVisit);

/**
 * @swagger
 * /doctor/appointments/{appointmentId}/reschedule:
 *   get:
 *     summary: Get available time slots for rescheduling
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Reschedule options fetched successfully
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
 *                     appointmentId:
 *                       type: string
 *                       example: "220478"
 *                     patientName:
 *                       type: string
 *                       example: Ramesh Sharma
 *                     patientInitials:
 *                       type: string
 *                       example: RS
 *                     originalDateLabel:
 *                       type: string
 *                       example: "Aug 26, 2026"
 *                     originalTimeLabel:
 *                       type: string
 *                       example: "10:30 AM"
 *                     selectedDateIso:
 *                       type: string
 *                       example: "2026-08-26"
 *                     defaultSelectedSlotId:
 *                       type: string
 *                       nullable: true
 *                       example: slot-1030
 *                     timeSlots:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: slot-1030
 *                           label:
 *                             type: string
 *                             example: "10:30 AM"
 *                           period:
 *                             type: string
 *                             enum: [morning, afternoon, evening]
 *                           available:
 *                             type: boolean
 *                             example: true
 *       404:
 *         description: Appointment not found
 */
router.get('/appointments/:appointmentId/reschedule', authenticateDoctor, getRescheduleOptions);

/**
 * @swagger
 * /doctor/appointments/{appointmentId}/reschedule:
 *   post:
 *     summary: Confirm rescheduling to a new date and time
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *                 example: "2026-08-28"
 *               newTimeLabel:
 *                 type: string
 *                 example: "11:00 AM"
 *               reason:
 *                 type: string
 *                 example: Doctor unavailable
 *     responses:
 *       200:
 *         description: Appointment rescheduled successfully
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
 *                     appointmentId:
 *                       type: string
 *                       example: "220478"
 *                     confirmationCode:
 *                       type: string
 *                       example: TX-0478
 *                     patientName:
 *                       type: string
 *                       example: Ramesh Sharma
 *                     previousDateLabel:
 *                       type: string
 *                       example: "Aug 26, 2026"
 *                     previousTimeLabel:
 *                       type: string
 *                       example: "10:30 AM"
 *                     newDateLabel:
 *                       type: string
 *                       example: "Aug 28, 2026"
 *                     newTimeLabel:
 *                       type: string
 *                       example: "11:00 AM"
 *                     smsSent:
 *                       type: boolean
 *                       example: true
 *                     emailSent:
 *                       type: boolean
 *                       example: true
 *       409:
 *         description: Time slot conflict or same slot selected
 *       404:
 *         description: Appointment not found
 */
router.post('/appointments/:appointmentId/reschedule', authenticateDoctor, confirmReschedule);

/**
 * @swagger
 * /doctor/appointments/{appointmentId}/cancel:
 *   get:
 *     summary: Get cancellation reason options
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Cancel options fetched successfully
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
 *                     appointmentId:
 *                       type: string
 *                       example: "220478"
 *                     patientName:
 *                       type: string
 *                       example: Ramesh Sharma
 *                     defaultReasonId:
 *                       type: string
 *                       example: patient-unavailable
 *                     reasons:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: patient-unavailable
 *                           label:
 *                             type: string
 *                             example: Patient Unavailable
 *                           iconName:
 *                             type: string
 *                             example: person-off
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Already cancelled or completed
 */
router.get('/appointments/:appointmentId/cancel', authenticateDoctor, getCancelOptions);

/**
 * @swagger
 * /doctor/appointments/{appointmentId}/cancel:
 *   post:
 *     summary: Confirm cancellation of an appointment
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *                 enum: [patient-unavailable, doctor-unavailable, schedule-conflict, emergency]
 *                 example: patient-unavailable
 *               comments:
 *                 type: string
 *                 example: Patient requested cancellation
 *     responses:
 *       200:
 *         description: Appointment cancelled successfully
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
 *                     appointmentId:
 *                       type: string
 *                       example: "220478"
 *                     patientName:
 *                       type: string
 *                       example: Ramesh Sharma
 *                     reasonLabel:
 *                       type: string
 *                       example: Patient Unavailable
 *                     notificationSent:
 *                       type: boolean
 *                       example: true
 *       404:
 *         description: Appointment not found
 *       409:
 *         description: Already cancelled or completed
 */
router.post('/appointments/:appointmentId/cancel', authenticateDoctor, confirmCancel);

/**
 * @swagger
 * /doctor/messages:
 *   get:
 *     summary: Get doctor's message threads
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: filter
 *         schema:
 *           type: string
 *           enum: [all, unread, urgent, followUp]
 *     responses:
 *       200:
 *         description: Messages fetched successfully
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
 *                     unreadCount:
 *                       type: integer
 *                       example: 3
 *                     threads:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: thread-1
 *                           patientName:
 *                             type: string
 *                             example: Eleanor Vance
 *                           avatarInitials:
 *                             type: string
 *                             example: EV
 *                           previewText:
 *                             type: string
 *                             example: I've been feeling dizzy after the new medication.
 *                           timestampLabel:
 *                             type: string
 *                             example: "10:43 AM"
 *                           isUnread:
 *                             type: boolean
 *                             example: true
 *                           isUrgent:
 *                             type: boolean
 *                             example: false
 *                           isFollowUp:
 *                             type: boolean
 *                             example: false
 */
router.get('/messages', authenticateDoctor, getMessages);

/**
 * @swagger
 * /doctor/food-logs:
 *   get:
 *     summary: Get food logs monitoring for doctor
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: riskLevel
 *         schema:
 *           type: string
 *           enum: [all, critical, high, normal]
 *       - in: query
 *         name: mealType
 *         schema:
 *           type: string
 *           enum: [all, breakfast, lunch, dinner, snack]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Food logs fetched successfully
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalLogs24h:
 *                           type: integer
 *                           example: 42
 *                         criticalCount:
 *                           type: integer
 *                           example: 3
 *                         highCount:
 *                           type: integer
 *                           example: 8
 *                         visualCompliancePercent:
 *                           type: integer
 *                           example: 74
 *                         complianceStatusLabel:
 *                           type: string
 *                           example: Moderate
 *                     filterOptions:
 *                       type: object
 *                       properties:
 *                         riskLevels:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               label:
 *                                 type: string
 *                         mealTypes:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               label:
 *                                 type: string
 *                     entries:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: food-log-1
 *                           patientName:
 *                             type: string
 *                             example: Ramesh Sharma
 *                           patientInitials:
 *                             type: string
 *                             example: RS
 *                           patientCode:
 *                             type: string
 *                             example: "#MB268841"
 *                           timestampLabel:
 *                             type: string
 *                             example: "Today 09:15 AM"
 *                           mealTypeLabel:
 *                             type: string
 *                             example: Breakfast
 *                           nutrientsLabel:
 *                             type: string
 *                             example: 350 kcal
 *                           description:
 *                             type: string
 *                             example: Oats with milk
 *                           riskLevel:
 *                             type: string
 *                             enum: [normal, high, critical]
 *                           riskTagLabel:
 *                             type: string
 *                             example: HIGH CALORIES
 *                     totalEntries:
 *                       type: integer
 *                       example: 42
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 10
 */
router.get('/food-logs', authenticateDoctor, getFoodLogs);

/**
 * @swagger
 * /doctor/enrolled-patients:
 *   get:
 *     summary: Get list of patients enrolled in care plans under this doctor
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by patient name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [all, active, completed, inactive]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           example: "2026-08-01"
 *         description: Filter by enrollment date from (YYYY-MM-DD)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           example: "2026-08-31"
 *         description: Filter by enrollment date to (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Enrolled patients fetched successfully
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
 *                     totalCount:
 *                       type: integer
 *                       example: 18
 *                     patients:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: enrolled-12
 *                           patientId:
 *                             type: string
 *                             example: patient-1176054
 *                           name:
 *                             type: string
 *                             example: Ramesh Sharma
 *                           initials:
 *                             type: string
 *                             example: RS
 *                           patientCode:
 *                             type: string
 *                             example: MB268841
 *                           programName:
 *                             type: string
 *                             example: Diabetes Care Plan
 *                           programIconName:
 *                             type: string
 *                             example: bloodtype
 *                           enrolledDateLabel:
 *                             type: string
 *                             example: "Aug 1, 2026"
 *                           status:
 *                             type: string
 *                             example: active
 *                           statusLabel:
 *                             type: string
 *                             example: Active
 */
router.get('/enrolled-patients', authenticateDoctor, getEnrolledPatients);

/**
 * @swagger
 * /doctor/patients/search:
 *   get:
 *     summary: Search patients by phone number or UHID
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: Phone number or UHID (patient_id) to search
 *         example: "9876543210"
 *     responses:
 *       200:
 *         description: Search results
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
 *                     totalCount:
 *                       type: integer
 *                       example: 1
 *                     patients:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           patientId:
 *                             type: string
 *                             example: patient-1176054
 *                           patientDbId:
 *                             type: integer
 *                             example: 1176054
 *                           name:
 *                             type: string
 *                             example: Ramesh Sharma
 *                           initials:
 *                             type: string
 *                             example: RS
 *                           patientCode:
 *                             type: string
 *                             example: MB268841
 *                           phone:
 *                             type: string
 *                             example: "9876543210"
 *                           ageGenderLabel:
 *                             type: string
 *                             example: "45 yrs / Male"
 */
router.get('/patients/search', authenticateDoctor, searchPatients);

/**
 * @swagger
 * /doctor/enrolled-patients:
 *   post:
 *     summary: Enroll a patient into a care plan
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [patientId, planId]
 *             properties:
 *               patientId:
 *                 type: string
 *                 example: "patient-1176054"
 *               planId:
 *                 type: integer
 *                 example: 2
 *               branchId:
 *                 type: string
 *                 example: "branch-14"
 *     responses:
 *       200:
 *         description: Patient enrolled successfully
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
 *                     id:
 *                       type: string
 *                       example: enrolled-42
 *                     patientId:
 *                       type: string
 *                       example: patient-1176054
 *                     patientDbId:
 *                       type: integer
 *                       example: 1176054
 *                     name:
 *                       type: string
 *                       example: Ramesh Sharma
 *                     initials:
 *                       type: string
 *                       example: RS
 *                     patientCode:
 *                       type: string
 *                       example: MB268841
 *                     programName:
 *                       type: string
 *                       example: Diabetes Care Plan
 *                     programIconName:
 *                       type: string
 *                       example: bloodtype
 *                     enrolledDateLabel:
 *                       type: string
 *                       example: "Sep 7, 2026"
 *                     status:
 *                       type: string
 *                       example: active
 *                     statusLabel:
 *                       type: string
 *                       example: Active
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Patient or care plan not found
 */
router.post('/enrolled-patients', authenticateDoctor, enrollPatient);

/**
 * @swagger
 * /doctor/patients:
 *   get:
 *     summary: Get all patients assigned to this doctor
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Patients fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: patient-1176054
 *                       name:
 *                         type: string
 *                         example: Ramesh Sharma
 *                       email:
 *                         type: string
 *                         example: ramesh@example.com
 *                       phone:
 *                         type: string
 *                         example: "9876543210"
 *                       severity:
 *                         type: string
 *                         enum: [none, warning, critical]
 *                       bpValue:
 *                         type: string
 *                         example: 128 mmHg
 *                       bpStatus:
 *                         type: string
 *                         enum: [normal, high]
 *                       heartRateValue:
 *                         type: string
 *                         example: N/A
 *                       patientIdLabel:
 *                         type: string
 *                         example: MB268841
 */
router.get('/patients', authenticateDoctor, getPatients);

/**
 * @swagger
 * /doctor/patients/{patientId}/exercise-compliance:
 *   get:
 *     summary: Get 7-day exercise compliance for a specific patient
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Patient's numeric DB id (patients.id)
 *     responses:
 *       200:
 *         description: Exercise compliance fetched successfully
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
 *                     targetMetPercent:
 *                       type: integer
 *                       example: 71
 *                     sessionsCompleted:
 *                       type: integer
 *                       example: 5
 *                     sessionsTarget:
 *                       type: integer
 *                       example: 7
 *                     avgHeartRate:
 *                       type: integer
 *                       nullable: true
 *                     avgDurationMinutes:
 *                       type: integer
 *                       example: 20
 *                     coachInsight:
 *                       type: string
 *                       example: "You're 2 sessions away from your weekly goal."
 *                     historyRangeLabel:
 *                       type: string
 *                       example: 7-Day History
 *                     activityLog:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: log-1
 *                           exerciseId:
 *                             type: string
 *                             example: diabetes-day-12
 *                           title:
 *                             type: string
 *                             example: Squat
 *                           subtitle:
 *                             type: string
 *                             example: Aug 25
 *                           status:
 *                             type: string
 *                             enum: [completed, missed]
 *                           exerciseScore:
 *                             type: integer
 *                             nullable: true
 *                             example: 87
 *                           repsCompleted:
 *                             type: integer
 *                             nullable: true
 *                           targetReps:
 *                             type: integer
 *                             nullable: true
 *       403:
 *         description: Patient not assigned to this doctor
 */
router.get('/patients/:patientId/exercise-compliance', authenticateDoctor, getPatientExerciseCompliance);

/**
 * @swagger
 * /doctor/patients/{patientId}/case-paper:
 *   get:
 *     summary: Get patient case paper with complaints, comorbidities and progression
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Patient's numeric DB id (patients.id)
 *     responses:
 *       200:
 *         description: Case paper fetched successfully
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
 *                     chiefComplaints:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: complaint-1
 *                           text:
 *                             type: string
 *                             example: Chest pain and breathlessness
 *                     comorbidities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: comorbidity-1
 *                           label:
 *                             type: string
 *                             example: Hypertension
 *                           emphasis:
 *                             type: boolean
 *                             example: true
 *                     progression:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: progression-1
 *                           dateLabel:
 *                             type: string
 *                             example: AUGUST 2026
 *                           title:
 *                             type: string
 *                             example: Follow-up Visit
 *                           description:
 *                             type: string
 *                             example: BP under control, continue medication.
 *                     physicianName:
 *                       type: string
 *                       example: Dr. Suhas Hardas
 *                     physicianTitle:
 *                       type: string
 *                       example: Consultant Physician
 *                     mmcRegNo:
 *                       type: string
 *                       example: "MMC Reg No: N/A"
 *       403:
 *         description: Patient not assigned to this doctor
 */
router.get('/patients/:patientId/case-paper', authenticateDoctor, getPatientCasePaper);

/**
 * @swagger
 * /doctor/patients/{patientId}/chat:
 *   get:
 *     summary: Get doctor-patient chat history (marks patient messages as read)
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Chat history fetched successfully
 *       403:
 *         description: Patient not assigned to this doctor
 */
/**
 * @swagger
 * /doctor/alerts:
 *   get:
 *     summary: Get alerts across all patients — missed medicine, exercise, diet, no activity, emergency symptoms
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alerts fetched successfully
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
 *                     totalCount:
 *                       type: integer
 *                       example: 5
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           patientId:
 *                             type: string
 *                             example: patient-1176054
 *                           patientDbId:
 *                             type: integer
 *                             example: 1176054
 *                           patientName:
 *                             type: string
 *                             example: Ishav Bhatt
 *                           type:
 *                             type: string
 *                             enum: [missedMedicine, missedExercise, missedDiet, noActivity, emergencySymptom]
 *                           message:
 *                             type: string
 *                             example: No medicine logged today
 *                           severity:
 *                             type: string
 *                             enum: [warning, critical]
 *                           timestamp:
 *                             type: string
 *                             example: "2026-09-08T10:00:00.000Z"
 */
router.get('/alerts', authenticateDoctor, async (req, res) => {
  const { success, error } = require('../../utils/response');
  try {
    const result = await getAlerts(req.user.id);
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

router.get('/patients/:patientId/chat', authenticateDoctor, async (req, res) => {
  const { success, error } = require('../../utils/response');
  try {
    const result = await getDoctorChatHistory(req.user.id, parseInt(req.params.patientId));
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /doctor/patients/{patientId}/chat:
 *   post:
 *     summary: Doctor sends a message to a patient
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Good morning! Please log your vitals today."
 *     responses:
 *       200:
 *         description: Message sent successfully
 *       403:
 *         description: Patient not assigned to this doctor
 */
router.post('/patients/:patientId/chat', authenticateDoctor, async (req, res) => {
  const { success, error } = require('../../utils/response');
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return error(res, 'text is required', 400);
    const result = await sendDoctorMessage(req.user.id, parseInt(req.params.patientId), text.trim());
    return success(res, result);
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /doctor/patients/{patientId}/medicines/{medicationId}/dosage:
 *   patch:
 *     summary: Update a patient's medicine dosage (doctor taper/edit)
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Patient's numeric DB id (patients.id)
 *       - in: path
 *         name: medicationId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Row id in patient_allopathy or patient_madhavbaug
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, dosage]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [allopathy, madhavbaug]
 *                 example: allopathy
 *               dosage:
 *                 type: object
 *                 properties:
 *                   morning:
 *                     type: number
 *                     example: 1
 *                   afternoon:
 *                     type: number
 *                     example: 0
 *                   night:
 *                     type: number
 *                     example: 1
 *                   sos:
 *                     type: number
 *                     example: 0
 *     responses:
 *       200:
 *         description: Dosage updated successfully
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
 *                     medicationId:
 *                       type: string
 *                       example: "123"
 *                     type:
 *                       type: string
 *                       example: allopathy
 *                     medicineName:
 *                       type: string
 *                       example: Metformin 500mg
 *                     dosage:
 *                       type: object
 *                       properties:
 *                         morning:
 *                           type: number
 *                           example: 1
 *                         afternoon:
 *                           type: number
 *                           example: 0
 *                         night:
 *                           type: number
 *                           example: 1
 *                         sos:
 *                           type: number
 *                           example: 0
 *       400:
 *         description: Missing required fields or invalid type
 *       404:
 *         description: Medication not found for this patient
 */
router.patch('/patients/:patientId/medicines/:medicationId/dosage', authenticateDoctor, updatePatientDosage);

module.exports = router;
