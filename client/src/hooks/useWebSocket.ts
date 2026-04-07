import { useState, useEffect, useRef, useCallback } from 'react';
import { WS_URL } from '../config/api';
import { AuctionState } from '../types';

interface UseWebSocketReturn {
  auctionState: AuctionState | null;
  isConnected: boolean;
  lastEvent: { event: string; data: any } | null;
}

export const useWebSocket = (): UseWebSocketReturn => {
  const [auctionState, setAuctionState] = useState<AuctionState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<{ event: string; data: any } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastEvent(message);

        if (message.data && typeof message.data === 'object') {
          // Check if it's auction state data
          if (message.data.current_player !== undefined || message.data.current_bid !== undefined) {
            setAuctionState(message.data);
          } else if (message.data.current_auction) {
            // Handle nested auction state from /api/auction/state
            setAuctionState({
              ...message.data.current_auction,
              current_player: message.data.current_player,
              current_team_name: message.data.highest_bid?.team_name
            });
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      wsRef.current = null;

      // Auto reconnect after 3 seconds
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return { auctionState, isConnected, lastEvent };
};