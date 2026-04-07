import React, { useState } from 'react';
import { authAPI } from '../services/api';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    authAPI.login(username, password)
      .then(token => {
        localStorage.setItem('access_token', token.access_token);
        window.location.href = '/auction';
      })
      .catch(err => setError('Login failed: ' + err.message));
  };

  return (
    <div className='container mx-auto w-full max-w-md p-10'>
      <div className='bg-black text-white p-6 rounded-lg shadow-md'>
        <h2 className='text-2xl font-bold text-center mb-4'>Login</h2>
        <form className='space-y-4'>
          <div className='flex items-center mb-3'>
            <label className='mr-2'>Username:</label>
            <input type='text' placeholder='Username' value={username} onChange={e => setUsername(e.target.value)} required className='border border-gray-400 rounded-md p-2' />
          </div>
          <div className='flex items-center mb-3'>
            <label className='mr-2'>Password:</label>
            <input type='password' placeholder='Password' value={password} onChange={e => setPassword(e.target.value)} required className='border border-gray-400 rounded-md p-2' />
          </div>
          {error && <div className='text-red-500 text-sm mt-2'>Error: {error}</div>}
          <button type='submit' className='w-full bg-blue-500 text-white px-4 py-2 rounded-md'>Login</button>
        </form>
      </div>
    </div>
  );
};
export default Login;