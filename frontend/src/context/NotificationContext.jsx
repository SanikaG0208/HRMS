// src/context/NotificationContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from '../config/axios';
import API_ENDPOINTS from '../config/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [todayEvents, setTodayEvents] = useState({ birthdays: [], anniversaries: [], total: 0 });
  const [toastMessage, setToastMessage] = useState(null);
  const [employeeUpdate, setEmployeeUpdate] = useState(Date.now()); // Track employee changes

  // Function to trigger employee list refresh
  const triggerEmployeeUpdate = useCallback(() => {
    setEmployeeUpdate(Date.now());
  }, []);
  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    };
    
    setToastMessage(notification);
    
    if (duration > 0) {
      setTimeout(() => {
        setToastMessage(null);
      }, duration);
    }
  }, []);

  // Fetch today's events
  const fetchTodayEvents = useCallback(async (signal) => {
    // Don't fetch if no user or token
    if (!user || !token) {
      console.log('⚠️ No user or token, skipping fetch today events');
      return;
    }

    try {
      const response = await axios.get(API_ENDPOINTS.TODAY_EVENTS, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal,
      });
      
      setTodayEvents(response.data);
    } catch (error) {
      if (axios.isCancel?.(error) || error.code === 'ERR_CANCELED') return;
      console.error('❌ Error fetching today events:', error);
    }
  }, [user, token]);

  // Clear toast message
  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Load today's celebration data once per session; it is not an in-app alert feed.
  useEffect(() => {
    if (!(user && token)) return;
    // AbortController so React 18 StrictMode's dev-only double-invoke of this effect
    // cancels the first (throwaway) request instead of both completing.
    const controller = new AbortController();
    fetchTodayEvents(controller.signal);
    return () => controller.abort();
  }, [user?.employeeId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    todayEvents,
    fetchTodayEvents,
    
    showNotification,
    clearToast,
    
    // Employee update trigger
    employeeUpdate,
    triggerEmployeeUpdate
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Optional: Simple Toast Component */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            minWidth: '250px',
            maxWidth: '350px',
            backgroundColor: toastMessage.type === 'success' ? '#d4edda' : 
                           toastMessage.type === 'danger' ? '#f8d7da' : 
                           toastMessage.type === 'warning' ? '#fff3cd' : '#d1ecf1',
            color: toastMessage.type === 'success' ? '#155724' : 
                   toastMessage.type === 'danger' ? '#721c24' : 
                   toastMessage.type === 'warning' ? '#856404' : '#0c5460',
            border: `1px solid ${toastMessage.type === 'success' ? '#c3e6cb' : 
                                 toastMessage.type === 'danger' ? '#f5c6cb' : 
                                 toastMessage.type === 'warning' ? '#ffeeba' : '#bee5eb'}`,
            borderRadius: '4px',
            padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'slideIn 0.3s ease'
          }}
        >
          <span>{toastMessage.message}</span>
          <button
            onClick={clearToast}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              marginLeft: '12px',
              color: 'inherit',
              opacity: 0.7
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Add animation style */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </NotificationContext.Provider>
  );
};