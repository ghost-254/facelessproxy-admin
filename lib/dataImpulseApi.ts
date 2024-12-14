import axios, { AxiosRequestConfig } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE_URL = 'https://api.dataimpulse.com/reseller';
let API_TOKEN: string | null = null;

/**
 * Fetch API Token
 * Authenticates with the DataImpulse API and retrieves a token.
 */
async function getToken(): Promise<string> {
  const login = process.env.LOGIN;
  const password = process.env.PASSWORD;

  if (!login || !password) {
    throw new Error('LOGIN and PASSWORD must be set in environment variables');
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/user/token/get`, { login, password });
    API_TOKEN = response.data.token;

    if (!API_TOKEN) {
      throw new Error('Received an empty token from the server');
    }

    return API_TOKEN;
  } catch (error: any) {
    console.error('Error getting token:', error.response?.data || error.message);
    throw new Error('Authentication failed');
  }
}

/**
 * Make Authorized Request
 * Handles API requests with automatic token refresh.
 */
async function makeAuthorizedRequest(
  method: AxiosRequestConfig['method'],
  endpoint: string,
  data: any = null,
  retries = 3 // Add retry parameter
): Promise<any> {
  if (!API_TOKEN) {
    API_TOKEN = await getToken();
  }

  try {
    const config: AxiosRequestConfig = {
      method,
      url: `${API_BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
      },
      timeout: 60000, // 60 seconds timeout
      ...(method !== 'GET' ? { data } : { params: data }),
    };

    const response = await axios(config);
    return response.data;
  } catch (error: any) {
    if (retries > 0 && error.code === 'ECONNRESET') {
      console.warn(`Retrying request to ${endpoint}. Retries left: ${retries}`);
      return makeAuthorizedRequest(method, endpoint, data, retries - 1);
    }

    if (error.response?.status === 401) {
      console.warn('Token expired, refreshing token...');
      API_TOKEN = await getToken();
      return makeAuthorizedRequest(method, endpoint, data);
    }

    console.error('Error making authorized request:', error.message || error);
    throw error;
  }
}


/**
 * Exported API Functions
 */

export async function authenticate(): Promise<string> {
  return getToken();
}

export async function getBalance(): Promise<number> {
  const response = await makeAuthorizedRequest('GET', '/user/balance');
  return response.balance;
}

export async function getSubUserList(
  limit: number = 100,
  offset: number = 0
): Promise<{ items: any[]; total: number }> {
  return makeAuthorizedRequest('GET', '/sub-user/list', { limit, offset });
}

export async function createSubUser(userData: {
  label: string;
  pool_type: string;
  threads: number;
}): Promise<any> {
  return makeAuthorizedRequest('POST', '/sub-user/create', userData);
}


export async function updateSubUser(subUserId: string, updateData: Record<string, any>): Promise<any> {
  return makeAuthorizedRequest('POST', '/sub-user/update', { subuser_id: subUserId, ...updateData });
}

export async function deleteSubUser(subUserId: string): Promise<void> {
  await makeAuthorizedRequest('POST', '/sub-user/delete', { subuser_id: subUserId });
}

export async function getSubUserBalance(subUserId: string): Promise<number> {
  const response = await makeAuthorizedRequest('GET', `/sub-user/balance/get`, {
    subuser_id: subUserId,
  });
  return response.balance;
}

export async function addSubUserBalance(subUserId: string, traffic: number): Promise<void> {
  await makeAuthorizedRequest('POST', '/sub-user/balance/add', { subuser_id: subUserId, traffic });
}

export async function getSubUserUsageStats(subUserId: string, period: string): Promise<any> {
  return makeAuthorizedRequest('GET', `/sub-user/usage-stat/get`, {
    subuser_id: subUserId,
    period,
  });
}

export async function getTrafficUsageDetails(
  subUserId: string,
  period: string,
  limit: number = 50,
  offset: number = 0
): Promise<any> {
  return makeAuthorizedRequest('GET', `/sub-user/usage-stat/detail`, {
    subuser_id: subUserId,
    period,
    limit,
    offset,
  });
}

export async function getTrafficErrorStats(
  subUserId: string,
  period: string,
  limit: number = 50,
  offset: number = 0
): Promise<any> {
  return makeAuthorizedRequest('GET', `/sub-user/usage-stat/errors`, {
    subuser_id: subUserId,
    period,
    limit,
    offset,
  });
}

export async function getSupportedProtocols(subUserId: string): Promise<string[]> {
  return makeAuthorizedRequest('GET', `/sub-user/supported-protocols/get`, {
    subuser_id: subUserId,
  });
}

export async function setSupportedProtocols(subUserId: string, supportedProtocols: string[]): Promise<void> {
  await makeAuthorizedRequest('POST', '/sub-user/supported-protocols/set', {
    subuser_id: subUserId,
    supported_protocols: supportedProtocols,
  });
}

export async function getLocations(poolType: string): Promise<any[]> {
  return makeAuthorizedRequest('GET', `/common/locations`, { pool_type: poolType });
}

export async function getPoolStats(poolType: string): Promise<any> {
  return makeAuthorizedRequest('GET', `/common/pool_stats`, { pool_type: poolType });
}

export async function getTotalTrafficConsumed(): Promise<number> {
  const subUsers = await getSubUserList();
  let totalTraffic = 0;

  for (const subUser of subUsers.items) {
    const usageStats = await getSubUserUsageStats(subUser.id, 'month');
    totalTraffic += usageStats.usage.reduce((sum: number, stat: any) => sum + stat.traffic, 0);
  }

  return totalTraffic;
}

export async function getTotalSubUsers(): Promise<number> {
  const response = await getSubUserList();
  return response.total || 0;
}

export async function setDefaultPoolParameters(
  subUserId: string,
  poolParameters: {
    countries?: string[];
    exclude_countries?: string[];
    exclude_asn?: number[];
    anonymous_filter?: boolean;
    rotation_interval?: number;
  }
): Promise<void> {
  await makeAuthorizedRequest('POST', '/sub-user/set-default-pool-parameters', {
    subuser_id: subUserId,
    default_pool_parameters: poolParameters,
  });
}
