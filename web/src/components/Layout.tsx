import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore, useNotificationStore, useWsStore } from '../store';
import {
    HomeIcon, CogIcon, CalendarIcon, ChartBarIcon,
    SparklesIcon, BellIcon, ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import api from '../lib/api';

const links = [
    { to: '/dashboard', label: 'Dashboard', icon: HomeIcon, roles: null },
    { to: '/equipment', label: 'Equipment', icon: CogIcon, roles: ['Student', 'Faculty', 'Researcher', 'LabAssistant'] },
    { to: '/bookings', label: 'My Bookings', icon: CalendarIcon, roles: ['Student', 'Faculty', 'Researcher'] },
    { to: '/approvals', label: 'Approvals', icon: CalendarIcon, roles: ['LabAssistant'] },
    { to: '/lab-assistant', label: 'Lab Console', icon: ChartBarIcon, roles: ['LabAssistant'] },
    { to: '/analytics', label: 'Analytics', icon: ChartBarIcon, roles: ['LabIncharge'] },
    { to: '/lab-incharge', label: 'In-charge Panel', icon: SparklesIcon, roles: ['LabIncharge'] },
    { to: '/genai', label: 'AI Assistant', icon: SparklesIcon, roles: null },
];


export default function Layout() {
    const { user, logout } = useAuthStore();
    const { unreadCount, markAllRead } = useNotificationStore();
    const { isConnected } = useWsStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        try { await api.post('/auth/logout'); } catch { }
        logout();
        navigate('/', { replace: true });
        toast.success('Logged out successfully.');
    };

    const visibleLinks = links.filter(l => !l.roles || l.roles.includes(user?.role ?? ''));

    return (
        <div className='flex h-screen overflow-hidden'>
            {/* Sidebar */}
            <aside className='w-64 glass border-r border-slate-700/50 flex flex-col'>
                {/* Logo */}
                <div className='p-6 border-b border-slate-700/50'>
                    <h1 className='text-xl font-bold gradient-text'>SmartLab</h1>
                    <p className='text-xs text-slate-400 mt-1'>{user?.role} · {user?.department}</p>
                </div>

                {/* Nav */}
                <nav className='flex-1 p-4 space-y-1 overflow-y-auto'>
                    {visibleLinks.map(({ to, label, icon: Icon }) => (
                        <NavLink key={to} to={to}
                            className={({ isActive }) => clsx(
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                                isActive
                                    ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                            )}>
                            <Icon className='w-5 h-5' />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className='p-4 border-t border-slate-700/50 space-y-3'>
                    <div className='flex items-center gap-2'>
                        <span className={clsx('w-2 h-2 rounded-full', isConnected ? 'bg-green-400' : 'bg-red-400')} />
                        <span className='text-xs text-slate-400'>{isConnected ? 'Live' : 'Reconnecting...'}</span>
                    </div>
                    <button onClick={handleLogout}
                        className='w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 rounded-lg transition-all'>
                        <ArrowRightOnRectangleIcon className='w-4 h-4' />
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className='flex-1 flex flex-col overflow-hidden'>
                {/* Top bar */}
                <header className='glass border-b border-slate-700/50 px-6 py-4 flex items-center justify-between'>
                    <div />
                    <div className='flex items-center gap-4'>
                        <button onClick={markAllRead}
                            className='relative text-slate-400 hover:text-white transition-colors'>
                            <BellIcon className='w-6 h-6' />
                            {unreadCount > 0 && (
                                <span className='absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center'>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                        <div className='text-sm'>
                            <p className='font-medium text-white'>{user?.name}</p>
                        </div>
                    </div>
                </header>
                <div className='flex-1 overflow-y-auto p-6'>
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
