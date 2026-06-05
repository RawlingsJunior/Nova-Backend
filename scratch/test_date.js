const appointmentDate = '2024-06-01';
try {
    const formattedDate = new Date(appointmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    console.log('Formatted Date:', formattedDate);
} catch (err) {
    console.error('Date formatting failed:', err.message);
}
