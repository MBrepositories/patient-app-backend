const db = require('../config/db');

const formatTimestamp = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getNotifications = async (patientId, { page = 1, pageSize = 20 } = {}) => {
  const offset = (page - 1) * pageSize;

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM app_notifications WHERE patient_id = ? AND doctor_id IS NULL`,
    [patientId]
  );

  const [[{ unreadCount }]] = await db.query(
    `SELECT COUNT(*) AS unreadCount FROM app_notifications WHERE patient_id = ? AND doctor_id IS NULL AND is_read = 0`,
    [patientId]
  );

  const [rows] = await db.query(
    `SELECT id, type, title, message, is_read, created_at
     FROM app_notifications
     WHERE patient_id = ? AND doctor_id IS NULL
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [patientId, pageSize, offset]
  );

  const notifications = rows.map(r => ({
    id:        String(r.id),
    type:      r.type,
    title:     r.title,
    message:   r.message,
    timestamp: formatTimestamp(r.created_at),
    isUnread:  r.is_read === 0,
  }));

  return {
    unreadCount,
    total,
    page,
    pageSize,
    notifications,
  };
};

const markOneRead = async (patientId, notificationId) => {
  const [result] = await db.query(
    `UPDATE app_notifications SET is_read = 1
     WHERE id = ? AND patient_id = ? AND doctor_id IS NULL`,
    [notificationId, patientId]
  );
  if (result.affectedRows === 0) {
    const err = new Error('Notification not found');
    err.statusCode = 404;
    throw err;
  }
};

const markAllRead = async (patientId) => {
  await db.query(
    `UPDATE app_notifications SET is_read = 1
     WHERE patient_id = ? AND doctor_id IS NULL AND is_read = 0`,
    [patientId]
  );
};

module.exports = { getNotifications, markOneRead, markAllRead };
