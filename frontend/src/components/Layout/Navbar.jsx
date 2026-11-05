import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  FaEdit, FaUser, FaSignOutAlt, FaChevronDown, FaBullhorn
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { getSharedEmployeeProfile } from '../../utils/sharedEmployeeProfile';
import { Dropdown } from 'react-bootstrap';

const ROUTE_LABELS = {
  '/':                           'Dashboard',
  '/admin/dashboard':            'Dashboard',
  '/admin/employees':            'Employees',
  '/admin/add-employee':         'Add Employee',
  '/admin/leave-requests':       'Leave Requests',
  '/admin/attendance/reports':   'Attendance Reports',
  '/admin/attendance/dashboard': 'Attendance Dashboard',
  '/admin/ratings':              'Employee Ratings',
  '/admin/send-update-request':  'Send Update Request',
  '/admin/update-approvals':     'Update Approvals',
  '/admin/broadcast':            'Broadcast Center',
  '/profile':                    'My Profile',
  '/attendance':                 'Daily Attendance',
  '/apply-leave':                'Apply Leave',
  '/salary-slip':                'Payroll',
  '/employee/deductions': 'Payroll',
  '/employee/update-requests':   'Update Requests',
  '/manager/panel':              'My Team',
  '/admin/teams':                'Teams',
};

const Navbar = () => {
  const { user, logout }   = useAuth();
  const navigate           = useNavigate();
  const location           = useLocation();
  const [employeeName, setEmployeeName]             = useState('');
  const [activeNotice, setActiveNotice]             = useState(null);
  const [noticePaused, setNoticePaused]             = useState(false);

  // fetch on mount
  useEffect(() => {
    if (user) {
      fetchEmployeeName();
      fetchActiveNotice();
    }
  }, [user]);

  // re-fetch notice when admin saves — event-driven, no polling needed for everyone else
  useEffect(() => {
    const h = () => fetchActiveNotice();
    window.addEventListener('noticeBoardChanged', h);
    return () => window.removeEventListener('noticeBoardChanged', h);
  }, []);

  const fetchActiveNotice = async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.NOTICE_BOARD_ACTIVE);
      setActiveNotice(res.data.notice || null);
    } catch { /* silent */ }
  };

  const fetchEmployeeName = async () => {
    try {
      if (user?.role === 'admin') { setEmployeeName('Administrator'); return; }
      const res = await getSharedEmployeeProfile(user?.employeeId);
      if (res.data)
        setEmployeeName(`${res.data.first_name || ''} ${res.data.last_name || ''}`.trim() || 'Employee');
    } catch {
      setEmployeeName(user?.role === 'admin' ? 'Administrator' : user?.role === 'sub_admin' ? 'Manager' : user?.role === 'hr' ? 'HR' : 'Employee');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const pageLabel = (() => {
    const p = location.pathname;
    if (ROUTE_LABELS[p]) return ROUTE_LABELS[p];
    const f = Object.entries(ROUTE_LABELS).find(([k]) => p.startsWith(k) && k !== '/');
    return f ? f[1] : 'Dashboard';
  })();

  const noticeItalic = (activeNotice?.font_style || '').includes('italic');
  const noticeBold   = (activeNotice?.font_style || '').includes('bold');
  const noticeBg     = activeNotice?.background_color || 'var(--navbar-bg)';
  const noticeColor  = activeNotice?.text_color || '#2B2B2B';

  // ─────────────────────────────────────────────────────────────
  return (
    <>
    <nav className="hrms-app-navbar" style={{
        height: '60px',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        gap: '0',
        boxShadow: 'var(--shadow-sm)',
        borderBottom: '1px solid var(--border)',
        background: activeNotice ? noticeBg : 'var(--navbar-bg)',
        transition: 'background 0.35s ease',
      }}
    >
      {/* ── LEFT: page title ── */}
      <div style={{ flexShrink: 0 }}>
        <div style={{
          fontSize: '11px', fontWeight: 400, lineHeight: 1,
          color: activeNotice ? noticeColor : 'var(--text-muted)', opacity: 0.75,
        }}>
          {user?.role === 'admin' ? 'Admin' : user?.role === 'hr' ? 'HR' : user?.role === 'sub_admin' ? 'Manager' : user?.role === 'manager' ? 'TL' : 'Employee'} Portal
        </div>
        <div style={{
          fontSize: '15px', fontWeight: 700, lineHeight: 1.3, marginTop: '2px',
          color: activeNotice ? noticeColor : 'var(--text-primary)',
        }}>
          {pageLabel}
        </div>
      </div>

      {/* ── CENTRE: notice message ── */}
      {activeNotice ? (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflow: 'hidden',
          padding: '0 20px',
        }}>
          {/* label pill */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
            background: 'rgba(0,0,0,0.10)', borderRadius: '20px',
            padding: '3px 9px 3px 7px',
          }}>
            <FaBullhorn size={9} style={{ color: noticeColor }} />
            <span style={{
              fontSize: '15px', fontWeight: '700', letterSpacing: '0.5px',
              color: noticeColor, textTransform: 'uppercase',
            }}>Notice</span>
          </div>

          {/* divider */}
          <div style={{ width: '1px', height: '14px', background: 'rgba(0,0,0,0.18)', flexShrink: 0 }} />

          {/* message */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeNotice.display_type === 'static' ? (
              <span style={{
                fontSize: '13px', color: noticeColor,
                fontStyle: noticeItalic ? 'italic' : 'normal',
                fontWeight: noticeBold ? '700' : '500',
              }}>
                {activeNotice.message}
              </span>
            ) : (
              <div
                style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                onMouseEnter={() => setNoticePaused(true)}
                onMouseLeave={() => setNoticePaused(false)}
              >
                {/*
                  Seamless ticker: two identical halves side-by-side.
                  Animation shifts -50% (one half) so half-2 slides into half-1 with no gap.
                  20 reps per half = multiple copies always visible simultaneously.
                  90s / 20 reps = ~4.5s per sentence regardless of message length.
                */}
                <div style={{
                  display: 'inline-flex',
                  willChange: 'transform',
                  animation: noticePaused ? 'none'
                    : activeNotice.direction === 'left_to_right'
                      ? 'noticeScrollLTR 90s linear infinite'
                      : 'noticeScrollRTL 90s linear infinite',
                }}>
                  {[0, 1].map(half => (
                    <span key={half} style={{
                      display: 'inline-block',
                      whiteSpace: 'nowrap',
                      paddingRight: '3em',
                      fontSize: '19px',
                      color: noticeColor,
                      fontStyle: noticeItalic ? 'italic' : 'normal',
                      fontWeight: noticeBold ? '700' : '500',
                    }}>
                      {Array(20).fill(activeNotice.message).join('  ·  ')}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* spacer when no notice so right controls stay right */
        <div style={{ flex: 1 }} />
      )}

      {/* ── RIGHT: datetime + bell + profile ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>

        {/* DateTime pill */}
        {/* <div className="hrms-datetime d-none d-sm-flex">
          <FaClock size={11} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span className="time">{timeStr}</span>
          <span className="sep">|</span>
          <FaCalendarAlt size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span>{dateStr}</span>
        </div> */}

        {/* Divider */}
        <div style={{ width: '1px', height: '22px', background: 'var(--border)', flexShrink: 0 }} />

        {/* Profile dropdown */}
        <Dropdown align="end">
          <Dropdown.Toggle
            as="div"
            style={{
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 10px 4px 4px', background: 'var(--body-bg)',
              border: '1px solid var(--border)', borderRadius: '24px', userSelect: 'none',
            }}
          >
            <div className="hrms-profile-chip__avatar">{getInitials(employeeName)}</div>
            <div className="hrms-profile-chip__info d-none d-md-block">
              <div className="hrms-profile-chip__name">{employeeName}</div>
              <div className="hrms-profile-chip__role">
                {user?.role === 'admin' ? 'Admin' : user?.role === 'hr' ? 'HR' : user?.role === 'sub_admin' ? 'Manager' : user?.role === 'manager' ? 'TL' : user?.employeeId}
              </div>
            </div>
            <FaChevronDown size={9} style={{ color: 'var(--text-muted)', marginLeft: '2px' }} />
          </Dropdown.Toggle>

          <Dropdown.Menu style={{
            border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)', minWidth: '190px', padding: '6px', marginTop: '6px',
          }}>
            <div style={{ padding: '10px 12px 12px', borderBottom: '1px solid var(--border)', marginBottom: '6px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                color: 'white', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '13px', fontWeight: '700', marginBottom: '8px',
              }}>
                {getInitials(employeeName)}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{employeeName}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {user?.role === 'admin' ? 'Admin' : user?.role === 'hr' ? 'HR' : user?.role === 'sub_admin' ? 'Manager' : user?.role === 'manager' ? 'TL' : user?.employeeId}
              </div>
            </div>

            {(user?.role === 'employee' || user?.role === 'manager') && (
              <Dropdown.Item as={Link} to="/profile" style={{
                borderRadius: 'var(--radius-sm)', fontSize: '13px', padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)',
              }}>
                <FaUser size={12} style={{ color: 'var(--text-muted)' }} /> My Profile
              </Dropdown.Item>
            )}

            {['admin', 'sub_admin', 'hr'].includes(user?.role) && (
              <Dropdown.Item
                as={Link}
                to="/admin/update-requests"
                style={{
                  borderRadius: 'var(--radius-sm)', fontSize: '13px', padding: '8px 12px',
                  display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)',
                }}
              >
                <FaEdit size={12} style={{ color: 'var(--text-muted)' }} />
                Update Requests
              </Dropdown.Item>
            )}

            <Dropdown.Divider style={{ margin: '6px 0', borderColor: 'var(--border)' }} />

            <Dropdown.Item
              onClick={() => { logout(); navigate('/login'); }}
              style={{
                borderRadius: 'var(--radius-sm)', fontSize: '13px', padding: '8px 12px',
                display: 'flex', alignItems: 'center', gap: '8px',
                color: 'var(--danger)', fontWeight: '500',
              }}
            >
              <FaSignOutAlt size={12} /> Sign Out
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>

      </div>

    </nav>
    </>
  );
};

export default Navbar;
