// src/components/Employee/EmployeeNotices.jsx
import React, { useState, useEffect } from 'react';
import { Alert, Badge, Button, Modal, Spinner } from 'react-bootstrap';
import { FaBell, FaExclamationTriangle, FaTimes, FaEye } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

const EmployeeNotices = () => {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewNotice, setViewNotice] = useState(null);

  useEffect(() => { fetchNotices(); }, []);

  const fetchNotices = async () => {
    try {
      // Only fetch notices addressed TO this employee (not ones they sent)
      const res = await axios.get(`${API_ENDPOINTS.NOTICES}?type=received`);
      setNotices(res.data?.notices || []);
    } catch (err) {
      console.error('Error fetching notices:', err);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async (id) => {
    try {
      await axios.patch(API_ENDPOINTS.NOTICE_READ(id));
      setNotices(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error('Error marking notice as read:', err);
    }
  };

  const handleView = (notice) => {
    setViewNotice(notice);
    if (!notice.is_read) markRead(notice.id);
  };

  if (loading) return null;
  if (notices.length === 0) return null;

  // const unreadCount = notices.filter(n => !n.is_read).length;

  return (
    <>
      {notices.map(notice => (
        <Alert
          key={notice.id}
          variant={notice.type === 'warning' ? 'warning' : 'info'}
          className="mb-3 py-2 small d-flex align-items-start justify-content-between gap-2"
          style={{ borderLeft: `4px solid ${notice.type === 'warning' ? '#ffc107' : '#0dcaf0'}` }}
        >
          <div className="d-flex align-items-start gap-2 flex-grow-1">
            {notice.type === 'warning'
              ? <FaExclamationTriangle className="text-warning mt-1 flex-shrink-0" size={14} />
              : <FaBell className="text-info mt-1 flex-shrink-0" size={14} />}
            <div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <strong>{notice.title}</strong>
                {!notice.is_read && <Badge bg={notice.type === 'warning' ? 'warning' : 'info'} pill style={{ fontSize: '10px' }}>New</Badge>}
                <small className="text-muted">
                  From: {notice.sender_name || 'Admin'} · {new Date(notice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                </small>
              </div>
              <div className="text-truncate mt-1" style={{ maxWidth: '400px' }}>
                {notice.message.length > 80 ? notice.message.substring(0, 80) + '...' : notice.message}
              </div>
            </div>
          </div>
          <Button
            variant="link"
            size="sm"
            className="p-0 text-decoration-none flex-shrink-0"
            onClick={() => handleView(notice)}
            title="View full notice"
          >
            <FaEye size={14} />
          </Button>
        </Alert>
      ))}

      {/* View Modal */}
      <Modal show={!!viewNotice} onHide={() => setViewNotice(null)} centered>
        <Modal.Header
          closeButton
          className={viewNotice?.type === 'warning' ? 'bg-warning' : 'bg-info text-white'}
        >
          <Modal.Title as="h6" className="mb-0 small fw-semibold d-flex align-items-center gap-2">
            {viewNotice?.type === 'warning'
              ? <FaExclamationTriangle size={14} />
              : <FaBell size={14} />}
            {viewNotice?.type === 'warning' ? 'Warning' : 'Notice'}: {viewNotice?.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="small">
          {viewNotice && (
            <>
              <p className="mb-1 text-muted">
                <strong>From:</strong> {viewNotice.sender_name || 'Admin'} &nbsp;|&nbsp;
                <strong>Date:</strong> {new Date(viewNotice.created_at).toLocaleString('en-IN')}
              </p>
              <hr className="my-2" />
              <p className="mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                {viewNotice.message}
              </p>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setViewNotice(null)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default EmployeeNotices;
