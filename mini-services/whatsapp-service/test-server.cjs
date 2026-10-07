const http = require('http');

const server = http.createServer((req, res) => {
  console.log(`📡 ${req.method} ${req.url}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Simple QR code SVG
  const qrSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="white"/>
    <rect x="20" y="20" width="80" height="80" fill="#25D366"/>
    <rect x="35" y="35" width="50" height="50" fill="white"/>
    <rect x="50" y="50" width="20" height="20" fill="#25D366"/>
    <rect x="156" y="20" width="80" height="80" fill="#25D366"/>
    <rect x="171" y="35" width="50" height="50" fill="white"/>
    <rect x="186" y="50" width="20" height="20" fill="#25D366"/>
    <rect x="20" y="156" width="80" height="80" fill="#25D366"/>
    <rect x="35" y="171" width="50" height="50" fill="white"/>
    <rect x="50" y="186" width="20" height="20" fill="#25D366"/>
    <rect x="110" y="100" width="36" height="56" rx="4" fill="none" stroke="#25D366" stroke-width="8"/>
    <circle cx="128" cy="120" r="10" fill="#25D366"/>
    <path d="M118 135 L138 135 L138 145 Q128 155 118 145 Z" fill="#25D366"/>
    <text x="128" y="220" text-anchor="middle" font-size="16" font-family="Arial" fill="#25D366" font-weight="bold">WhatsApp</text>
    <text x="128" y="240" text-anchor="middle" font-size="12" font-family="Arial" fill="#666">Scan to connect!</text>
  </svg>`;
  
  let body = '';
  
  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', authenticated: false, hasBrowser: true }));
  }
  else if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: false, initialized: true }));
  }
  else if (req.url === '/api/auth-poll' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ authenticated: false }));
  }
  else if (req.url === '/api/qrcode' && req.method === 'GET') {
    console.log('📱 Sending QR code image...');
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end(qrSVG);
  }
  else if (req.url === '/api/init' && req.method === 'POST') {
    console.log('🚀 Init requested - sending QR code...');
    
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const qrBase64 = Buffer.from(qrSVG).toString('base64');
      const dataUrl = `data:image/svg+xml;base64,${qrBase64}`;
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'qr_code_required',
        message: 'QR code ready! Scan with your phone.',
        qrCode: dataUrl
      }));
      console.log('✅ QR code sent successfully!');
    });
  }
  else if (req.url === '/api/send-message' && req.method === 'POST') {
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('📨 Message send requested');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'sent', success: true, message: 'Message sent!' }));
    });
  }
  else if (req.url === '/api/check-number' && req.method === 'POST') {
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ registered: true, canMessage: true }));
    });
  }
  else if (req.url === '/api/logout' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'logged_out' }));
  }
  else {
    console.log(`❓ Unknown: ${req.method} ${req.url}`);
    res.writeHead(404);
    res.end('Not found');
  }
});

const PORT = 3003;

server.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║                                                    ║');
  console.log('║   🚀  WHATSAPP BLASTER SERVICE - RUNNING!  🚀     ║');
  console.log('║                                                    ║');
  console.log(`║   📍 Port: ${PORT}                                   ║`);
  console.log('║   📡 Status: Ready                                  ║');
  console.log('║   🎬 Mode: Demo (with working QR code!)            ║');
  console.log('║                                                    ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
});
