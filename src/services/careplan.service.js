const db = require('../config/db');

const getCareplans = async () => {
  const [rows] = await db.query(
    `SELECT
       id,
       plan_code,
       care_plan_name,
       type,
       mrp,
       discount_amount,
       discount_percentage,
       final_cost_to_patient,
       duration_days,
       active_status,
       minimum_package_price,
       maximum_package_price
     FROM careplan_master
     ORDER BY care_plan_name ASC`
  );

  return { total: rows.length, careplans: rows };
};

const getcareplanDetails = async (id) => {
  const [[master]] = await db.query(
    `SELECT id, care_plan_name, type, mrp, final_cost_to_patient,
            duration_days, expected_improvement, instructions, precautions
     FROM careplan_master WHERE id = ?`,
    [id]
  );
  if (!master) {
    const err = new Error('Care plan not found.'); err.statusCode = 404; throw err;
  }

  // Inclusions from careplan_details + cp_items
  const [detailRows] = await db.query(
    `SELECT ci.item_name, ci.category, SUM(cd.quantity) AS count
     FROM careplan_details cd
     JOIN cp_items ci ON ci.id = cd.cp_item_id
     WHERE cd.careplan_master_id = ?
     GROUP BY ci.item_name, ci.category`,
    [id]
  );

  const iconMap = { therapy: 'favorite-border', lab: 'science', diet: 'restaurant', consultation: 'event' };
  const inclusions = detailRows.map(r => ({
    iconName: iconMap[(r.category || '').toLowerCase()] || 'check-circle',
    label:    r.item_name,
    count:    r.count > 0 ? Number(r.count) : null,
  }));

  return {
    id:           master.id,
    name:         master.care_plan_name,
    type:         master.type,
    mrp:          master.mrp,
    finalCost:    master.final_cost_to_patient,
    durationDays: master.duration_days > 0 ? master.duration_days : null,
    description:  master.expected_improvement || master.instructions || null,
    suitableFor:  [], // not available in DB
    inclusions,
  };
};

module.exports = { getCareplans, getcareplanDetails };
