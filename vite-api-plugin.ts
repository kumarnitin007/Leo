/**
 * Vite plugin that serves Vercel-style API routes during local development.
 *
 * Intercepts requests to /api/* and routes them to the corresponding handler
 * in the api/ directory, simulating Vercel's req/res interface.
 *
 * This means `npm run dev` can call /api/daily-briefing etc. without
 * needing `vercel dev` or any extra server.
 */

import type { Plugin, ViteDevServer } from 'vite';
import { IncomingMessage, ServerResponse } from 'http';
import { config } from 'dotenv';

config(); // Load .env so process.env.OPENAI_API_KEY etc. are available
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

if (process.env.ALLOW_INSECURE_SSL === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function createMockReq(req: IncomingMessage, body: any) {
  return {
    method: req.method,
    url: req.url,
    headers: req.headers,
    body,
    query: Object.fromEntries(new URL(req.url || '', 'http://localhost').searchParams),
    socket: req.socket,
  };
}

function createMockRes(res: ServerResponse) {
  let statusCode = 200;
  let headersSent = false;
  const mock: any = {
    status(code: number) {
      statusCode = code;
      return mock;
    },
    json(data: any) {
      if (!headersSent) {
        headersSent = true;
        res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      }
      res.end(JSON.stringify(data));
    },
    send(data: any) {
      if (!headersSent) {
        headersSent = true;
        res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
      }
      res.end(typeof data === 'string' ? data : JSON.stringify(data));
    },
    setHeader(name: string, value: string | number) {
      try { res.setHeader(name, String(value)); } catch { /* headers already sent */ }
      return mock;
    },
    getHeader(name: string) {
      return res.getHeader(name);
    },
  };
  return mock;
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { resolve(raw); }
    });
    req.on('error', reject);
  });
}

export default function viteApiPlugin(): Plugin {
  return {
    name: 'vite-api-routes',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        const routeName = req.url.replace(/^\/api\//, '').replace(/\?.*$/, '');
        const handlerPath = `./api/${routeName}.ts`;

        try {
          const mod = await server.ssrLoadModule(handlerPath);
          const handler = mod.default;
          if (typeof handler !== 'function') {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `No handler for /api/${routeName}` }));
            return;
          }

          const body = await readBody(req);
          const mockReq = createMockReq(req, body);
          const mockRes = createMockRes(res);

          await handler(mockReq, mockRes);

          if (!res.writableEnded) {
            res.writeHead(204);
            res.end();
          }
        } catch (err: any) {
          console.error(`[vite-api] /api/${routeName} error:`, err.message);
          if (!res.writableEnded) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message, code: 'SERVER_ERROR' }));
          }
        }
      });
    },
  };
}
