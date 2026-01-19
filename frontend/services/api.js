import axios from 'axios';

const API_URL = 'http://192.168.1.28:8080/api';//Adjust for hosted URL
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getLeaderboard = async (page = 1, limit = 50) => {
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

export const searchUsers = async (username) => {
  try {
    const response = await api.get('/search', {
      params: { username },
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