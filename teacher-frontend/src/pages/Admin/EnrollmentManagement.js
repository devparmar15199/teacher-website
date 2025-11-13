import React, { useState, useEffect } from 'react';
import { 
  getAllStudents, 
  enrollStudent, 
  bulkEnrollStudents,
  getClassEnrollments,
  unenrollStudent,
  getAllClasses 
} from '../../services/adminService';

const EnrollmentManagement = () => {
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  
  // Filters for classes
  const [filterSubject, setFilterSubject] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [filterSemester, setFilterSemester] = useState('');

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const data = await getAllClasses();
      setClasses(data.classes || []);
    } catch (err) {
      console.error('Error fetching classes:', err);
      setError('Failed to fetch classes');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await getAllStudents({ limit: 1000 });
      setStudents(data.students || []);
    } catch (err) {
      console.error('Error fetching students:', err);
    }
  };

  const fetchEnrolledStudents = async (classId) => {
    try {
      const data = await getClassEnrollments(classId);
      setEnrolledStudents(data.enrollments || []);
      setError('');
    } catch (err) {
      setError('Failed to fetch enrolled students');
      console.error('Error:', err);
    }
  };

  const openEnrollModal = async (classItem) => {
    setSelectedClass(classItem);
    setShowEnrollModal(true);
    await fetchStudents();
    await fetchEnrolledStudents(classItem._id);
  };

  const handleEnroll = async () => {
    if (selectedStudents.length === 0) {
      setError('Please select at least one student');
      return;
    }

    try {
      if (selectedStudents.length === 1) {
        await enrollStudent({ 
          studentId: selectedStudents[0], 
          classId: selectedClass._id 
        });
      } else {
        await bulkEnrollStudents({ 
          studentIds: selectedStudents, 
          classId: selectedClass._id 
        });
      }
      
      setSuccess(`Successfully enrolled ${selectedStudents.length} student(s)`);
      setSelectedStudents([]);
      await fetchEnrolledStudents(selectedClass._id);
      await fetchClasses(); // Refresh to update enrollment counts
      setError('');
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to enroll students');
    }
  };

  const handleUnenroll = async (studentId) => {
    if (!window.confirm('Are you sure you want to unenroll this student?')) {
      return;
    }

    try {
      await unenrollStudent({ studentId, classId: selectedClass._id });
      setSuccess('Student unenrolled successfully');
      await fetchEnrolledStudents(selectedClass._id);
      await fetchClasses(); // Refresh to update enrollment counts
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to unenroll student');
    }
  };

  const toggleSelectStudent = (id) => {
    if (selectedStudents.includes(id)) {
      setSelectedStudents(selectedStudents.filter(sid => sid !== id));
    } else {
      setSelectedStudents([...selectedStudents, id]);
    }
  };

  const filteredStudents = students.filter(student => {
    const matchesSearch = (student.fullName?.toLowerCase() || '').includes(studentSearchTerm.toLowerCase()) ||
                         (student.enrollmentNo?.toLowerCase() || '').includes(studentSearchTerm.toLowerCase());
    const notEnrolled = !enrolledStudents.some(e => e.studentId?._id === student._id);
    
    // Only show students who match the class year and semester
    const matchesYear = selectedClass && student.classYear === selectedClass.classYear;
    const matchesSemester = selectedClass && student.semester === selectedClass.semester;
    
    return matchesSearch && notEnrolled && matchesYear && matchesSemester;
  });

  // Filter classes
  const filteredClasses = classes.filter(cls => {
    const matchesSubject = !filterSubject || 
      (cls.subjectName?.toLowerCase() || '').includes(filterSubject.toLowerCase()) ||
      (cls.subjectCode?.toLowerCase() || '').includes(filterSubject.toLowerCase());
    const matchesYear = !filterYear || cls.classYear === filterYear;
    const matchesSemester = !filterSemester || cls.semester === filterSemester;
    const matchesSearch = !searchTerm ||
      (cls.subjectName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (cls.subjectCode?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (cls.teacherId?.fullName?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    return matchesSubject && matchesYear && matchesSemester && matchesSearch;
  });

  // Get unique values for filters
  const years = [...new Set(classes.map(c => c.classYear))].filter(Boolean).sort();
  const semesters = [...new Set(classes.map(c => c.semester))].filter(Boolean).sort();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Enrollment Management</h1>
        <p className="text-gray-600 mt-2">Manage student enrollments for all classes</p>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search by subject or teacher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Year Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Class Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Years</option>
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Semester</label>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Semesters</option>
              {semesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
          </div>

          {/* Results Count */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Results</label>
            <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-700">
              {filteredClasses.length} of {classes.length} classes
            </div>
          </div>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
          </div>
        ) : filteredClasses.length === 0 ? (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No classes found</h3>
            <p className="mt-1 text-sm text-gray-500">Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {filteredClasses.map((cls) => (
              <div key={cls._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{cls.subjectName}</h3>
                    <p className="text-sm text-gray-600">{cls.subjectCode}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {cls.enrollmentCount || 0} students
                  </span>
                </div>
                
                <div className="space-y-1 text-sm text-gray-600 mb-3">
                  <p>Class: {cls.classNumber}</p>
                  <p>Year: {cls.classYear} • Semester: {cls.semester}</p>
                  {cls.teacherId && <p>Teacher: {cls.teacherId.fullName}</p>}
                </div>

                <button
                  onClick={() => openEnrollModal(cls)}
                  className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
                >
                  Manage Enrollments
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Enrollment Modal */}
      {showEnrollModal && selectedClass && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedClass.subjectName}</h2>
                <p className="text-sm text-gray-600">{selectedClass.subjectCode} • {selectedClass.classNumber}</p>
              </div>
              <button
                onClick={() => {
                  setShowEnrollModal(false);
                  setSelectedClass(null);
                  setSelectedStudents([]);
                  setEnrolledStudents([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Available Students */}
                <div className="border border-gray-200 rounded-lg">
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Students</h3>
                    <p className="text-xs text-gray-600 mb-3">
                      Only showing students in Year {selectedClass.classYear} - Semester {selectedClass.semester}
                    </p>
                    
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />

                    {selectedStudents.length > 0 && (
                      <div className="flex items-center justify-between bg-green-50 p-3 rounded-lg mt-3">
                        <span className="text-sm text-green-800 font-medium">
                          {selectedStudents.length} selected
                        </span>
                        <button
                          onClick={handleEnroll}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm font-medium"
                        >
                          Enroll Selected
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {filteredStudents.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        {studentSearchTerm ? 'No students match your search' : 'All students are already enrolled'}
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {filteredStudents.map((student) => (
                          <div
                            key={student._id}
                            className="p-3 hover:bg-gray-50 cursor-pointer flex items-center"
                            onClick={() => toggleSelectStudent(student._id)}
                          >
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student._id)}
                              onChange={() => {}}
                              className="rounded border-gray-300 text-green-600 focus:ring-green-500 mr-3"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">{student.fullName || 'N/A'}</div>
                              <div className="text-xs text-gray-500">
                                {student.enrollmentNo || 'N/A'} • Year {student.classYear || 'N/A'} - Sem {student.semester || 'N/A'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Enrolled Students */}
                <div className="border border-gray-200 rounded-lg">
                  <div className="p-4 bg-gray-50 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Enrolled Students ({enrolledStudents.length})
                    </h3>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {enrolledStudents.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No students enrolled yet
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200">
                        {enrolledStudents.map((enrollment) => (
                          <div
                            key={enrollment._id}
                            className="p-3 hover:bg-gray-50 flex items-center justify-between"
                          >
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {enrollment.studentId?.fullName || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">
                                {enrollment.studentId?.enrollmentNo || 'N/A'} • 
                                Enrolled: {new Date(enrollment.enrolledAt).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              onClick={() => handleUnenroll(enrollment.studentId._id)}
                              className="text-red-600 hover:text-red-900 text-sm font-medium"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnrollmentManagement;
