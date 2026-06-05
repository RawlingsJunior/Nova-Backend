const net = require('net');
const tls = require('tls');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const url = new URL(process.env.DATABASE_URL);
let host = url.hostname;
// Remove -pooler
host = host.replace('-pooler', '');

const port = parseInt(url.port || '5432');
const username = url.username;
const password = url.password;
const database = url.pathname.substring(1);

console.log(`Testing Non-Pooler Host: ${host}`);
console.log(`Port: ${port}`);
console.log(`User: ${username}`);
console.log(`DB: ${database}`);

const socket = net.createConnection({ host, port }, () => {
  console.log('TCP connection established.');
  
  // Send SSL request packet
  const sslRequest = Buffer.alloc(8);
  sslRequest.writeInt32BE(8, 0);
  sslRequest.writeInt32BE(80877103, 4);
  
  console.log('Sending SSL Request packet...');
  socket.write(sslRequest);
});

socket.on('data', (data) => {
  console.log('Received response from server:', data.toString(), data);
  
  if (data[0] === 83) { // 'S'
    console.log('Server supports SSL. Upgrading connection to TLS...');
    const secureSocket = tls.connect({
      socket: socket,
      servername: host,
      rejectUnauthorized: false
    }, () => {
      console.log('TLS handshake completed! Connection is secure.');
      
      // Send StartupMessage
      const payload = Buffer.concat([
        Buffer.from([0, 3, 0, 0]), // version 3.0
        Buffer.from('user\0'), Buffer.from(`${username}\0`),
        Buffer.from('database\0'), Buffer.from(`${database}\0`),
        Buffer.from('\0') // terminator
      ]);
      
      const startupMessage = Buffer.alloc(4 + payload.length);
      startupMessage.writeInt32BE(startupMessage.length, 0);
      payload.copy(startupMessage, 4);
      
      console.log('Sending PostgreSQL StartupMessage...');
      secureSocket.write(startupMessage);
    });
    
    secureSocket.on('data', (secureData) => {
      console.log('Received secure data:', secureData);
      const type = String.fromCharCode(secureData[0]);
      console.log('Response type char:', type);
      secureSocket.end();
    });
    
    secureSocket.on('error', (err) => {
      console.error('Secure socket error:', err);
    });
  } else {
    console.log('Server does NOT support SSL.');
    socket.end();
  }
});

socket.on('error', (err) => {
  console.error('Socket error:', err);
});

socket.on('close', () => {
  console.log('Socket closed.');
});
