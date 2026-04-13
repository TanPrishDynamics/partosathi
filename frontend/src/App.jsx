import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';

import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import PatientList from './pages/PatientList';
import NewPatient from './pages/NewPatient';

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkToken = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const resp = await axios.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          setUser(resp.data);
        } catch (err) {
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };
    checkToken();
  }, []);

  if (loading) return null;

  return (
    <Router>
      <Routes>
        <Route 
          path="/login" 
          element={!user ? <LoginPage onLogin={setUser} /> : <Navigate to="/patients" />} 
        />
        
        <Route 
          path="/dashboard/:id" 
          element={user ? <Dashboard /> : <Navigate to="/login" />} 
        />
        
        <Route 
          path="/patients" 
          element={user ? <PatientList /> : <Navigate to="/login" />} 
        />
        
        <Route 
          path="/new-patient" 
          element={user ? <NewPatient /> : <Navigate to="/login" />} 
        />

        <Route path="/" element={<Navigate to={user ? "/patients" : "/login"} />} />
      </Routes>
    </Router>
  );
};

export default App;
