import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import axios from 'axios';
import { useAuthStore } from '../store';

const schema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    department: z.string().min(2, 'Department is required'),
    role: z.enum(['Student', 'Faculty', 'LabAssistant', 'LabIncharge']),
});
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { setAuth } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);

    const initialRole = (searchParams.get('role') as FormValues['role']) || 'Student';

    const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { role: initialRole },
    });

    const currentRole = watch('role');

    useEffect(() => {
        if (initialRole && ['Student', 'Faculty', 'LabAssistant', 'LabIncharge'].includes(initialRole)) {
            setValue('role', initialRole);
        }
    }, [initialRole, setValue]);

    const onSubmit = async (data: FormValues) => {
        setIsLoading(true);
        try {
            // Register user
            await axios.post(`${import.meta.env.VITE_API_URL}/auth/register`, data);

            // Auto Login
            const res = await axios.post(`${import.meta.env.VITE_API_URL}/auth/login`, {
                email: data.email,
                password: data.password,
            });
            const { accessToken, refreshToken, idToken } = res.data;

            // Robust JWT decoding
            const base64Url = idToken.split('.')[1];
            let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) { base64 += '='; }
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
            toast.success(`Account created successfully! Welcome to SmartLab.`);
            navigate('/dashboard', { replace: true });
        } catch (err: unknown) {
            console.error('Registration Error:', err);
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
            toast.error(msg || "Registration failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const getRoleTitle = (role: string) => {
        switch (role) {
            case 'LabIncharge': return 'Lab In-Charge';
            case 'LabAssistant': return 'Lab Assistant';
            case 'Faculty': return 'Faculty';
            default: return 'Student/Researcher';
        }
    };

    return (
        <div className='min-h-screen flex items-center justify-center p-4' style={{ background: 'radial-gradient(circle at top, #1e1b4b 0%, #030712 100%)' }}>
            <div className='glass-card w-full max-w-md shadow-2xl relative overflow-hidden my-8'>
                <div className='absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500' />

                <div className='text-center mb-8 mt-4'>
                    <h1 className='text-3xl font-extrabold text-white tracking-tight'>Create Account</h1>
                    <p className='text-indigo-400 mt-2 text-sm font-semibold uppercase tracking-wider'>
                        {getRoleTitle(currentRole)} Portal
                    </p>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className='space-y-5'>
                    <div className='space-y-1.5'>
                        <label className='block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1'>Full Name</label>
                        <input {...register('name')} type='text' placeholder='Alex Doe' className='input-field' />
                        {errors.name && <p className='text-rose-400 text-xs mt-1 font-medium'>{errors.name.message}</p>}
                    </div>

                    <div className='space-y-1.5'>
                        <label className='block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1'>Email</label>
                        <input {...register('email')} type='email' placeholder='alex@university.edu' className='input-field' />
                        {errors.email && <p className='text-rose-400 text-xs mt-1 font-medium'>{errors.email.message}</p>}
                    </div>

                    <div className='space-y-1.5'>
                        <label className='block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1'>Password</label>
                        <input {...register('password')} type='password' placeholder='••••••••' className='input-field' />
                        {errors.password && <p className='text-rose-400 text-xs mt-1 font-medium'>{errors.password.message}</p>}
                    </div>

                    <div className='space-y-1.5'>
                        <label className='block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1'>Department</label>
                        <input {...register('department')} type='text' placeholder='e.g. Computer Science' className='input-field' />
                        {errors.department && <p className='text-rose-400 text-xs mt-1 font-medium'>{errors.department.message}</p>}
                    </div>

                    <div className='space-y-1.5'>
                        <label className='block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1'>Role</label>
                        <select {...register('role')} className='w-full px-4 py-3 bg-slate-900/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm appearance-none'>
                            <option value="Student">Student</option>
                            <option value="Faculty">Faculty</option>
                            <option value="LabAssistant">Lab Assistant</option>
                            <option value="LabIncharge">Lab In-Charge</option>
                        </select>
                        {errors.role && <p className='text-rose-400 text-xs mt-1 font-medium'>{errors.role.message}</p>}
                    </div>

                    <button type='submit' disabled={isLoading} className='btn-primary w-full mt-6 flex items-center justify-center gap-2'>
                        {isLoading ? (
                            <>
                                <div className='w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                                <span>Creating Account...</span>
                            </>
                        ) : 'Sign Up'}
                    </button>
                </form>

                <p className='text-center text-slate-500 text-xs mt-8'>
                    Already have an account? <Link to={`/login?role=${currentRole}`} className='text-indigo-400 font-medium hover:text-indigo-300 transition-colors'>Sign in here</Link>
                </p>
            </div>
        </div>
    );
}
