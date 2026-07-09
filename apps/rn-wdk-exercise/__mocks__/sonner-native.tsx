export const Toaster = () => null;

function noop() {
  return '';
}

export const toast = Object.assign(jest.fn(noop), {
  success: jest.fn(noop),
  error: jest.fn(noop),
  warning: jest.fn(noop),
  info: jest.fn(noop),
  loading: jest.fn(noop),
  promise: jest.fn(noop),
  custom: jest.fn(noop),
  dismiss: jest.fn(noop),
  wiggle: jest.fn(noop),
});
