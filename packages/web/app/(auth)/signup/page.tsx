"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) router.push('/home');
    else setError('Signup failed');
  }

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <form onSubmit={submit} className="w-80 bg-white/5 p-6 rounded space-y-3">
        <h1 className="text-xl font-semibold mb-2">Create account</h1>
        <input className="w-full px-3 py-2 rounded bg-black/40 border border-white/10" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full px-3 py-2 rounded bg-black/40 border border-white/10" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <div className="text-red-400 text-sm">{error}</div>}
        <button className="w-full px-3 py-2 bg-white text-black rounded">Sign up</button>
        <a className="text-sm opacity-80" href="/login">Already have an account?</a>
      </form>
    </div>
  );
}

