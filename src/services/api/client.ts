import axios from 'axios';
import * as SecureStore from '../../utils/secureStorage';
import { emitSessionExpired } from './sessionEvents';
import { ACCESS_TOKEN_KEY } from '../../utils/constants';

const baseURL = process.env.EXPO_PUBLIC_API_URL;

export const apiClient = axios.create({
  baseURL,
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Whether this actually means the session expired (vs. e.g. a wrong-PIN
    // login attempt with no session yet) is decided by whoever's listening —
    // see authStore.ts's onSessionExpired registration.
    if (error?.response?.status === 401) {
      emitSessionExpired(error?.config?.url);
    }
    return Promise.reject(error);
  }
);
