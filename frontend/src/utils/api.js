/**
 * Helper functions untuk request API dengan JWT authentication
 */

const API_BASE_URL = 'http://localhost:5000/api';

/**
 * Get auth token from localStorage
 * @returns {string|null} The JWT token or null if not found
 */
export const getToken = () => localStorage.getItem('token');

/**
 * Helper untuk GET request dengan autentikasi
 * @param {string} endpoint - API endpoint tanpa base URL
 * @returns {Promise<Object>} Response data dalam bentuk JSON
 * @throws {Error} Jika request gagal
 */
export const apiGet = async (endpoint) => {
  const token = getToken();
  
  // Log token untuk debugging (hapus di production)
  console.debug(`Making GET request to ${endpoint} with token: ${token ? 'exists' : 'none'}`);
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'GET',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    // Log error untuk debugging
    console.error('API Error:', {
      status: response.status,
      statusText: response.statusText,
      endpoint
    });
    
    // Logging raw response
    try {
      const errorText = await response.text();
      console.error('Error response:', errorText);
    } catch (e) {
      console.error('Could not read error response:', e);
    }
    
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Helper untuk POST request dengan autentikasi (JSON data)
 * @param {string} endpoint - API endpoint tanpa base URL
 * @param {Object} data - Data yang akan dikirim sebagai JSON
 * @returns {Promise<Object>} Response data dalam bentuk JSON
 * @throws {Error} Jika request gagal
 */
export const apiPost = async (endpoint, data) => {
  const token = getToken();
  
  // Log token untuk debugging (hapus di production)
  console.debug(`Making POST request to ${endpoint} with token: ${token ? 'exists' : 'none'}`);
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    // Log error untuk debugging
    console.error('API Error:', {
      status: response.status,
      statusText: response.statusText,
      endpoint,
      data
    });
    
    // Logging raw response
    try {
      const errorText = await response.text();
      console.error('Error response:', errorText);
    } catch (e) {
      console.error('Could not read error response:', e);
    }
    
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Helper untuk upload file dengan autentikasi
 * @param {string} endpoint - API endpoint tanpa base URL
 * @param {FormData} formData - FormData object berisi file dan data lainnya
 * @returns {Promise<Object>} Response data dalam bentuk JSON
 * @throws {Error} Jika request gagal
 */
export const apiUploadFile = async (endpoint, formData) => {
  const token = getToken();
  
  // Log token untuk debugging (hapus di production)
  console.debug(`Uploading file to ${endpoint} with token: ${token ? 'exists' : 'none'}`);
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': token ? `Bearer ${token}` : ''
      // Jangan tambahkan Content-Type untuk upload file dengan FormData
    },
    body: formData
  });
  
  if (!response.ok) {
    // Log error untuk debugging
    console.error('API Error:', {
      status: response.status,
      statusText: response.statusText,
      endpoint
    });
    
    // Logging raw response
    try {
      const errorText = await response.text();
      console.error('Error response:', errorText);
    } catch (e) {
      console.error('Could not read error response:', e);
    }
    
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
};

/**
 * Checks if the user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
export const isAuthenticated = () => {
  const token = getToken();
  
  if (!token) {
    return false;
  }
  
  // Decode token and check expiration
  try {
    const tokenParts = token.split('.');
    const payload = JSON.parse(atob(tokenParts[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    
    return payload.exp > currentTime;
  } catch (e) {
    console.error('Error checking token:', e);
    return false;
  }
};