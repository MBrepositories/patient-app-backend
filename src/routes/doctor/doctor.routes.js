const express = require('express');
const router = express.Router();
const { authenticateDoctor } = require('../../middleware/auth');

const formatTimestamp = (unixTs) => {
  if (!unixTs) return '';
  const d = new Date(Number(unixTs) * 1000);
  const now = new Date();
  const diffMins  = Math.floor((now - d) / 60000);
  const diffHours = Math.floor((now - d) / 3600000);
  const diffDays  = Math.floor((now - d) / 86400000);
  if (diffMins  < 1)  return 'now';
  if (diffMins  < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays  === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};
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
const { getPatientVitalsHandler } = require('../../controllers/doctor/vitals.controller');
const { getPatientSleepHandler } = require('../../controllers/doctor/sleep.controller');

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
 *                             description: Actual care plan name. "No care plan" if no plan assigned.
 *                             example: Annual Detox Care Plan
 *                           programIconName:
 *                             type: string
 *                             description: Icon matched from care plan name keywords (bloodtype, favorite, monitor-heart, fitness-center, spa, medical-services)
 *                             enum: [bloodtype, favorite, monitor-heart, fitness-center, spa, medical-services]
 *                             example: spa
 *                           enrolledDateLabel:
 *                             type: string
 *                             description: Enrollment date formatted as "Sep 9, 2026". Empty string if no plan assigned.
 *                             example: "Sep 9, 2026"
 *                           status:
 *                             type: string
 *                             enum: [active, completed, inactive]
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
 *                       lastActiveAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: "2026-10-20T14:32:00.000Z"
 *                       activityStatus:
 *                         type: string
 *                         enum: [active, inactive]
 *                         example: active
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
 * /doctor/patients/{patientId}/vitals:
 *   get:
 *     summary: Get all vitals of a patient with readings for the selected range
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Patient's numeric ID
 *       - in: query
 *         name: range
 *         required: false
 *         schema:
 *           type: string
 *           enum: [7D, 30D, 90D, All]
 *           default: 30D
 *         description: Date range for readings
 *     responses:
 *       200:
 *         description: Patient vitals fetched successfully
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
 *                     vitals:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             example: blood_pressure
 *                           label:
 *                             type: string
 *                             example: Blood Pressure
 *                           unit:
 *                             type: string
 *                             example: mmHg
 *                           readings:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 recordedAt:
 *                                   type: string
 *                                   example: "2026-09-30T04:11:00.000Z"
 *                                 value:
 *                                   type: number
 *                                   example: 125
 *                                 secondaryValue:
 *                                   type: number
 *                                   nullable: true
 *                                   example: 82
 *                                 status:
 *                                   type: string
 *                                   enum: [normal, high, low]
 *                                   example: normal
 *       403:
 *         description: Patient not assigned to this doctor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Patient not assigned to this doctor.
 *       404:
 *         description: Patient not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: Patient not found.
 */
router.get('/patients/:patientId/vitals', authenticateDoctor, getPatientVitalsHandler);

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
 *                     patientName:
 *                       type: string
 *                       example: Ishav Bhatt
 *                     patientInitials:
 *                       type: string
 *                       example: IB
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           kind:
 *                             type: string
 *                             enum: [message, activity]
 *                           id:
 *                             type: string
 *                             example: msg-106
 *                           sender:
 *                             type: string
 *                             enum: [patient, doctor, ai]
 *                           text:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [delivered, read]
 *                           timeLabel:
 *                             type: string
 *                             example: "Fri, 8:19 PM"
 *                           createdAt:
 *                             type: string
 *                             example: "2026-09-04T14:49:51.000Z"
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

/**
 * @swagger
 * /doctor/notifications:
 *   get:
 *     summary: Get doctor's notifications (meal logs, medicine taken) from patients
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: Notifications fetched successfully
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
 *                     total:
 *                       type: integer
 *                       example: 12
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     pageSize:
 *                       type: integer
 *                       example: 20
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "42"
 *                           type:
 *                             type: string
 *                             enum: [meal, medication]
 *                             example: meal
 *                           title:
 *                             type: string
 *                             description: '"Meal Logged" for meals, "Medicine Taken" for medication'
 *                             example: "Meal Logged"
 *                           message:
 *                             type: string
 *                             description: '"Patient Name logged Lunch" for meals, "Patient marked Morning dose as taken" for medication'
 *                             example: "Ramesh Sharma logged Lunch"
 *                           photoUrl:
 *                             type: string
 *                             nullable: true
 *                             example: "https://example.com/uploads/meal.jpg"
 *                           patientId:
 *                             type: integer
 *                             nullable: true
 *                             example: 1176054
 *                           isUnread:
 *                             type: boolean
 *                             example: true
 *                           timestamp:
 *                             type: string
 *                             example: "5m ago"
 */
router.get('/notifications', authenticateDoctor, async (req, res) => {
  const { success, error } = require('../../utils/response');
  try {
    const page     = parseInt(req.query.page)     || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const doctorId = req.user.id;

    const [[{ unreadCount }]] = await require('../../config/db').query(
      `SELECT COUNT(*) AS unreadCount FROM app_notifications
       WHERE doctor_id = ? AND is_read = 0`,
      [doctorId]
    );

    const [[{ total }]] = await require('../../config/db').query(
      `SELECT COUNT(*) AS total FROM app_notifications WHERE doctor_id = ?`,
      [doctorId]
    );

    const offset = (page - 1) * pageSize;
    const [rows] = await require('../../config/db').query(
      `SELECT id, type, title, message, photo_url, patient_id_ref AS patientId, is_read,
              UNIX_TIMESTAMP(created_at) AS ts
       FROM app_notifications
       WHERE doctor_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [doctorId, pageSize, offset]
    );

    return success(res, {
      unreadCount,
      total,
      page,
      pageSize,
      notifications: rows.map(r => ({
        id:        String(r.id),
        type:      r.type,
        title:     r.title,
        message:   r.message,
        photoUrl:  r.photo_url || null,
        patientId: r.patientId || null,
        isUnread:  r.is_read === 0,
        timestamp: formatTimestamp(r.ts),
      })),
    });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /doctor/notifications/{id}/read:
 *   post:
 *     summary: Mark a single doctor notification as read
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
router.post('/notifications/:id/read', authenticateDoctor, async (req, res) => {
  const { success, error } = require('../../utils/response');
  try {
    const [result] = await require('../../config/db').query(
      `UPDATE app_notifications SET is_read = 1 WHERE id = ? AND doctor_id = ?`,
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return error(res, 'Notification not found', 404);
    return success(res, { updated: true });
  } catch (err) {
    return error(res, err.message, err.statusCode || 500);
  }
});

/**
 * @swagger
 * /doctor/notifications/read-all:
 *   post:
 *     summary: Mark all doctor notifications as read
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/notifications/read-all', authenticateDoctor, async (req, res) => {
  const { success, error } = require('../../utils/response');
  try {
    await require('../../config/db').query(
      `UPDATE app_notifications SET is_read = 1 WHERE doctor_id = ? AND is_read = 0`,
      [req.user.id]
    );
    return success(res, { updated: true });
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
 *                     kind:
 *                       type: string
 *                       example: message
 *                     id:
 *                       type: string
 *                       example: msg-184
 *                     sender:
 *                       type: string
 *                       example: doctor
 *                     senderName:
 *                       type: string
 *                       example: Dr. Ishav Bhatt
 *                     text:
 *                       type: string
 *                       example: How are you feeling today?
 *                     status:
 *                       type: string
 *                       example: delivered
 *                     timeLabel:
 *                       type: string
 *                       example: "11:41 AM"
 *                     createdAt:
 *                       type: string
 *                       example: "2026-10-01T06:11:14.741Z"
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
 * /doctor/patients/{patientId}/medicines:
 *   post:
 *     summary: Add a medicine to a patient (doctor prescribes via app)
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [medicineName]
 *             properties:
 *               medicineName:
 *                 type: string
 *                 example: Metformin 500mg
 *               formLabel:
 *                 type: string
 *                 example: TABLET
 *                 default: TABLET
 *               morning:
 *                 type: number
 *                 example: 1
 *                 default: 0
 *               afternoon:
 *                 type: number
 *                 example: 0
 *                 default: 0
 *               night:
 *                 type: number
 *                 example: 1
 *                 default: 0
 *               sos:
 *                 type: number
 *                 example: 0
 *                 default: 0
 *               instructions:
 *                 type: string
 *                 example: Take after food
 *               category:
 *                 type: string
 *                 enum: [madhavbaug, allopathy]
 *                 nullable: true
 *                 description: Medicine group for display tab. Also accepted as "type" field (e.g. type:"allopathy"). "type":"app" is always returned in response regardless.
 *                 example: allopathy
 *               type:
 *                 type: string
 *                 enum: [madhavbaug, allopathy]
 *                 nullable: true
 *                 description: Alias for category — send either "type" or "category". Do not send "app" here; that is set automatically.
 *                 example: allopathy
 *     responses:
 *       201:
 *         description: Medicine added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 medicine:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: app-12
 *                     medicineId:
 *                       type: integer
 *                     type:
 *                       type: string
 *                       example: app
 *                       description: Always "app" for doctor-added medicines
 *                     category:
 *                       type: string
 *                       enum: [madhavbaug, allopathy]
 *                       nullable: true
 *                       description: Display tab — "allopathy" or "madhavbaug". Null if not specified.
 *                       example: allopathy
 *                     name:
 *                       type: string
 *                       example: Metformin 500mg
 *                     formLabel:
 *                       type: string
 *                       example: TABLET
 *                     doses:
 *                       type: object
 *                       properties:
 *                         morning:
 *                           type: number
 *                         afternoon:
 *                           type: number
 *                         night:
 *                           type: number
 *                         sos:
 *                           type: number
 *                     instructions:
 *                       type: string
 *       400:
 *         description: medicineName is required
 *       404:
 *         description: Patient not found
 */
router.post('/patients/:patientId/medicines', authenticateDoctor, async (req, res) => {
  try {
    const { addPatientMedicine } = require('../../services/medicines.service');
    const patientId = parseInt(req.params.patientId, 10);
    const medicine = await addPatientMedicine(req.user.id, patientId, req.body);
    res.status(201).json({ success: true, medicine });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /doctor/patients/{patientId}/medicines:
 *   get:
 *     summary: Get all medicines for a patient (clinic + app-added)
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
 *         description: Medicines fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 medicines:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: app-2
 *                       type:
 *                         type: string
 *                         enum: [madhavbaug, allopathy, app]
 *                         description: Source type. "app" = doctor-added via app.
 *                       category:
 *                         type: string
 *                         enum: [madhavbaug, allopathy]
 *                         nullable: true
 *                         description: Display tab for app medicines. Null for madhavbaug/allopathy type (they use type directly).
 *                         example: allopathy
 *                       name:
 *                         type: string
 *                       formLabel:
 *                         type: string
 *                       doses:
 *                         type: object
 *                       instructions:
 *                         type: string
 *                         nullable: true
 *                       courseDays:
 *                         type: integer
 *                         nullable: true
 *                       startDate:
 *                         type: string
 *                         nullable: true
 */
router.get('/patients/:patientId/medicines', authenticateDoctor, async (req, res) => {
  try {
    const { getPatientMedicines } = require('../../services/medicines.service');
    const patientId = parseInt(req.params.patientId, 10);
    const result = await getPatientMedicines(patientId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
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
 *         description: Row id in patient_allopathy, patient_madhavbaug, or app_patient_medicines
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
 *                 enum: [allopathy, madhavbaug, app]
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

/**
 * @swagger
 * /doctor/patients/{patientId}/medicine-adherence:
 *   get:
 *     summary: Get patient's 7-day medicine adherence (doctor view)
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
 *         description: Medicine adherence fetched successfully
 */
router.get('/patients/:patientId/medicine-adherence', authenticateDoctor, async (req, res) => {
  try {
    const { getMedicineAdherence } = require('../../services/medicines.service');
    const patientId = parseInt(req.params.patientId, 10);
    const result = await getMedicineAdherence(patientId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /doctor/patients/{patientId}/medicines/{medicineId}/history:
 *   get:
 *     summary: Get per-medicine taken/missed history for last 30 days
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: medicineId
 *         required: true
 *         schema:
 *           type: string
 *         description: e.g. "app-2", "madhav-5", "allo-10"
 *     responses:
 *       200:
 *         description: Medicine history fetched
 */
router.get('/patients/:patientId/medicines/:medicineId/history', authenticateDoctor, async (req, res) => {
  try {
    const db = require('../../config/db');
    const patientId  = parseInt(req.params.patientId, 10);
    const medicineId = req.params.medicineId; // e.g. "app-2"

    // Parse type and numeric id from prefixed id
    let type, numericId;
    if (medicineId.startsWith('app-'))    { type = 'app';        numericId = parseInt(medicineId.replace('app-', ''), 10); }
    else if (medicineId.startsWith('madhav-')) { type = 'madhavbaug'; numericId = parseInt(medicineId.replace('madhav-', ''), 10); }
    else if (medicineId.startsWith('allo-'))   { type = 'allopathy';  numericId = parseInt(medicineId.replace('allo-', ''), 10); }
    else { return res.status(400).json({ success: false, message: 'Invalid medicineId format' }); }

    const [logs] = await db.query(
      `SELECT DATE(logged_at) AS log_date, slot, taken
       FROM app_medicine_logs
       WHERE app_user_id = ? AND medicine_id = ? AND medicine_type = ?
         AND logged_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       ORDER BY logged_at ASC`,
      [patientId, numericId, type]
    );

    // Group by date
    const byDate = {};
    logs.forEach(l => {
      const d = String(l.log_date).slice(0, 10);
      if (!byDate[d]) byDate[d] = { date: d, slots: [], taken: false };
      byDate[d].slots.push({ slot: l.slot, taken: !!l.taken });
      if (l.taken) byDate[d].taken = true;
    });

    res.json({ success: true, medicineId, type, history: Object.values(byDate) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * @swagger
 * /doctor/patients/{patientId}/sleep:
 *   get:
 *     summary: Get patient's sleep history (last 30 days)
 *     tags: [Doctor]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: patientId
 *         required: true
 *         schema:
 *           type: integer
 *         description: patients.id
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD), default last 30 days
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD), default today
 *     responses:
 *       200:
 *         description: Sleep data fetched successfully
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
 *                     sharingEnabled:
 *                       type: boolean
 *                       example: true
 *                     lastSyncedAt:
 *                       type: string
 *                       nullable: true
 *                       example: "2026-10-05T01:45:00.000Z"
 *                     nights:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             example: "2026-10-05"
 *                           sleepStart:
 *                             type: string
 *                             nullable: true
 *                             example: "2026-10-04T17:30:00.000Z"
 *                           wakeTime:
 *                             type: string
 *                             nullable: true
 *                             example: "2026-10-05T01:15:00.000Z"
 *                           durationMinutes:
 *                             type: integer
 *                             nullable: true
 *                             example: 435
 *                           timeInBedMinutes:
 *                             type: integer
 *                             nullable: true
 *                             example: 465
 *                           source:
 *                             type: string
 *                             nullable: true
 *                             example: wearable
 *                           sourceName:
 *                             type: string
 *                             nullable: true
 *                             example: Galaxy Watch
 *                           confidence:
 *                             type: number
 *                             nullable: true
 *                             example: 0.9
 *                           efficiencyPercent:
 *                             type: integer
 *                             nullable: true
 *                             example: 93
 *                           awakenings:
 *                             type: integer
 *                             nullable: true
 *                             example: 2
 *                           sleepLatencyMinutes:
 *                             type: integer
 *                             nullable: true
 *                             example: 12
 *                           disturbances:
 *                             type: integer
 *                             nullable: true
 *                             example: 1
 *                           stageMinutes:
 *                             type: object
 *                             nullable: true
 *                             example: null
 *                             properties:
 *                               awake:
 *                                 type: integer
 *                                 nullable: true
 *                               light:
 *                                 type: integer
 *                                 nullable: true
 *                               deep:
 *                                 type: integer
 *                                 nullable: true
 *                               rem:
 *                                 type: integer
 *                                 nullable: true
 *                               asleep:
 *                                 type: integer
 *                                 nullable: true
 *                           lowMotionSignal:
 *                             type: boolean
 *                             example: false
 *                           trackingNotStopped:
 *                             type: boolean
 *                             example: false
 *                           sleepScore:
 *                             type: integer
 *                             nullable: true
 *                             example: 82
 *                           sleepQuality:
 *                             type: string
 *                             nullable: true
 *                             example: GOOD
 *       403:
 *         description: Patient not assigned to this doctor
 *       404:
 *         description: Patient not found
 */
router.get('/patients/:patientId/sleep', authenticateDoctor, getPatientSleepHandler);

module.exports = router;
