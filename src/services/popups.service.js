const db = require('../config/db');

/**
 * Get active popups for a patient.
 * A popup is shown if:
 *   1. is_active = 1
 *   2. Not expired (expires_at IS NULL OR expires_at > NOW())
 *   3. Targeting filters match the patient (NULL filter = matches everyone)
 *   4. Patient has not dismissed it
 */
const getPopups = async (patientId) => {
  // Fetch patient's branch and active careplan
  const [[patient]] = await db.query(
    `SELECT p.branch_id,
            apc.plan_id AS active_careplan_id
     FROM patients p
     LEFT JOIN app_patient_careplans apc
       ON apc.app_user_id = p.id AND apc.status = 'active'
     WHERE p.id = ?
     ORDER BY apc.created_at DESC
     LIMIT 1`,
    [patientId]
  );

  if (!patient) return [];

  const { branch_id, active_careplan_id } = patient;

  const [rows] = await db.query(
    `SELECT p.id, p.title, p.message, p.image_url, p.type,
            p.action_label, p.action_url, p.created_at
     FROM app_popups p
     WHERE p.is_active = 1
       AND (p.expires_at IS NULL OR p.expires_at > NOW())
       AND (p.target_branch_id   IS NULL OR p.target_branch_id   = ?)
       AND (p.target_careplan_id IS NULL OR p.target_careplan_id = ?)
       AND NOT EXISTS (
         SELECT 1 FROM app_popup_dismissals d
         WHERE d.popup_id = p.id AND d.patient_id = ?
       )
     ORDER BY p.created_at DESC`,
    [branch_id, active_careplan_id, patientId]
  );

  return rows.map(r => ({
    id:          r.id,
    title:       r.title,
    message:     r.message || '',
    imageUrl:    r.image_url || null,
    type:        r.type,
    actionLabel: r.action_label || null,
    actionUrl:   r.action_url || null,
  }));
};

/**
 * Dismiss a popup for a patient:
 *   1. Record the dismissal (idempotent — duplicate key is ignored)
 *   2. Move popup content into patient notifications
 */
const dismissPopup = async (patientId, popupId) => {
  const [[popup]] = await db.query(
    `SELECT id, title, message FROM app_popups WHERE id = ? AND is_active = 1`,
    [popupId]
  );
  if (!popup) {
    const err = new Error('Popup not found');
    err.statusCode = 404;
    throw err;
  }

  // INSERT IGNORE handles duplicate dismissals gracefully
  await db.query(
    `INSERT IGNORE INTO app_popup_dismissals (popup_id, patient_id) VALUES (?, ?)`,
    [popupId, patientId]
  );

  // Move to patient notifications
  await db.query(
    `INSERT INTO app_notifications (patient_id, type, title, message)
     SELECT ?, 'popup', title, message FROM app_popups WHERE id = ?`,
    [patientId, popupId]
  );
};

module.exports = { getPopups, dismissPopup };
