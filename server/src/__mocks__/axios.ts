/**
 * Manual axios mock.
 * Toolkit CJS uses `__importDefault(require("axios")).default.create`.
 * Auth calls axios as a function; webhooks call `axios.post`.
 */
function createInstance() {
  return {
    defaults: { headers: {} as Record<string, unknown> },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    request: jest.fn(() => Promise.resolve({ data: {} })),
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
  };
}

const axios: any = Object.assign(
  jest.fn(() => Promise.resolve({ data: {} })),
  {
    create: jest.fn(() => createInstance()),
    get: jest.fn(() => Promise.resolve({ data: {} })),
    post: jest.fn(() => Promise.resolve({ data: {} })),
    put: jest.fn(() => Promise.resolve({ data: {} })),
    delete: jest.fn(() => Promise.resolve({ data: {} })),
    patch: jest.fn(() => Promise.resolve({ data: {} })),
    request: jest.fn(() => Promise.resolve({ data: {} })),
    isAxiosError: jest.fn(() => false),
    defaults: { headers: {} as Record<string, unknown> },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
  }
);

// Support both `mod.default.create` and a second `.default` unwrap.
axios.default = axios;

export default axios;
