import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getStudentById, updateStudent } from '../../services/adminService';

const StudentEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    enrollmentNo: '',
    classYear: '',
    semester: '',
    password: ''
  });
  const [faceImage, setFaceImage] = useState(null);

  useEffect(() => {
    fetchStudent();
  }, [id]);

  const fetchStudent = async () => {
    try {
      setLoading(true);
      const data = await getStudentById(id);
      const student = data.student;
      setFormData({
        fullName: student.fullName || '',
        email: student.email || '',
        enrollmentNo: student.enrollmentNo || '',
        classYear: student.classYear || '',
        semester: student.semester || '',
        password: ''
      });
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch student details');
      console.error('Error fetching student:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = new FormData();
      submitData.append('fullName', formData.fullName);
      submitData.append('email', formData.email);
      submitData.append('enrollmentNo', formData.enrollmentNo);
      submitData.append('classYear', formData.classYear);
      submitData.append('semester', formData.semester);
      if (formData.password) {
        submitData.append('password', formData.password);
      }
      if (faceImage) {
        submitData.append('faceImage', faceImage);
      }

      await updateStudent(id, submitData);
      alert('Student updated successfully!');
      navigate(`/admin/students/${id}`);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update student');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <Link
          to="/admin/students"
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Students
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <Link
          to={`/admin/students/${id}`}
          className="text-gray-600 hover:text-gray-900"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Edit Student</h1>
          <p className="text-gray-600 mt-1">Update student information</p>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              required
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Enrollment Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Enrollment Number *</label>
            <input
              type="text"
              required
              value={formData.enrollmentNo}
              onChange={(e) => setFormData({ ...formData, enrollmentNo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Class Year and Semester */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class Year *</label>
              <select
                required
                value={formData.classYear}
                onChange={(e) => setFormData({ ...formData, classYear: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Year</option>
                <option value="1">1 (First Year)</option>
                <option value="2">2 (Second Year)</option>
                <option value="3">3 (Third Year)</option>
                <option value="4">4 (Final Year)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Semester *</label>
              <select
                required
                value={formData.semester}
                onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Semester</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
                <option value="7">7</option>
                <option value="8">8</option>
              </select>
            </div>
          </div>

          {/* Password (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password (Leave blank to keep current)
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter new password if changing"
              minLength={6}
            />
          </div>

          {/* Face Image (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Face Image (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFaceImage(e.target.files[0])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">Upload a new photo to update face recognition</p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Link
              to={`/admin/students/${id}`}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentEdit;
