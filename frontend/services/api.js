import axios from 'axios';

const API_URL = 'https://realtimeleaderboard-production.up.railway.app/api';


const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getLeaderboard = async (page = 1, limit = 100) => {
  try {
    const response = await api.get('/leaderboard', {
      params: { page, limit },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

export const searchUsers = async (username, page = 1) => {
  try {
    const response = await api.get('/search', {
      params: { 
        username,
        page 
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

export const getUserRank = async (username) => {
  try {
    const response = await api.get(`/users/${username}/rank`);
    return response.data;
  } catch (error) {
    console.error('Error getting user rank:', error);
    throw error;
  }
};

export const updateRating = async (username, rating) => {
  try {
    const response = await api.post(`/users/${username}/rating`, { rating });
    return response.data;
  } catch (error) {
    console.error('Error updating rating:', error);
    throw error;
  }
};

export const toggleSimulation = async (isActive) => {
  try {
    const response = await api.post('/simulation/toggle', {
      active: isActive
    });
    return response.data;
  } catch (error) {
    console.error('Error toggling simulation:', error);
    throw error;
  }
};

export const getSimulationStatus = async () => {
  try {
    const response = await api.get('/simulation/status');
    return response.data;
  } catch (error) {
    console.error('Error getting simulation status:', error);
    throw error;
  }
};