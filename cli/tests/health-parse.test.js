const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeHealthPayload, isHealthPayloadReady, isHealthHttpReady } = require('../out/lib/health-parse');

describe('lib/health-parse', () => {
  it('accepts nested ok health payloads over HTTP 200', () => {
    assert.equal(
      isHealthHttpReady(200, {
        statusCode: 200,
        success: true,
        data: { status: 'ok', database: 'up', version: '3.0.0' },
      }),
      true
    );
  });

  it('accepts flat ok health payloads', () => {
    assert.equal(isHealthHttpReady(200, { status: 'ok', database: 'up' }), true);
  });

  it('rejects degraded database status', () => {
    assert.equal(
      isHealthHttpReady(200, {
        statusCode: 200,
        success: true,
        data: { status: 'degraded', database: 'down' },
      }),
      false
    );
  });

  it('normalizes flat payloads for readiness checks', () => {
    assert.equal(isHealthPayloadReady(normalizeHealthPayload({ status: 'ok', database: 'up' })), true);
  });
});
