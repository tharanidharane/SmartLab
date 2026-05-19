import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuthStore } from '../store';

const schema = z.object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setAuth } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);

    const currentRole = searchParams.get('role') || 'Student';

    const getRoleTitle = (role: string) => {
        switch (role) {
            case 'LabIncharge': return 'Lab In-Charge';
            case 'LabAssistant': return 'Lab Assistant';
            case 'Faculty': return 'Faculty';
            default: return 'Student/Researcher';
        }
    };

    const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
    });

    const onSubmit = async (data: FormValues) => {
        setIsLoading(true);
        try {
            const res = await axios.post(
                `${import.meta.env.VITE_API_URL}/auth/login`,
                data
            );
            const { accessToken, refreshToken, idToken } = res.data;

            // Robustly decode the JWT without external libraries to fix any Base64 padding errors
            const base64Url = idToken.split('.')[1];
            let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            // Pad base64 with '=' until its length is a multiple of 4
            while (base64.length % 4) {
                base64 += '=';
            }

            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));

            const payload = JSON.parse(jsonPayload);
            const user = {
                userId: payload.sub,
                email: payload.email,
                name: payload.name ?? payload.email.split('@')[0],
                role: payload['custom:role'] ?? 'Student',
                department: payload['custom:department'] ?? 'General',
            };

            setAuth(user, idToken, refreshToken);
            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            console.error('Login Error Captured:', err);
            let msg = '';
            if (axios.isAxiosError(err)) {
                if (err.message === 'Network Error' && !err.response) {
                    msg = 'Network Error (CORS). Please ensure you access the app via http://localhost:5173 instead of 127.0.0.1.';
                } else {
                    msg = err.response?.data?.message ?? `API Error: ${err.message}`;
                }
            } else {
                msg = err instanceof Error ? err.message : String(err);
            }
            toast.error(msg || "Login failed.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className='min-h-screen flex items-center justify-center p-4' style={{ background: 'radial-gradient(circle at top, #1e1b4b 0%, #030712 100%)' }}>
            <div className='glass-card w-full max-w-md shadow-2xl relative overflow-hidden'>
                <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500' />

                <div className='text-center mb-10 mt-4'>
                    <h1 className='text-4xl font-extrabold text-white tracking-tight'>Sign In</h1>
                    <p className='text-indigo-400 mt-2 text-sm font-semibold uppercase tracking-wider'>
                        {getRoleTitle(currentRole)} Portal
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className='space-y-6'>
                    <div className='space-y-2'>
                        <label className='block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1'>Email</label>
                        <input
                            {...register('email')}
                            type='email'
                            placeholder='student@university.edu'
                            className='input-field'
                        />
                        {errors.email && <p className='text-rose-400 text-xs mt-1 font-medium'>{errors.email.message}</p>}
                    </div>

                    <div className='space-y-2'>
                        <label className='block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1'>Password</label>
                        <input
                            {...register('password')}
                            type='password'
                            placeholder='••••••••'
                            className='input-field'
                        />
                        {errors.password && <p className='text-rose-400 text-xs mt-1 font-medium'>{errors.password.message}</p>}
                    </div>

                    <button
                        type='submit'
                        disabled={isLoading}
                        className='btn-primary w-full mt-4 flex items-center justify-center gap-2'>
                        {isLoading ? (
                            <>
                                <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                                <span>Authenticating...</span>
                            </>
                        ) : 'Sign In'}
                    </button>
                </form>

                <p className='text-center text-slate-500 text-xs mt-8'>
                    Don&apos;t have an account? <Link to={`/register?role=${currentRole}`} className='text-indigo-400 font-medium hover:text-indigo-300 transition-colors cursor-pointer'>Sign up here</Link>
                </p>
            </div>
        </div>
    );
}
