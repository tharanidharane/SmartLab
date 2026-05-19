import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store';
import { useWebSocket } from './hooks/useWebSocket';

// Screens
import LandingPage from './pages/Landing';
import RegisterPage from './pages/Register';
import LoginPage from './pages/Login';
import Dashboard from './pages/Dashboard';
import EquipmentPage from './pages/Equipment';
import BookingPage from './pages/BookingCreate';
import MyBookings from './pages/MyBookings';
import AdminApprovals from './pages/AdminApprovals';
import AnalyticsPage from './pages/Analytics';
import GenAIPage from './pages/GenAI';
import LabInchargeDashboard from './pages/LabInchargeDashboard';
import LabAssistantDashboard from './pages/LabAssistantDashboard';
import Layout from './components/Layout';

// ── Auth guard ───────────────────────────────────────────────
const PrivateRoute = ({ children, roles }: { children: JSX.Element; roles?: string[] }) => {
    const { user, accessToken } = useAuthStore();
    if (!accessToken || !user) return <Navigate to='/' replace />;
    if (roles && !roles.includes(user.role)) return <Navigate to='/dashboard' replace />;
    return children;
};

// ── WS connector — must be inside auth context ───────────────
const WSConnector = () => { useWebSocket(); return null; };

// ── Enforce localhost over 127.0.0.1 to prevent CORS errors ──
if (typeof window !== 'undefined' && window.location.hostname === '127.0.0.1') {
    window.location.hostname = 'localhost';
}

export default function App() {
    const { accessToken } = useAuthStore();
    return (
        <BrowserRouter>
            {accessToken && <WSConnector />}
            <Toaster position='top-right' toastOptions={{ style: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' } }} />
            <Routes>
                <Route path='/' element={<LandingPage />} />
                <Route path='/login' element={<LoginPage />} />
                <Route path='/register' element={<RegisterPage />} />
                <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                    <Route path='/dashboard' element={<Dashboard />} />
                    <Route path='/equipment' element={
                        <PrivateRoute roles={['Student', 'Faculty', 'Researcher', 'LabAssistant']}>
                            <EquipmentPage />
                        </PrivateRoute>
                    } />
                    <Route path='/equipment/:id/book' element={
                        <PrivateRoute roles={['Student', 'Faculty', 'Researcher']}>
                            <BookingPage />
                        </PrivateRoute>
                    } />
                    <Route path='/bookings' element={
                        <PrivateRoute roles={['Student', 'Faculty', 'Researcher', 'LabAssistant']}>
                            <MyBookings />
                        </PrivateRoute>
                    } />
                    <Route path='/approvals' element={
                        <PrivateRoute roles={['LabAssistant']}>
                            <AdminApprovals />
                        </PrivateRoute>
                    } />
                    <Route path='/analytics' element={
                        <PrivateRoute roles={['LabIncharge']}>
                            <AnalyticsPage />
                        </PrivateRoute>
                    } />
                    <Route path='/genai' element={<GenAIPage />} />
                    <Route path='/lab-incharge' element={
                        <PrivateRoute roles={['LabIncharge']}>
                            <LabInchargeDashboard />
                        </PrivateRoute>
                    } />
                    <Route path='/lab-assistant' element={
                        <PrivateRoute roles={['LabAssistant']}>
                            <LabAssistantDashboard />
                        </PrivateRoute>
                    } />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
