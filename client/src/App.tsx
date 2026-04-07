import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import AuctionRoom from './components/AuctionRoom';

const App = () => {
  return (
    <Routes>
      <Route path='/login' element={<Login />} />
      <Route path='/auction' element={<AuctionRoom />} />
      <Route path='/' element={<Login />} />
    </Routes>
  );
};

export default App;
