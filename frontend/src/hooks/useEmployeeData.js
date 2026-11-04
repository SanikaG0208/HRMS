// hooks/useEmployeeData.js
import { useState, useEffect } from 'react';
import { useNotification } from '../context/NotificationContext';
import { getSharedEmployeeProfile, invalidateSharedEmployeeProfile } from '../utils/sharedEmployeeProfile';


export const useEmployeeData = (employeeId) => {
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { employeeUpdate, clearEmployeeUpdate } = useNotification();

  const fetchEmployee = async (forceRefresh = false) => {
    if (!employeeId) return;

    try {
      setLoading(true);
      if (forceRefresh) invalidateSharedEmployeeProfile(employeeId);
      const response = await getSharedEmployeeProfile(employeeId);
      setEmployee(response.data);
      setError('');
    } catch (err) {
      console.error('Error fetching employee:', err);
      setError('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchEmployee();
    }
  }, [employeeId]);

  useEffect(() => {
    if (employeeUpdate && employeeUpdate.employeeId === employeeId) {
      fetchEmployee(true);
      clearEmployeeUpdate();
    }
  }, [employeeUpdate, employeeId]);

  return { employee, loading, error, refresh: () => fetchEmployee(true) };
};
