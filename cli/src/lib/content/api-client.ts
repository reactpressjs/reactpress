// @ts-nocheck
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const { URL } = require('url');
const { loadServerSiteUrl, getApiPrefix } = require('../http');

function resolveApiBase(projectRoot, overrideUrl) {
  if (overrideUrl || process.env.REACTPRESS_API_URL) {
    return String(overrideUrl || process.env.REACTPRESS_API_URL).replace(/\/$/, '');
  }
  const site = loadServerSiteUrl(projectRoot).replace(/\/$/, '');
  const prefix = getApiPrefix(projectRoot).replace(/\/$/, '') || '/api';
  return `${site}${prefix}`;
}

function readSavedApiKey(projectRoot) {
  if (process.env.REACTPRESS_API_KEY) return process.env.REACTPRESS_API_KEY.trim();
  const envPath = path.join(projectRoot, '.env');
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^REACTPRESS_API_KEY=(.+)$/m);
    if (match) return match[1].trim().replace(/^['"]|['"]$/g, '');
  } catch {
    // ignore
  }
  return '';
}

function upsertEnvValue(envPath, key, value) {
  let content = '';
  try {
    content = fs.readFileSync(envPath, 'utf8');
  } catch {
    content = '';
  }
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content = content.trimEnd();
    content = content ? `${content}\n${line}\n` : `${line}\n`;
  }
  fs.writeFileSync(envPath, content, 'utf8');
}

function requestJson(baseUrl, method, routePath, { headers = {}, body, timeoutMs = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(String(routePath).replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
    } catch (err) {
      reject(err);
      return;
    }
    if (parsed.hostname === 'localhost' || parsed.hostname === '::1') {
      parsed.hostname = '127.0.0.1';
    }
    const payload = body == null ? null : Buffer.from(JSON.stringify(body), 'utf8');
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        method,
        family: 4,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': payload.length,
              }
            : {}),
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { raw: text };
          }
          resolve({
            statusCode: res.statusCode || 0,
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            json,
            text,
          });
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out: ${method} ${parsed.toString()}`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function unwrapData(response) {
  if (!response.ok) {
    const msg =
      response.json?.msg ||
      response.json?.message ||
      response.json?.error ||
      response.text ||
      `HTTP ${response.statusCode}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.statusCode = response.statusCode;
    err.response = response.json;
    throw err;
  }
  if (response.json && typeof response.json === 'object' && 'data' in response.json) {
    return response.json.data;
  }
  return response.json;
}

async function apiRequest(baseUrl, method, routePath, options = {}) {
  const response = await requestJson(baseUrl, method, routePath, options);
  return unwrapData(response);
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.md': 'text/markdown',
    '.txt': 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

function uploadFile(baseUrl, filePath, { headers = {}, unique = '1', scene = 'default', timeoutMs = 60_000 } = {}) {
  return new Promise((resolve, reject) => {
    const absolute = path.resolve(filePath);
    if (!fs.existsSync(absolute)) {
      reject(new Error(`File not found: ${absolute}`));
      return;
    }
    const filename = path.basename(absolute);
    const fileBuffer = fs.readFileSync(absolute);
    const boundary = `----reactpress${Date.now().toString(16)}`;
    const preamble = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${guessMime(absolute)}\r\n\r\n`,
      'utf8'
    );
    const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const body = Buffer.concat([preamble, fileBuffer, epilogue]);

    let parsed;
    try {
      const qs = new URLSearchParams({ unique: String(unique), scene: String(scene) });
      parsed = new URL(`file/upload?${qs.toString()}`, `${baseUrl.replace(/\/$/, '')}/`);
    } catch (err) {
      reject(err);
      return;
    }
    if (parsed.hostname === 'localhost' || parsed.hostname === '::1') {
      parsed.hostname = '127.0.0.1';
    }

    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + (parsed.search || ''),
        method: 'POST',
        family: 4,
        headers: {
          Accept: 'application/json',
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
          ...headers,
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            json = { raw: text };
          }
          try {
            resolve(
              unwrapData({
                statusCode: res.statusCode || 0,
                ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
                json,
                text,
              })
            );
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Upload timed out: ${absolute}`));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = {
  resolveApiBase,
  readSavedApiKey,
  upsertEnvValue,
  requestJson,
  apiRequest,
  uploadFile,
  unwrapData,
};
