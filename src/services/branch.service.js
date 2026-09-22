const db = require('../config/db');

const formatTime = (time) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${minutes} ${ampm}`;
};

const getBranches = async ({ status, region }) => {
  const validStatus = ['active', 'inactive'].includes(status) ? status : 'active';

  let sql = `
    SELECT
      b.id            AS branch_id,
      b.branch_name,
      b.branch_code,
      b.phone,
      b.email,
      b.address,
      b.city,
      b.state,
      b.pincode,
      b.location,
      b.website,
      b.fromtime,
      b.totime,
      b.weekly_off_day,
      COALESCE(r.region_name, '') AS region,
      b.status
    FROM branches b
    LEFT JOIN regions r ON b.region_id = r.id
    WHERE b.status = ?`;

  const params = [validStatus];

  if (region) {
    sql += ' AND r.region_name LIKE ?';
    params.push(`%${region}%`);
  }

  sql += ' ORDER BY b.branch_name ASC';

  const [rows] = await db.query(sql, params);

  const branches = [];
  for (const row of rows) {
    const branchName = (row.branch_name || '').trim();
    const branchCode = (row.branch_code || '').trim();

    if (!branchName || !branchCode) continue;

    const fromTime = formatTime(row.fromtime);
    const toTime = formatTime(row.totime);
    let branchDescription = '';
    if (fromTime && toTime) {
      branchDescription = `${fromTime}- ${toTime}`;
      if (row.weekly_off_day) {
        branchDescription += `, ${row.weekly_off_day} Closed.`;
      }
    }

    branches.push({
      branch_id:          parseInt(row.branch_id),
      branch_name:        row.branch_name,
      branch_code:        row.branch_code        || '',
      phone:              row.phone              || '',
      email:              row.email              || '',
      address:            row.address            || '',
      city:               row.city               || '',
      state:              row.state              || '',
      pincode:            row.pincode            || '',
      location:           row.location           || '',
      website:            row.website            || '',
      branch_description: branchDescription,
      region:             row.region,
      status:             row.status,
    });
  }

  return { total: branches.length, branches };
};

const searchBranches = async (query) => {
  const [rows] = await db.query(
    `SELECT
      b.id            AS branch_id,
      b.branch_name,
      b.branch_code,
      b.phone,
      b.address,
      b.city,
      b.state,
      b.pincode,
      b.location,
      COALESCE(r.region_name, '') AS region,
      b.status
    FROM branches b
    LEFT JOIN regions r ON b.region_id = r.id
    WHERE b.status = 'active'
      AND (
        b.branch_name LIKE ? OR
        b.city        LIKE ? OR
        b.pincode     LIKE ? OR
        b.address     LIKE ?
      )
    ORDER BY b.branch_name ASC
    LIMIT 50`,
    [`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`]
  );

  const branches = rows
    .filter(row => (row.branch_name || '').trim() && (row.branch_code || '').trim())
    .map(row => ({
      branch_id:   parseInt(row.branch_id),
      branch_name: row.branch_name,
      branch_code: row.branch_code || '',
      phone:       row.phone       || '',
      address:     row.address     || '',
      city:        row.city        || '',
      state:       row.state       || '',
      pincode:     row.pincode     || '',
      location:    row.location    || '',
      region:      row.region,
      status:      row.status,
    }));

  return { total: branches.length, branches };
};

const getNearestBranch = async (lat, lng) => {
  const [rows] = await db.query(
    `SELECT
      b.id            AS branch_id,
      b.branch_name,
      b.branch_code,
      b.phone,
      b.address,
      b.city,
      b.state,
      b.pincode,
      b.location,
      b.latitude,
      b.longitude,
      COALESCE(r.region_name, '') AS region,
      b.status,
      (
        6371 * ACOS(
          COS(RADIANS(?)) * COS(RADIANS(b.latitude)) *
          COS(RADIANS(b.longitude) - RADIANS(?)) +
          SIN(RADIANS(?)) * SIN(RADIANS(b.latitude))
        )
      ) AS distance_km
    FROM branches b
    LEFT JOIN regions r ON b.region_id = r.id
    WHERE b.status = 'active'
      AND b.latitude IS NOT NULL
      AND b.longitude IS NOT NULL
      AND (b.branch_name IS NOT NULL AND b.branch_name != '')
      AND (b.branch_code IS NOT NULL AND b.branch_code != '')
    ORDER BY distance_km ASC
    LIMIT 1`,
    [lat, lng, lat]
  );

  if (!rows.length) return null;

  const row = rows[0];
  return {
    branch_id:   parseInt(row.branch_id),
    branch_name: row.branch_name,
    branch_code: row.branch_code || '',
    phone:       row.phone       || '',
    address:     row.address     || '',
    city:        row.city        || '',
    state:       row.state       || '',
    pincode:     row.pincode     || '',
    location:    row.location    || '',
    region:      row.region,
    status:      row.status,
    distance_km: parseFloat(row.distance_km).toFixed(2),
  };
};

module.exports = { getBranches, searchBranches, getNearestBranch };
