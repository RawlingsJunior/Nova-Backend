const db = require('../src/config/db');

async function test() {
  try {
    console.log("Inserting a test appointment with a selected doctor...");
    
    /** @type {any} */
    const insertRes = await db.query(`
      INSERT INTO appointments (
        full_name, phone, email, service, 
        appointment_date, appointment_time, notes, 
        appointment_type, doctor_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      "Test Patient", "0244111222", "test@patient.com", "Comprehensive Eye Exam",
      "2026-06-15", "10:30 AM", "Test notes",
      "virtual", "Dr. Sarah Owusu"
    ]);

    const created = insertRes.rows[0];
    console.log("Successfully created:", {
      id: created.id,
      fullName: created.full_name,
      appointmentType: created.appointment_type,
      doctorName: created.doctor_name
    });

    console.log("\nQuerying appointments back...");
    /** @type {any} */
    const selectRes = await db.query(`
      SELECT id, full_name, appointment_type, doctor_name 
      FROM appointments 
      WHERE id = $1
    `, [created.id]);

    const queried = selectRes.rows[0];
    console.log("Queried result:", {
      id: queried.id,
      fullName: queried.full_name,
      appointmentType: queried.appointment_type,
      doctorName: queried.doctor_name
    });

    console.log("\nDeleting test appointment...");
    await db.query(`DELETE FROM appointments WHERE id = $1`, [created.id]);
    console.log("Deleted test appointment successfully.");
    
    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

test();
