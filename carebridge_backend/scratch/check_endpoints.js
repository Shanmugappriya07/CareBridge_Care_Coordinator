const fs = require('fs');
const code = fs.readFileSync('server.js', 'utf8');
const regex = /app\.(get|post|put|delete)\(['"]([^'"]+)['"]/g;
let match;
const endpoints = [];
while ((match = regex.exec(code)) !== null) {
  endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
}
console.log('Registered endpoints count:', endpoints.length);
endpoints.forEach(e => console.log(' ', e));
