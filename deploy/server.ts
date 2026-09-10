/**
 * Polaris selfhost adapter for Render.
 *
 * Serves:
 *   - the Vite build in /dist (static frontend)
 *   - /api/* routes backed by the Vercel-style handlers in /api
 *
 * Runtime: npx tsx deploy/server.ts  (TypeScript, ESM)
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Vercel-style handlers
import providerRelay from '../api/provider-relay.js';
import chatCompletions from '../api/chat/completions.js';
import providerAudio from '../api/provider-audio.js';
import providerEmbeddings from '../api/provider-embeddings.js';
import providerImages from '../api/provider-images.js';
import searchHandler from '../api/search.js';
import clientDiagnostics from '../api/client-diagnostics.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(here, '../dist');

const app = express();
app.set('trust proxy', true);

// request bodies (JSON is the main format used by the handlers)
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: false, limit: '100mb' }));
app.use(express.text({ limit: '100mb', type: ['text/*', 'application/x-ndjson'] }));

// tiny request log for debugging
app.use('/api', (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  console.log('[api] ' + req.method + ' ' + req.path);
  next();
});

const wrap = (handler: any) => async (req: express.Request, res: express.Response) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error('[api] handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: { message: 'Internal server error', type: 'server_error' } });
    } else {
      res.end();
    }
  }
};

app.all('/api/provider-relay', wrap(providerRelay));
app.all('/api/chat/completions', wrap(chatCompletions));
app.all('/api/provider-audio', wrap(providerAudio));
app.all('/api/provider-embeddings', wrap(providerEmbeddings));
app.all('/api/provider-images', wrap(providerImages));
app.all('/api/search', wrap(searchHandler));
app.all('/api/client-diagnostics', wrap(clientDiagnostics));
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'polaris-render-adapter' });
});

// static frontend
app.use(express.static(distDir, { index: 'index.html', extensions: ['html'] }));

// SPA fallback (anything not under /api)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(distDir, 'index.html'));
});

const port = Number(process.env.PORT || 10000);
app.listen(port, '0.0.0.0', () => {
  console.log('[polaris] adapter listening on :' + port);
  console.log('[polaris] serving dist from ' + distDir);
});
