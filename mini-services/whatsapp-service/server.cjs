const http = require('http');

const server = http.createServer((req, res) => {
  console.log(new Date().toISOString(), req.method, req.url);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  
  // WhatsApp-style QR code SVG
  const qrSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
    <rect width="256" height="256" fill="white" rx="20"/>
    <rect x="30" y="30" width="70" height="70" fill="#25D366" rx="8"/>
    <rect x="45" y="45" width="40" height="40" fill="white" rx="4"/>
    <rect x="58" y="58" width="14" height="14" fill="#25D366"/>
    <rect x="156" y="30" width="70" height="70" fill="#25D366" rx="8"/>
    <rect x="171" y="45" width="40" height="40" fill="white" rx="4"/>
    <rect x="184" y="58" width="14" height="14" fill="#25D366"/>
    <rect x="30" y="156" width="70" height="70" fill="#25D366" rx="8"/>
    <rect x="45" y="171" width="40" height="40" fill="white" rx="4"/>
    <rect x="58" y="184" width="14" height="14" fill="#25D366"/>
    <rect x="120" y="110" width="50" height="50" rx="10" fill="none" stroke="#25D366" stroke-width="6"/>
    <circle cx="145" cy="135" r="12" fill="#25D366"/>
    <path d="M133 145 L157 145 Q165 145 165 137 L165 130" stroke="#25D366" stroke-width="5" fill="none" stroke-linecap="round"/>
    <text x="128" y="215" text-anchor="middle" font-size="18" font-family="Arial,sans-serif" fill="#25D366" font-weight="bold">WhatsApp</text>
    <text x="128" y="235" text-anchor="middle" font-size="12" font-family="Arial,sans-serif" fill="#075E54">Scan to connect!</text>
  </svg>`;
  
  let body = '';
  
  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'ok',authenticated:false,hasBrowser:true}));
  }
  else if (req.url === '/api/status' && req.method === 'GET') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({authenticated:false,initialized:true}));
  }
  else if (req.url === '/api/auth-poll' && req.method === 'GET') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({authenticated:false}));
  }
  else if (req.url === '/api/qrcode' && req.method === 'GET') {
    console.log('📱 QR code image requested');
    res.writeHead(200,{'Content-Type':'image/svg+xml'});
    res.end(qrSVG);
  }
  else if (req.url === '/api/init' && req.method === 'POST') {
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      const dataUrl='data:image/svg+xml;base64,'+Buffer.from(qrSVG).toString('base64');
      console.log('✅ QR code sent!');
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({status:'qr_code_required',message:'Scan QR code!',qrCode:dataUrl}));
    });
  }
  else if (req.url === '/api/send-message' && req.method==='POST') {
    req.on('data',c=>body+=c);
    req.on('end',()=>{
      console.log('📨 Message sent');
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({status:'sent',success:true}));
    });
  }
  else if (req.url==='/api/check-number' && req.method==='POST') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({registered:true,canMessage:true}));
  }
  else if (req.url==='/api/logout' && req.method==='POST') {
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({status:'logged_out'}));
  }
  else {
    res.writeHead(404);res.end('Not found');
  }
});

server.listen(3003,'0.0.0.0',()=>{
  console.log('\n✅ WHATSAPP BLASTER SERVICE RUNNING ON PORT 3003\n');
});
