const http = require('http'); const net = require('net');
const routes = [
  ['/auth/v1', 58421, ''], ['/rest/v1', 58422, ''], ['/realtime/v1', 58423, 'realtime-dev.localhost:4000'],
];
function pick(url) {
  for (const [p, port, host] of routes) {
    if (url.startsWith(p)) {
      const rest = url.slice(p.length) || '/';
      return { port, host, path: p === '/realtime/v1' ? '/socket' + rest : rest };
    }
  }
  return null;
}
const server = http.createServer((req, res) => {
  const t = pick(req.url);
  if (!t) { res.writeHead(404); res.end('{}'); return; }
  const headers = { ...req.headers, host: t.host || `localhost:${t.port}` };
  const p = http.request({ host: 'localhost', port: t.port, path: t.path, method: req.method, headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on('error', () => { res.writeHead(502); res.end('{}'); });
  req.pipe(p);
});
server.on('upgrade', (req, socket, head) => {
  const t = pick(req.url);
  if (!t) { socket.destroy(); return; }
  const up = net.connect(t.port, 'localhost', () => {
    const headers = { ...req.headers, host: t.host || `localhost:${t.port}` };
    up.write(`${req.method} ${t.path} HTTP/1.1\r\n` + Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n');
    if (head.length) up.write(head);
    socket.pipe(up); up.pipe(socket);
  });
  up.on('error', () => socket.destroy()); socket.on('error', () => up.destroy());
});
server.listen(58420, '0.0.0.0', () => console.log('proxy up'));
