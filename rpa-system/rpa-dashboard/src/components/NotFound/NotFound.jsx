import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './NotFound.css';

const NotFound = () => {
 const navigate = useNavigate();
 const location = useLocation();

 return (
 <div className="not-found-container">
 <div className="not-found-content">
 <h1 className="not-found-title">404</h1>
 <h2 className="not-found-subtitle">Route not found</h2>
 <p className="not-found-message">
 The page you're looking for doesn't exist.
 </p>
 <p className="not-found-path">
 <code>{location.pathname}</code>
 </p>
 <div className="not-found-actions">
 <button 
 onClick={() => navigate(-1)}
 className="not-found-button not-found-button-secondary"
 >
 Go Back
 </button>
 <button 
 onClick={() => navigate('/')}
 className="not-found-button not-found-button-primary"
 >
 Go Home
 </button>
 </div>
 </div>
 </div>
 );
};

export default NotFound;

