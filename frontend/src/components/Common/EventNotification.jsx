// components/Common/EventNotification.jsx
import React from 'react';
import { Alert, Badge } from 'react-bootstrap';
import { FaBirthdayCake, FaTrophy, FaTimes } from 'react-icons/fa';
// import { useNotification } from '../../context/NotificationContext';

const EventNotification = ({ event, onClose }) => {
  const getIcon = () => {
    switch (event.type) {
      case 'birthday':
        return <FaBirthdayCake className="me-2" size={18} color="#ff6b6b" />;
      case 'anniversary':
        return <FaTrophy className="me-2" size={18} color="#ffd700" />;
      default:
        return null;
    }
  };

  const getBgColor = () => {
    switch (event.type) {
      case 'birthday':
        return '#fff0f0';
      case 'anniversary':
        return '#fff9e6';
      default:
        return '#f8f9fa';
    }
  };

  const getBorderColor = () => {
    switch (event.type) {
      case 'birthday':
        return '#ff6b6b';
      case 'anniversary':
        return '#ffd700';
      default:
        return '#dee2e6';
    }
  };

  return (
    <div 
      className="position-relative mb-2 p-2 rounded"
      style={{
        backgroundColor: getBgColor(),
        borderLeft: `4px solid ${getBorderColor()}`,
        opacity: event.read ? 0.7 : 1,
        transition: 'opacity 0.3s ease'
      }}
    >
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#999'
        }}
      >
        <FaTimes size={10} />
      </button>
      
      <div className="d-flex align-items-center">
        {getIcon()}
        <div className="flex-grow-1">
          <p className="mb-0 small fw-semibold">{event.message}</p>
          <div className="d-flex gap-2 mt-1">
            <Badge bg="light" text="dark" className="px-2 py-0">
              {event.employee.department}
            </Badge>
            <Badge bg="light" text="dark" className="px-2 py-0">
              {event.employee.position}
            </Badge>
            {event.years && (
              <Badge bg="warning" className="px-2 py-0">
                {event.years} Year{event.years > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventNotification;