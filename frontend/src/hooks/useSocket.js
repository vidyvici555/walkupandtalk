'use client';
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function useSocket(userId) {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const token = localStorage.getItem('wuag_token');
    if (!token) return;

    socketRef.current = io(BACKEND_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('join_user_room', userId);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [userId]);

  const joinMatch = useCallback((matchId) => {
    socketRef.current?.emit('join_match_room', matchId);
  }, []);

  const leaveMatch = useCallback((matchId) => {
    socketRef.current?.emit('leave_match_room', matchId);
  }, []);

  const on = useCallback((event, handler) => {
    socketRef.current?.on(event, handler);
    return () => socketRef.current?.off(event, handler);
  }, []);

  const emit = useCallback((event, data) => {
    socketRef.current?.emit(event, data);
  }, []);

  return { joinMatch, leaveMatch, on, emit, socket: socketRef.current };
}
