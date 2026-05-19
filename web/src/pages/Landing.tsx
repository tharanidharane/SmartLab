import { Link } from 'react-router-dom';
import { BeakerIcon, AcademicCapIcon, AdjustmentsHorizontalIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

const portals = [
    {
        id: 'student',
        title: 'Students & Researchers',
        role: 'Student', // Can also be Faculty, handled similarly 
        description: 'Browse available equipment, check specifications, and book slots for your experiments and research projects.',
        icon: AcademicCapIcon,
        color: 'from-blue-500 to-cyan-400',
        bgGlow: 'bg-blue-500/20',
        shadow: 'shadow-blue-900/20',
    },
    {
        id: 'assistant',
        title: 'Lab Assistants',
        role: 'LabAssistant',
        description: 'Manage active bookings, review pending requests, and ensure day-to-day operations run smoothly.',
        icon: BeakerIcon,
        color: 'from-purple-500 to-fuchsia-400',
        bgGlow: 'bg-purple-500/20',
        shadow: 'shadow-purple-900/20',
    },
    {
        id: 'incharge',
        title: 'Lab In-Charge',
        role: 'LabIncharge',
        description: 'Full administrative access. Oversee inventory, analyze utilization metrics, and configure system rules.',
        icon: AdjustmentsHorizontalIcon,
        color: 'from-emerald-400 to-teal-500',
        bgGlow: 'bg-emerald-500/20',
        shadow: 'shadow-emerald-900/20',
    },
];

export default function LandingPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ background: 'radial-gradient(circle at top, #1e1b4b 0%, #030712 100%)' }}>

            {/* Background decorative elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="text-center mb-16 relative z-10 max-w-2xl mx-auto">
                <div className="inline-flex items-center justify-center p-3 bg-white/5 rounded-2xl mb-6 ring-1 ring-white/10 backdrop-blur-md">
                    <BeakerIcon className="w-8 h-8 text-indigo-400 mr-3" />
                    <h1 className="text-4xl font-extrabold tracking-tight text-white m-0 leading-none">Smart<span className="text-indigo-400">Lab</span></h1>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">
                    Welcome to the Future of <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
                        Lab Intelligence
                    </span>
                </h2>
                <p className="text-slate-400 text-lg md:text-xl leading-relaxed">
                    Select your designated role to log in or register for an account. Access tailored tools for booking, management, and analytics.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl relative z-10">
                {portals.map((portal) => (
                    <div
                        key={portal.id}
                        className={clsx(
                            "group relative rounded-3xl p-1 overflow-hidden transition-all duration-500 hover:scale-[1.02]",
                            portal.shadow, "shadow-2xl"
                        )}
                    >
                        {/* Animated Gradient Border */}
                        <div className={clsx("absolute inset-0 bg-gradient-to-br opacity-50 transition-opacity duration-500 group-hover:opacity-100", portal.color)} />

                        {/* Card Content Container */}
                        <div className="relative h-full bg-[#0f172a]/95 backdrop-blur-xl rounded-[22px] p-8 flex flex-col items-center text-center border border-white/10">

                            {/* Icon Wrapper */}
                            <div className={clsx("w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-500 group-hover:-translate-y-2", portal.bgGlow)}>
                                <portal.icon className={clsx("w-10 h-10 text-transparent bg-clip-text bg-gradient-to-br text-white")} />
                            </div>

                            <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">
                                {portal.title}
                            </h3>
                            <p className="text-slate-400 text-sm leading-relaxed mb-8 flex-1">
                                {portal.description}
                            </p>

                            <div className="w-full space-y-3 mt-auto">
                                <Link
                                    to={`/login?role=${portal.role}`}
                                    className="flex items-center justify-center w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/5 transition-all duration-300 ring-1 ring-inset ring-white/10"
                                >
                                    Log In <ArrowRightIcon className="w-4 h-4 ml-2 opacity-70 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                </Link>
                                <Link
                                    to={`/register?role=${portal.role}`}
                                    className="flex items-center justify-center w-full py-3 px-4 rounded-xl text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-300"
                                >
                                    Create Account
                                </Link>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <p className="mt-20 text-slate-500 text-sm flex items-center gap-2 relative z-10">
                Powered by AWS Serverless & GenAI <SparklesIcon className="w-4 h-4 text-purple-400" />
            </p>
        </div>
    );
}

function SparklesIcon(props: React.ComponentProps<'svg'>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
    )
}
