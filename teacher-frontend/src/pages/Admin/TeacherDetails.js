import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getTeacherById } from '../../services/adminService';
import { getTeacherClasses } from '../../services/classService';
import { getTeacherSchedules } from '../../services/scheduleService';

const TeacherDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [classes, setClasses] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('classes'); // 'classes' or 'schedules'

  useEffect(() => {
    fetchTeacherDetails();
  }, [id]);

  const fetchTeacherDetails = async () => {
    try {
      setLoading(true);
      const [teacherData, classesData, schedulesData] = await Promise.all([
        getTeacherById(id),
        getTeacherClasses(id),
        getTeacherSchedules(id)
      ]);

      console.log('Teacher data:', teacherData);
      console.log('Classes data:', classesData);
      console.log('Schedules data:', schedulesData);

      // Extract teacher from response
      setTeacher(teacherData.teacher || teacherData);
      setClasses(classesData.classes || []);
      setSchedules(schedulesData.schedules || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch teacher details');
      console.error('Error fetching teacher details:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
        <button
          onClick={() => navigate('/admin/teachers')}
          className="text-purple-600 hover:text-purple-800"
        >
          ← Back to Teachers
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/teachers')}
            className="text-purple-600 hover:text-purple-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{teacher?.fullName || 'Teacher'}</h1>
            <p className="text-gray-600 mt-1">{teacher?.email}</p>
          </div>
        </div>
        <Link
          to={`/admin/teachers/${id}/edit`}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition"
        >
          Edit Teacher
        </Link>
      </div>

      {/* Teacher Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Classes</p>
              <p className="text-2xl font-bold text-gray-900">{classes.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-green-100 rounded-full p-3">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Schedules</p>
              <p className="text-2xl font-bold text-gray-900">{schedules.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="bg-yellow-100 rounded-full p-3">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Students</p>
              <p className="text-2xl font-bold text-gray-900">
                {classes.reduce((sum, cls) => sum + (cls.enrollmentCount || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('classes')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'classes'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Classes ({classes.length})
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === 'schedules'
                  ? 'border-purple-600 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Schedules ({schedules.length})
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'classes' ? (
            <div>
              {classes.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No classes found</h3>
                  <p className="mt-1 text-sm text-gray-500">This teacher hasn't created any classes yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {classes.map((cls) => (
                    <div key={cls._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <h3 className="font-semibold text-lg text-gray-900">{cls.subjectName || 'N/A'}</h3>
                      <p className="text-sm text-gray-600 mt-1">{cls.subjectCode || 'N/A'}</p>
                      <div className="mt-3 space-y-1 text-sm text-gray-500">
                        <p>Class: {cls.classNumber || 'N/A'}</p>
                        <p>Year: {cls.classYear || 'N/A'}</p>
                        <p>Division: {cls.division || 'N/A'}</p>
                        <p>Students: {cls.enrollmentCount || 0}</p>
                      </div>
                      <Link
                        to={`/classes/${cls._id}`}
                        className="mt-4 inline-block text-purple-600 hover:text-purple-800 text-sm font-medium"
                      >
                        View Details →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              {schedules.length === 0 ? (
                <div className="text-center py-12">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No schedules found</h3>
                  <p className="mt-1 text-sm text-gray-500">This teacher hasn't created any schedules yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {schedules.map((schedule) => (
                    <div key={schedule._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-lg text-gray-900">
                            {schedule.classId?.subjectName || 'N/A'}
                          </h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {schedule.dayOfWeek || 'N/A'}
                          </p>
                        </div>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                          schedule.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-4 text-sm text-gray-500">
                        <div>
                          <p>Time: {schedule.startTime || 'N/A'} - {schedule.endTime || 'N/A'}</p>
                          <p>Room: {schedule.roomNumber || 'N/A'}</p>
                        </div>
                        <div>
                          <p>Type: {schedule.sessionType || 'N/A'}</p>
                          <p>Semester: {schedule.semester || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <p>Academic Year: {schedule.academicYear || 'N/A'}</p>
                      </div>
                      <Link
                        to={`/schedule/${schedule._id}`}
                        className="mt-3 inline-block text-purple-600 hover:text-purple-800 text-sm font-medium"
                      >
                        View Details →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherDetails;
