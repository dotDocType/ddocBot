import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json' };
for (const [port, directory] of [[4174,'examples/vue/dist'],[4175,'examples/angular/dist/ddocbot-angular-example/browser']]) {
  const root = resolve(directory);
  createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = resolve(root, '.' + pathname);
      if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      try { if (!(await stat(file)).isFile()) file = resolve(root,'index.html'); }
      catch { file = resolve(root,'index.html'); }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(data);
    } catch { res.writeHead(404).end('Build examples first: npm run build:examples'); }
  }).listen(port, '127.0.0.1', () => console.log(`Example: http://127.0.0.1:${port}`));
}
