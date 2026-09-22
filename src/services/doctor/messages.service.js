const db = require('../../config/db');

const formatTimestampLabel = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isYesterday) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
};

const getMessages = async (doctorId, { search, filter }) => {
  // Get all patients in doctor's branch who have chat messages
  const [rows] = await db.query(
    `SELECT
       p.id AS patientId,
       p.patient_name AS patientName,
       m.text AS previewText,
       m.sender AS lastSender,
       m.created_at AS lastAt,
       SUM(CASE WHEN m2.sender = 'patient' AND m2.status != 'read' THEN 1 ELSE 0 END) AS unreadCount
     FROM patients p
     INNER JOIN users u ON u.branch_id = p.branch_id AND u.id = ?
     INNER JOIN app_chat_messages m ON m.patient_id = p.id
       AND m.id = (
         SELECT MAX(id) FROM app_chat_messages
         WHERE patient_id = p.id AND sender IN ('patient', 'doctor', 'ai')
       )
     LEFT JOIN app_chat_messages m2 ON m2.patient_id = p.id
     WHERE p.status = 'active'
     GROUP BY p.id, p.patient_name, m.text, m.sender, m.created_at
     ORDER BY m.created_at DESC`,
    [doctorId]
  );

  let threads = rows.map(r => {
    const name = r.patientName || 'Patient';
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const isUnread = parseInt(r.unreadCount) > 0;

    return {
      id:              `thread-${r.patientId}`,
      patientId:       `patient-${r.patientId}`,
      patientDbId:     r.patientId,
      patientName:     name,
      avatarInitials:  initials,
      previewText:     r.previewText || '',
      timestampLabel:  formatTimestampLabel(r.lastAt),
      isUnread,
      isUrgent:        false,
      isFollowUp:      false,
    };
  });

  // Search filter
  if (search) {
    const q = search.toLowerCase();
    threads = threads.filter(t => t.patientName.toLowerCase().includes(q));
  }

  // Category filter
  if (filter && filter !== 'all') {
    if (filter === 'unread')   threads = threads.filter(t => t.isUnread);
    if (filter === 'urgent')   threads = threads.filter(t => t.isUrgent);
    if (filter === 'followUp') threads = threads.filter(t => t.isFollowUp);
  }

  const unreadCount = threads.filter(t => t.isUnread).length;

  return { unreadCount, threads };
};

module.exports = { getMessages };
