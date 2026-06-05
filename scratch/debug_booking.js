const db = require('../src/config/db');

async function testBooking() {
  const testData = {
    fullName: 'Test User',
    phone: '0244123456',
    email: 'test@example.com',
    service: 'General Eye Exam',
    appointmentDate: '2024-06-01',
    appointmentTime: '10:00',
    notes: 'Test note'
  };

  console.log('Testing appointment creation...');
  try {
    const result = await db.query(
      `INSERT INTO appointments 
      (full_name, phone, email, service, appointment_date, appointment_time, notes) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [testData.fullName, testData.phone, testData.email, testData.service, testData.appointmentDate, testData.appointmentTime, testData.notes]
    );
    console.log('Success!', result.rows[0]);
    
    // Test notification
    console.log('Testing notification creation...');
    try {
        // Checking notifications table schema via direct insert
        await db.query(
            'INSERT INTO notifications (user_id, type, title, message) VALUES ($1, $2, $3, $4)',
            [null, 'appointment', 'Test Title', 'Test Message']
        );
        console.log('Notification success!');
    } catch (err) {
        console.error('Notification failed:', err.message);
        
        // Try alternate schema
        console.log('Trying alternate notification schema (patient_id)...');
        try {
            await db.query(
                'INSERT INTO notifications (patient_id, type, message) VALUES ($1, $2, $3)',
                [null, 'appointment', 'Test Message']
            );
            console.log('Alternate notification success!');
        } catch (err2) {
            console.error('Alternate notification also failed:', err2.message);
        }
    }

  } catch (err) {
    console.error('Booking failed:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
  } finally {
    process.exit();
  }
}

testBooking();
