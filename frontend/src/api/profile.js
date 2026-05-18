import client from './client';

export const getMyProfile = () => client.get('/profile/me');
export const getProfile = (userId) => client.get(`/profile/${userId}`);
export const updateProfile = (data) => client.put('/profile', data);
export const uploadPhotos = (formData) =>
  client.post('/profile/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
export const deletePhoto = (photoId) => client.delete(`/profile/photos/${photoId}`);
export const setPrimaryPhoto = (photoId) => client.put(`/profile/photos/${photoId}/primary`);
