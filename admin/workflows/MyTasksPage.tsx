import React from 'react';
import { Navigate } from 'react-router-dom';

// MyTasksPage has been merged into the unified TasksPage at /admin/tasks
const MyTasksPage: React.FC = () => <Navigate to="/admin/tasks" replace />;

export default MyTasksPage;
