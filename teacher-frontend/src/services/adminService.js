import api from './api';

// ========================= DASHBOARD =========================

export const getDashboardStats = async () => {
  const response = await api.get('/admin/dashboard/stats');
  return response.data;
};

// ========================= STUDENT MANAGEMENT =========================

export const getAllStudents = async (params = {}) => {
  const response = await api.get('/admin/students', { params });
  return response.data;
};

export const getPendingStudents = async (params = {}) => {
  const response = await api.get('/admin/students/pending', { params });
  return response.data;
};

export const getStudentById = async (id) => {
  const response = await api.get(`/admin/students/${id}`);
  return response.data;
};

export const createStudent = async (formData) => {
  const response = await api.post('/admin/students', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const updateStudent = async (id, formData) => {
  const response = await api.put(`/admin/students/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const deleteStudent = async (id) => {
  const response = await api.delete(`/admin/students/${id}`);
  return response.data;
};

export const bulkDeleteStudents = async (studentIds) => {
  const response = await api.post('/admin/students/bulk-delete', { studentIds });
  return response.data;
};

// ========================= TEACHER MANAGEMENT =========================

export const getAllTeachers = async (params = {}) => {
  const response = await api.get('/admin/teachers', { params });
  return response.data;
};

export const getTeacherById = async (id) => {
  const response = await api.get(`/admin/teachers/${id}`);
  return response.data;
};

export const createTeacher = async (data) => {
  const response = await api.post('/admin/teachers', data);
  return response.data;
};

export const updateTeacher = async (id, data) => {
  const response = await api.put(`/admin/teachers/${id}`, data);
  return response.data;
};

export const deleteTeacher = async (id) => {
  const response = await api.delete(`/admin/teachers/${id}`);
  return response.data;
};

// ========================= CLASS MANAGEMENT =========================

export const getAllClasses = async (params = {}) => {
  const response = await api.get('/admin/classes', { params });
  return response.data;
};

export const getClassById = async (id) => {
  const response = await api.get(`/admin/classes/${id}`);
  return response.data;
};

export const getAttendanceRecords = async (classId, params = {}) => {
  const response = await api.get(`/admin/attendance/class/${classId}`, { params });
  return response.data;
};

// ========================= ENROLLMENT MANAGEMENT =========================

export const enrollStudent = async (data) => {
  const response = await api.post('/admin/enrollments', data);
  return response.data;
};

export const bulkEnrollStudents = async (data) => {
  const response = await api.post('/admin/enrollments/bulk', data);
  return response.data;
};

export const unenrollStudent = async (data) => {
  const response = await api.delete('/admin/enrollments', { data });
  return response.data;
};

export const getClassEnrollments = async (classId) => {
  const response = await api.get(`/admin/enrollments/class/${classId}`);
  return response.data;
};

export const getStudentEnrollments = async (studentId) => {
  const response = await api.get(`/admin/enrollments/student/${studentId}`);
  return response.data;
};

// ========================= SCHEDULE MANAGEMENT =========================

export const getAllSchedules = async (params = {}) => {
  const response = await api.get('/admin/schedules', { params });
  return response.data;
};

export const createSchedule = async (data) => {
  const response = await api.post('/admin/schedules', data);
  return response.data;
};

export const updateSchedule = async (id, data) => {
  const response = await api.put(`/admin/schedules/${id}`, data);
  return response.data;
};

export const deleteSchedule = async (id) => {
  const response = await api.delete(`/admin/schedules/${id}`);
  return response.data;
};

export const createRecurringSchedule = async (data) => {
  const response = await api.post('/admin/recurring-schedules', data);
  return response.data;
};

export const getAllRecurringSchedules = async (params = {}) => {
  const response = await api.get('/admin/recurring-schedules', { params });
  return response.data;
};

export const deleteRecurringSchedule = async (scheduleId) => {
  const response = await api.delete(`/admin/recurring-schedules/${scheduleId}`);
  return response.data;
};

// ========================= CLASS CREATION (ADMIN) =========================

export const createClass = async (data) => {
  // data expected to include fields like classNumber, subjectCode, subjectName,
  // classYear, semester, division and optionally teacherId
  const response = await api.post('/admin/classes', data);
  return response.data;
};
