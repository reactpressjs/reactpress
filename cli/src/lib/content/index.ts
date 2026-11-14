// @ts-nocheck
const fs = require('fs');
const path = require('path');
const {
  resolveApiBase,
  readSavedApiKey,
  upsertEnvValue,
  apiRequest,
  uploadFile,
} = require('./api-client');
const { parseMarkdownFrontmatter } = require('./frontmatter');

function slugify(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `item-${Date.now().toString(36)}`;
}

function asStringList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function authHeaders(apiKey, bearerToken) {
  if (apiKey) return { 'X-API-Key': apiKey };
  if (bearerToken) return { Authorization: `Bearer ${bearerToken}` };
  return {};
}

function requireAuth(projectRoot, options = {}) {
  const apiKey = options.apiKey || readSavedApiKey(projectRoot);
  const token = options.token || process.env.REACTPRESS_TOKEN || '';
  if (!apiKey && !token) {
    const err = new Error(
      'Missing credentials. Run `reactpress content key --create --save`, or set REACTPRESS_API_KEY / REACTPRESS_TOKEN.'
    );
    err.code = 'REACTPRESS_CONTENT_AUTH';
    throw err;
  }
  return { apiKey, token, headers: authHeaders(apiKey, token) };
}

async function loginAdmin(baseUrl, { name, password }) {
  const data = await apiRequest(baseUrl, 'POST', 'auth/login', {
    body: { name, password },
  });
  if (!data?.token) {
    throw new Error('Login succeeded but no token was returned');
  }
  return data;
}

async function createApiKey(projectRoot, options = {}) {
  const baseUrl = resolveApiBase(projectRoot, options.apiUrl);
  const name = options.name || 'agent';
  const scopes = options.scopes || 'read,write';
  const username = options.username || process.env.REACTPRESS_ADMIN_USER || 'admin';
  const password = options.password || process.env.REACTPRESS_ADMIN_PASSWORD || 'admin';

  const session = await loginAdmin(baseUrl, { name: username, password });
  const created = await apiRequest(baseUrl, 'POST', 'api-key', {
    headers: { Authorization: `Bearer ${session.token}` },
    body: { name, scopes },
  });

  const rawKey = created?.rawKey;
  if (!rawKey) {
    throw new Error('API key create response did not include rawKey');
  }

  if (options.save) {
    const envPath = path.join(projectRoot, '.env');
    upsertEnvValue(envPath, 'REACTPRESS_API_KEY', rawKey);
    upsertEnvValue(envPath, 'REACTPRESS_API_URL', baseUrl);
  }

  return {
    rawKey,
    apiKey: created?.apiKey || null,
    baseUrl,
    saved: Boolean(options.save),
  };
}

async function listTags(baseUrl, headers) {
  const data = await apiRequest(baseUrl, 'GET', 'tag', { headers });
  return Array.isArray(data) ? data : [];
}

async function listCategories(baseUrl, headers) {
  const data = await apiRequest(baseUrl, 'GET', 'category', { headers });
  return Array.isArray(data) ? data : [];
}

async function ensureTagId(baseUrl, headers, label, cache) {
  const normalized = String(label).trim();
  if (!normalized) return null;
  const existing =
    cache.find((tag) => tag.label === normalized || tag.value === normalized || tag.id === normalized) ||
    null;
  if (existing) return existing.id;

  const created = await apiRequest(baseUrl, 'POST', 'tag', {
    headers,
    body: { label: normalized, value: slugify(normalized) },
  });
  cache.push(created);
  return created.id;
}

async function ensureCategoryId(baseUrl, headers, label, cache) {
  const normalized = String(label).trim();
  if (!normalized) return null;
  const existing =
    cache.find(
      (category) =>
        category.label === normalized || category.value === normalized || category.id === normalized
    ) || null;
  if (existing) return existing.id;

  const created = await apiRequest(baseUrl, 'POST', 'category', {
    headers,
    body: { label: normalized, value: slugify(normalized) },
  });
  cache.push(created);
  return created.id;
}

function buildArticlePayload(attributes, body, { status = 'draft' } = {}) {
  const title = attributes.title || attributes.Title;
  if (!title) {
    throw new Error('Markdown frontmatter must include title');
  }
  const content = String(body || '').trim();
  if (!content) {
    throw new Error('Markdown body is empty');
  }

  const payload = {
    title: String(title),
    content,
    status,
  };

  if (attributes.summary) payload.summary = String(attributes.summary);
  if (attributes.slug) payload.slug = String(attributes.slug);
  if (attributes.seoKeywords) payload.seoKeywords = String(attributes.seoKeywords);
  if (attributes.seoDescription) payload.seoDescription = String(attributes.seoDescription);
  if (attributes.cover) payload.cover = String(attributes.cover);

  return payload;
}

async function createArticleFromFile(projectRoot, filePath, options = {}) {
  const absolute = path.resolve(projectRoot, filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${absolute}`);
  }
  const markdown = fs.readFileSync(absolute, 'utf8');
  const { attributes, body } = parseMarkdownFrontmatter(markdown);
  const status = options.publish ? 'publish' : options.status || 'draft';
  const payload = buildArticlePayload(attributes, body, { status });

  const baseUrl = resolveApiBase(projectRoot, options.apiUrl);
  const { headers } = requireAuth(projectRoot, options);

  const tagLabels = asStringList(attributes.tags);
  const categoryLabel = attributes.category ? String(attributes.category).trim() : '';

  if (tagLabels.length || categoryLabel) {
    const [tags, categories] = await Promise.all([
      tagLabels.length ? listTags(baseUrl, headers) : Promise.resolve([]),
      categoryLabel ? listCategories(baseUrl, headers) : Promise.resolve([]),
    ]);
    if (tagLabels.length) {
      const ids = [];
      for (const label of tagLabels) {
        const id = await ensureTagId(baseUrl, headers, label, tags);
        if (id) ids.push(id);
      }
      if (ids.length) payload.tags = ids.join(',');
    }
    if (categoryLabel) {
      const categoryId = await ensureCategoryId(baseUrl, headers, categoryLabel, categories);
      if (categoryId) payload.category = categoryId;
    }
  }

  const article = await apiRequest(baseUrl, 'POST', 'article', {
    headers,
    body: payload,
  });
  return article;
}

async function publishArticle(projectRoot, articleId, options = {}) {
  if (!articleId) throw new Error('Article id is required');
  const baseUrl = resolveApiBase(projectRoot, options.apiUrl);
  const { headers } = requireAuth(projectRoot, options);
  return apiRequest(baseUrl, 'PATCH', `article/${articleId}`, {
    headers,
    body: { status: 'publish' },
  });
}

async function uploadMedia(projectRoot, filePath, options = {}) {
  const baseUrl = resolveApiBase(projectRoot, options.apiUrl);
  const { headers } = requireAuth(projectRoot, options);
  return uploadFile(baseUrl, path.resolve(projectRoot, filePath), {
    headers,
    unique: options.unique == null ? '1' : String(options.unique),
    scene: options.scene || 'default',
  });
}

module.exports = {
  slugify,
  createApiKey,
  createArticleFromFile,
  publishArticle,
  uploadMedia,
  parseMarkdownFrontmatter,
  resolveApiBase,
  readSavedApiKey,
};
