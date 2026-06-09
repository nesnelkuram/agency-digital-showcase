import React from 'react';
import { Navigate } from 'react-router-dom';

// MyTasksPage tek 'Görevlerim' sayfasına (/admin/now) taşındı
const MyTasksPage: React.FC = () => <Navigate to="/admin/now" replace />;

export default MyTasksPage;
