import client from './client';

export const getDeck = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.state) params.set('state', filters.state);
  if (filters.minAge) params.set('minAge', filters.minAge);
  if (filters.maxAge) params.set('maxAge', filters.maxAge);
  return client.get(`/swipe/deck?${params.toString()}`);
};

export const swipe = (targetUserId, direction) =>
  client.post('/swipe', { targetUserId, direction });

export const undoSwipe = () => client.delete('/swipe/undo');

export const getSwipesRemaining = () => client.get('/swipe/remaining');
