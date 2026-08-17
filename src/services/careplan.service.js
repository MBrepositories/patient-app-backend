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

module.exports = { getCareplans };
