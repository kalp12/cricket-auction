import axios from 'axios';
import { API_BASE } from '../config/api';
import { AuthToken, Player, Team, AuctionState } from '../types';

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle token storage
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (username: string, password: string): Promise<AuthToken> => {
    const response = await api.post<AuthToken>('/api/auth/login', { username, password });
    return response.data;
  }
};

export const playerAPI = {
  getPlayers: async (): Promise<Player[]> => {
    const response = await api.get<Player[]>('/api/players');
    return response.data;
  },
  createPlayer: async (data: Partial<Player>): Promise<Player> => {
    const response = await api.post<Player>('/api/players', data);
    return response.data;
  }
};

export const teamAPI = {
  getTeams: async (): Promise<Team[]> => {
    const response = await api.get<Team[]>('/api/teams');
    return response.data;
  },
  createTeam: async (data: Partial<Team>): Promise<Team> => {
    const response = await api.post<Team>('/api/teams', data);
    return response.data;
  }
};

export const auctionAPI = {
  getAuctionState: async (): Promise<AuctionState> => {
    const response = await api.get<AuctionState>('/api/auction/state');
    return response.data;
  },
  startAuction: async (player_id: number, timer_seconds: number = 60): Promise<AuctionState> => {
    const response = await api.post<AuctionState>('/api/auction/start', { player_id, timer_seconds });
    return response.data;
  },
  placeBid: async (team_id: number, amount: number): Promise<AuctionState> => {
    const response = await api.post<AuctionState>('/api/auction/bid', { team_id, amount });
    return response.data;
  },
  soldPlayer: async (): Promise<{ message: string }> => {
    const response = await api.post('/api/auction/sold');
    return response.data;
  },
  unsoldPlayer: async (): Promise<{ message: string }> => {
    const response = await api.post('/api/auction/unsold');
    return response.data;
  },
  pauseAuction: async (): Promise<AuctionState> => {
    const response = await api.post<AuctionState>('/api/auction/pause');
    return response.data;
  },
  resumeAuction: async (): Promise<AuctionState> => {
    const response = await api.post<AuctionState>('/api/auction/resume');
    return response.data;
  }
};