import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export function useSocket(token: string | null, handlers: Record<string, (data:any)=>void>) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({ auth: { token } });
    socketRef.current = socket;
    socket.on('connect', () => socket.emit('join:round'));
    Object.entries(handlers).forEach(([evt, fn]) => socket.on(evt, fn));
    return () => {
      Object.keys(handlers).forEach((evt) => socket.off(evt));
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return socketRef;
}
