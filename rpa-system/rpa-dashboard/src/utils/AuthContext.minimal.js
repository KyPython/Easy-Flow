import React, { createContext, useContext, useState } from 'react';
import PropTypes from 'prop-types';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user] = useState(null);
  const [loading] = useState(false);
  const [session] = useState(null);

  const value = {
    user,
    session,
    loading,
    signIn: async () => {},
    signUp: async () => {},
    signOut: async () => {},
    resetPassword: async () => {}
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};
