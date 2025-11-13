import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { 
  HomeIcon, 
  AcademicCapIcon, 
  CalendarIcon, 
  ClockIcon, 
  UserIcon,
  CogIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  UsersIcon,
  ClipboardDocumentListIcon
} from '@heroicons/react/24/outline';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();
  
  // Teacher menu items
  const teacherMenuItems = [
    { name: 'Dashboard', icon: HomeIcon, path: '/' },
    { name: 'Classes', icon: AcademicCapIcon, path: '/classes' },
    { name: 'Attendance', icon: ClockIcon, path: '/attendance' },
    { name: 'Schedule', icon: CalendarIcon, path: '/schedule' },
    { name: 'Settings', icon: CogIcon, path: '/settings' },
    { name: 'Profile', icon: UserIcon, path: '/profile' },
  ];

  // Admin menu items
  const adminMenuItems = [
    { name: 'Admin Dashboard', icon: ShieldCheckIcon, path: '/admin' },
    { name: 'Students', icon: UserGroupIcon, path: '/admin/students' },
    { name: 'Teachers', icon: UsersIcon, path: '/admin/teachers' },
    { name: 'Classes', icon: AcademicCapIcon, path: '/admin/classes' },
    { name: 'Schedules', icon: CalendarIcon, path: '/admin/schedules' },
    { name: 'Attendance Records', icon: ClipboardDocumentListIcon, path: '/admin/attendance-records' },
    { name: 'Enrollments', icon: ClipboardDocumentListIcon, path: '/admin/enrollments' },
    { name: 'Settings', icon: CogIcon, path: '/settings' },
    { name: 'Profile', icon: UserIcon, path: '/profile' },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === path;
    }
    if (path === '/admin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  // Choose menu items based on role
  const menuItems = user?.role === 'admin' ? adminMenuItems : teacherMenuItems;

  return (
    <div className="w-64 bg-gray-800 text-white h-screen overflow-y-auto">
      <div className="p-4 text-xl font-bold border-b border-gray-700">
        {user?.role === 'admin' ? 'Admin Portal' : 'Teacher Portal'}
      </div>
      
      <nav className="py-2">
        {menuItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`flex items-center p-4 hover:bg-gray-700 transition ${
              isActive(item.path) ? 'bg-gray-700 border-l-4 border-blue-500' : ''
            }`}
          >
            <item.icon className="h-6 w-6 mr-3" />
            {item.name}
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default Sidebar;