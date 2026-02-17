export const isDevelopment = process.env.NODE_ENV !== 'production';

export function getApiBaseUrl() {
  return (
    process.env.REACT_APP_API_BASE_URL ||
    (isDevelopment ? 'http://localhost:3030' : '')
  );
}

export function getBackendPort() {
  return process.env.REACT_APP_BACKEND_PORT || '3030';
}
