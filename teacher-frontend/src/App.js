import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import ClassList from './pages/Classes/ClassList';
import ClassDetails from './pages/Classes/ClassDetails';
import ClassStudents from './pages/Classes/ClassStudents';
import ClassReports from './pages/Classes/ClassReports';
import NewClassReports from './pages/Classes/NewClassReports';
import AttendancePage from './pages/Attendance';
import SchedulePage from './pages/Schedule';
import SettingsPage from './pages/Settings';
import ProfilePage from './pages/Profile';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import NewRegister from './pages/NewRegister';
import NewLogin from './pages/NewLogin';

// Admin Pages
import AdminDashboard from './pages/Admin/AdminDashboard';
import StudentManagement from './pages/Admin/StudentManagement';
import StudentDetails from './pages/Admin/StudentDetails';
import StudentEdit from './pages/Admin/StudentEdit';
import TeacherManagement from './pages/Admin/TeacherManagement';
import TeacherDetails from './pages/Admin/TeacherDetails';
import TeacherEdit from './pages/Admin/TeacherEdit';
import ClassManagement from './pages/Admin/ClassManagement';
import ScheduleManagement from './pages/Admin/ScheduleManagement';
import AttendanceRecords from './pages/Admin/AttendanceRecords';
import EnrollmentManagement from './pages/Admin/EnrollmentManagement';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<NewLogin />} />
            <Route path="/register" element={<NewRegister />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="classes" element={<ClassList />} />
              <Route path="classes/:id" element={<ClassDetails />} />
              <Route path="classes/:id/students" element={<ClassStudents />} />
              <Route path="classes/:id/reports" element={<ClassReports />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              
              {/* Admin Routes */}
              <Route path="admin" element={<AdminDashboard />} />
              <Route path="admin/students" element={<StudentManagement />} />
              <Route path="admin/students/:id" element={<StudentDetails />} />
              <Route path="admin/students/:id/edit" element={<StudentEdit />} />
              <Route path="admin/teachers" element={<TeacherManagement />} />
              <Route path="admin/teachers/:id" element={<TeacherDetails />} />
              <Route path="admin/teachers/:id/edit" element={<TeacherEdit />} />
              <Route path="admin/classes" element={<ClassManagement />} />
              <Route path="admin/classes/:id" element={<ClassDetails />} />
              <Route path="admin/classes/:id/students" element={<ClassStudents />} />
              <Route path="admin/classes/:id/reports" element={<ClassReports />} />
              <Route path="admin/schedules" element={<ScheduleManagement />} />
              <Route path="admin/attendance-records" element={<AttendanceRecords />} />
              <Route path="admin/enrollments" element={<EnrollmentManagement />} />
            </Route>
          </Routes>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                theme: {
                  primary: 'green',
                  secondary: 'black',
                },
              },
            }}
          />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;