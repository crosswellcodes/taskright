import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const token = await AsyncStorage.getItem('auth_token');

  const headers = {
    ...(options.isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || 'Request failed');
    error.code = data.code;
    error.status = response.status;
    error.details = data;
    throw error;
  }

  return data;
}

export const get = (path) => request(path);
export const post = (path, body) =>
  request(path, { method: 'POST', body: JSON.stringify(body) });
export const put = (path, body) =>
  request(path, { method: 'PUT', body: JSON.stringify(body) });
export const patch = (path, body) =>
  request(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = (path) => request(path, { method: 'DELETE' });
export const postFormData = (path, formData) =>
  request(path, { method: 'POST', body: formData, isFormData: true });
