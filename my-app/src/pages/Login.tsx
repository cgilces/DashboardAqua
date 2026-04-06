import React, { useState } from 'react';
import { Spinner } from '../components/common/Spinner';
import { useAuth } from '../components/auth/AuthContext';
import { AquaLogo } from '../components/common/Icons';
import Input from '../components/elements/Input';
import Button from '../components/elements/Button';

const LoginScreen: React.FC = () => {
  const { login, loading, error } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [clave,   setClave]   = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await login(usuario, clave); } catch {}
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'radial-gradient(ellipse 120% 80% at 50% -20%, rgba(4,108,94,0.28) 0%, transparent 65%), linear-gradient(160deg, #0b1c17 0%, #0d2218 50%, #091510 100%)',
      }}
    >
      {/* Decorative blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #00c896, transparent 70%)' }} />
      </div>

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-2xl p-8 md:p-10 shadow-2xl"
        style={{
          background: 'rgba(1, 22, 16, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(4,108,94,0.35)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="w-64 h-16 text-white drop-shadow-lg">
            <AquaLogo className="w-full h-full" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-8 h-px bg-gradient-to-r from-transparent to-emerald-500/60 rounded-full" />
            <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-emerald-400/80">
              Dashboard Grupo Aqua
            </p>
            <span className="w-8 h-px bg-gradient-to-l from-transparent to-emerald-500/60 rounded-full" />
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-emerald-300/80 uppercase tracking-wider mb-1.5">
              Usuario
            </label>
            <Input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ingresa tu usuario"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-300/80 uppercase tracking-wider mb-1.5">
              Contraseña
            </label>
            <Input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 text-sm p-3 rounded-xl">
              <span className="text-base">⚠</span>
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl font-bold text-sm uppercase tracking-widest transition-all duration-200 flex justify-center items-center gap-2 disabled:opacity-60"
            style={{
              background: loading ? 'rgba(0,200,150,0.4)' : 'linear-gradient(135deg, #00c896, #007a5e)',
              color: '#fff',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(0,200,150,0.35)',
            }}
          >
            {loading ? <Spinner /> : 'Iniciar Sesión'}
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-center text-[10px] text-white/20 tracking-wider uppercase">
          Desarrollado por Dpto. Sistemas — Grupo Aqua S.A.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
