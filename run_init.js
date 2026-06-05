const initializeDatabase = require('./src/initDb');

async function runInit() {
  console.log('Running database initialization...');
  await initializeDatabase();
  process.exit();
}

runInit();
