import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-6 space-y-1">
          <h1 className="text-lg font-semibold">Clinic Stock Console</h1>
          <p className="text-sm text-slate-500">Sign in to manage ward stock</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
