import client from './client';

export const getMatches = () => client.get('/matches');
export const getMatch = (matchId) => client.get(`/matches/${matchId}`);
export const unmatch = (matchId) => client.delete(`/matches/${matchId}`);
export const getMessages = (matchId, params) =>
  client.get(`/matches/${matchId}/messages`, { params });
export const sendMessage = (matchId, content) =>
  client.post(`/matches/${matchId}/messages`, { content });
export const markCallCompleted = (matchId, durationSeconds) =>
  client.post(`/matches/${matchId}/call-completed`, { durationSeconds });
export const blockMatch = (matchId) => client.post(`/matches/${matchId}/block`);
