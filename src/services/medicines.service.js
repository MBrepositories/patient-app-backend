const db = require('../config/db');

const getMadhavbaugMedicinesMaster = async () => {
  const [rows] = await db.query(
    `SELECT
       id,
       name,
       batch_number,
       expiry_date,
       uom,
       dosage,
       price,
       category,
       status,
       medium,
       route,
       frequency,
       duration
     FROM madhavbaug_medicines
     WHERE status = 'active'
     ORDER BY name ASC`
  );

  return { total: rows.length, medicines: rows };
};

const getAllopathyMedicinesMaster = async (query) => {
  const [rows] = await db.query(
    `SELECT
       id,
       medicine_name,
       uom,
       default_dosage,
       default_frequency,
       prescription,
       type_of_sell,
       manufacturer,
       salt,
       mrp,
       status,
       uses,
       side_effects,
       how_to_use,
       chemical_class,
       habit_forming,
       therapeutic_class,
       action_class,
       how_it_works
     FROM medicines
     WHERE medicine_name LIKE ?
     ORDER BY medicine_name ASC
     LIMIT 50`,
    [`${query}%`]
  );

  return { total: rows.length, medicines: rows };
};

module.exports = { getMadhavbaugMedicinesMaster, getAllopathyMedicinesMaster };
