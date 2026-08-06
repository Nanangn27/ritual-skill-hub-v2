import { Suspense } from 'react';
import SkillDashboard from '@/components/skill/SkillDashboard';
import RitualBrand from '@/components/common/RitualBrand';

function SplashScreen() {
  return (
    <div className="splash-screen" role="status" aria-live="polite">
      <div className="splash-card">
        <RitualBrand className="splash-brand" compact={false} />
        <p className="splash-copy">Preparing your Ritual Skill Hub workspace…</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="page-shell">
      <Suspense fallback={<SplashScreen />}>
        <SkillDashboard />
      </Suspense>
    </main>
  );
}
