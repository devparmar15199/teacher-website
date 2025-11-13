import api from './api';

export const classService = {
  getClasses: async () => {
    try {
      const response = await api.get('/teacher/classes');
      console.log('Raw API response:', response);
      return response.data;
    } catch (error) {
      console.error('API Error:', error.response?.data || error.message);
      throw error;
    }
  },
  createClass: async (classData) => {
    const response = await api.post('/teacher/classes', classData);
    return response.data;
  },
  getClassById: async (id) => {
    const response = await api.get(`/teacher/classes/${id}`);
    return response.data;
  },
  updateClass: async (id, classData) => {
    const response = await api.put(`/teacher/classes/${id}`, classData);
    return response.data;
  },
  deleteClass: async (id) => {
    const response = await api.delete(`/teacher/classes/${id}`);
    return response.data;
  },
  getStudentsInClass: async (classId) => {
    const response = await api.get(`/teacher/attendance/class/${classId}/students`);
    return response.data;
  },
  
  // Get students enrolled in a class (for reports)
  getClassStudents: async (classId) => {
    const response = await api.get(`/teacher/attendance/class/${classId}/students`);
    return response.data;
  },
  
  enrollStudent: async (classId, studentId) => {
    const response = await api.post(`/student/classes/${classId}/enroll`, { studentId });
    return response.data;
  },
  
  enrollStudentByEnrollmentNo: async (classId, enrollmentNo) => {
    const response = await api.post(`/teacher/classes/${classId}/enroll-by-enrollment-no`, { enrollmentNo });
    return response.data;
  },
  
  // Get available students for enrollment in a class
  getAvailableStudentsForClass: async (classId) => {
    const response = await api.get(`/student/classes/${classId}/available-students`);
    return response.data;
  },
  
  // Teacher enroll single student
  teacherEnrollStudent: async (classId, studentId) => {
    const response = await api.post(`/student/classes/${classId}/enroll-student`, { studentId });
    return response.data;
  },
  
  // Teacher batch enroll students
  teacherBatchEnrollStudents: async (classId, studentIds) => {
    const response = await api.post(`/student/classes/${classId}/batch-enroll`, { studentIds });
    return response.data;
  },
  
  removeStudentFromClass: async (classId, studentId) => {
    const response = await api.delete(`/teacher/classes/${classId}/students/${studentId}`);
    return response.data;
  },
};

// Get classes for a specific teacher (for admin viewing)
export const getTeacherClasses = async (teacherId) => {
  const response = await api.get(`/admin/teachers/${teacherId}/classes`);
  return response.data;
};