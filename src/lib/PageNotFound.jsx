import { Link, useLocation } from 'react-router-dom';
import { Home } from 'lucide-react';
import GameBackground from '@/components/GameBackground';
import { useLang } from '@/lib/LanguageContext';

export default function PageNotFound() {
  const location = useLocation();
  const { t } = useLang();
  const pageName = location.pathname.substring(1);

  return (
    <div className="h-dvh overflow-hidden flex items-center justify-center p-6 text-white relative">
      <GameBackground />
      <div className="max-w-md w-full text-center">
        <p className="text-7xl font-extrabold tracking-tight mb-1" style={{ textShadow: '0 0 32px rgba(157,92,255,0.5)' }}>404</p>
        <p className="text-xl font-extrabold tracking-tight mb-1">{t.pageNotFound}</p>
        <p className="text-slate-400 text-sm font-medium mb-8">
          {t.pageNotFoundBody(pageName)}
        </p>
        <Link to="/" className="violet-btn inline-flex items-center justify-center gap-2 h-12 px-6 text-sm font-bold">
          <Home className="w-4 h-4" />
          {t.backToHome}
        </Link>
      </div>
    </div>
  );
}
