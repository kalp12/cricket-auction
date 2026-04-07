import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { AuctionState } from '../types';
import {auctionAPI} from '../services/api';
import { useLocation } from 'react-router-dom';

const AuctionRoom = () => {
  const { auctionState, isConnected, lastEvent } = useWebSocket();
  const [currentBid, setCurrentBid] = useState(0);
  const [teamId, setTeamId] = useState(0);
  const [error, setError] = useState('');
  const location = useLocation();
  const [playerId, setPlayerId] = useState(0);

  useEffect(() => {
    if (location.pathname === '/auction') {
      auctionAPI.getAuctionState().then(state => {
              });
    }
  }, [location]);

  const handleBid = () => {
    if (currentBid <= 0) {
      setError('Please enter a valid bid amount');
      return;
    }

    auctionAPI.placeBid(teamId, currentBid)
      .then(newState => {
                setCurrentBid(0);
        setTeamId(0);
        setError('');
      })
      .catch(err => {
        setError('Bid failed: ' + err.message);
      });
  };

  const handleSold = () => {
    auctionAPI.soldPlayer()
      .then(() => {
        // Refresh state
        auctionAPI.getAuctionState().then();
      })
      .catch(err => {
        setError('Sold failed: ' + err.message);
      });
  };

  const handleUnsold = () => {
    auctionAPI.unsoldPlayer()
      .then(() => {
        // Refresh state
        auctionAPI.getAuctionState().then();
      })
      .catch(err => {
        setError('Unsold failed: ' + err.message);
      });
  };

  const handlePause = () => {
    auctionAPI.pauseAuction()
      .then(newState => {
              })
      .catch(err => {
        setError('Pause failed: ' + err.message);
      });
  };

  const handleResume = () => {
    auctionAPI.resumeAuction()
      .then(newState => {
              })
      .catch(err => {
        setError('Resume failed: ' + err.message);
      });
  };

  return (
    <div className='min-h-screen bg-gray-100'>
      <div className='container mx-auto px-4'>
        <div className='flex items-center justify-between mb-6'>
          <h1 className='text-3xl font-bold text-gray-800'>Cricket Auction</h1>
          <div className='flex items-center'>
            <button onClick={handlePause} className='bg-blue-500 text-white px-4 py-2 rounded-md mr-2'>Pause</button>
            <button onClick={handleResume} className='bg-green-500 text-white px-4 py-2 rounded-md'>Resume</button>
            <button onClick={handleSold} className='bg-red-500 text-white px-4 py-2 rounded-md'>Mark Sold</button>
            <button onClick={handleUnsold} className='bg-gray-500 text-white px-4 py-2 rounded-md'>Mark Unsold</button>
          </div>
        </div>

        {auctionState && (
          <div className='bg-white rounded-lg shadow-md p-6'>
            <div className='flex items-center mb-4'>
              <div className='flex-1'>
                <h2 className='text-xl font-bold'>Current Player: {auctionState.current_player?.name || 'No player'}</h2>
                <p className='text-gray-600'>Current Bid: ${auctionState.current_bid}</p>
              </div>
              <div>
                <button onClick={handleSold} className='bg-red-500 text-white px-4 py-2 rounded-md'>Sell</button>
              </div>
            </div>

            <div className='flex items-center mb-4'>
              <div className='flex-1'>
                <h3 className='text-lg font-bold'>Place Bid</h3>
                <div className='mt-2'>
                  <input
                    type='number'
                    value={currentBid}
                    onChange={(e) => setCurrentBid(parseInt(e.target.value))}
                    placeholder='Enter bid amount'
                    className='border border-gray-300 rounded-md p-2 w-full'
                  />
                </div>
              </div>
              <div>
                <button onClick={handleBid} className='bg-blue-500 text-white px-4 py-2 rounded-md'>Place Bid</button>
              </div>
            </div>
          </div>
        )}

        {error && <div className='text-red-500 text-center mt-4'>{error}</div>}
      </div>
    </div>
  );
};

export default AuctionRoom;