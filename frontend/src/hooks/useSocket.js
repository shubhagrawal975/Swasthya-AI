/**
 * useSocket — Socket.IO connection hook for teleconsultation
 * Connects to backend with JWT auth, provides real-time queue/consultation events
 */
import { useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = (import.meta.env.VITE_API_URL || '/api').replace('/api', '');

export function useSocket() {
  const socketRef = useRef(null);
  const { accessToken } = useAuthStore();

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return socketRef.current;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('Socket connected:', socket.id));
    socket.on('disconnect', (reason) => console.log('Socket disconnected:', reason));
    socket.on('error', (err) => console.error('Socket error:', err));

    socketRef.current = socket;
    return socket;
  }, [accessToken]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);

  const emit = useCallback((event, data) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const on = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.on(event, handler);
    }
  }, []);

  const off = useCallback((event, handler) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler);
    }
  }, []);

  useEffect(() => {
    return () => { disconnect(); };
  }, []);

  return { connect, disconnect, emit, on, off, socket: socketRef.current };
}

export default useSocket;
