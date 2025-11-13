import api from './api';

export const userService = {
  login: async (credentials) => {
    console.log('UserService: Sending login request to:', '/auth/login');
    console.log('UserService: Credentials:', { email: credentials.email, password: '***' });
    // Use unified auth endpoint that works for teachers, admins, and students
    const response = await api.post('/teacher/auth/login', credentials);
    console.log('UserService: Response received:', response.data);
    return response.data;
  },
  register: async (userData) => {
    console.log('UserService: Sending registration request to:', '/auth/register');
    console.log('UserService: Registration data:', userData);
    // Use unified auth endpoint that works for all roles
    const response = await api.post('/teacher/auth/register', userData);
    return response.data;
  },
  getProfile: async () => {
    // Use unified endpoint that works for all roles (admin, teacher, student)
    const response = await api.get('/teacher/auth/profile');
    return response.data;
  },
  updateProfile: async (profileData) => {
    // Use unified endpoint that works for all roles (admin, teacher, student)
    const response = await api.put('/teacher/auth/profile', profileData);
    return response.data;
  },
  
  changePassword: async (passwordData) => {
    // Use unified endpoint that works for all roles (admin, teacher, student)
    const response = await api.put('/student/users/change-password', passwordData);
    return response.data;
  },
  
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};