import { m } from 'framer-motion';
import { Compass, Sparkles, Users } from 'lucide-react';
import { CardContent, CardDescription, CardHeader, CardTitle, PastelCard } from '../ui/pastel-card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import type { LunchDnaAxis, LunchDnaProfile } from '@/services/lunch-dna.service';

interface LunchDnaCardProps {
  profile: LunchDnaProfile;
}

const getPolygonPoints = (axes: readonly LunchDnaAxis[]): string => {
  const centerX = 110;
  const centerY = 110;
  const radius = 72;

  return axes
    .map((axis, index) => {
      const angle = ((Math.PI * 2) / axes.length) * index - Math.PI / 2;
      const axisRadius = (axis.value / 100) * radius;
      const x = centerX + Math.cos(angle) * axisRadius;
      const y = centerY + Math.sin(angle) * axisRadius;
      return `${x},${y}`;
    })
    .join(' ');
};

const getRingPoints = (ringRadius: number, axisCount: number): string => {
  const centerX = 110;
  const centerY = 110;

  return Array.from({ length: axisCount }, (_, index) => {
    const angle = ((Math.PI * 2) / axisCount) * index - Math.PI / 2;
    const x = centerX + Math.cos(angle) * ringRadius;
    const y = centerY + Math.sin(angle) * ringRadius;
    return `${x},${y}`;
  }).join(' ');
};

export function LunchDnaCard({ profile }: LunchDnaCardProps) {
  const polygonPoints = getPolygonPoints(profile.axes);

  return (
    <m.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
    >
      <PastelCard
        variant='default'
        className={cn(
          'overflow-hidden border-border/70 shadow-[0_14px_34px_rgba(33,24,13,0.06)] dark:shadow-none',
          'bg-[linear-gradient(145deg,rgba(255,251,244,0.98),rgba(252,246,255,0.98))]',
          'dark:bg-[linear-gradient(145deg,rgba(31,30,43,0.98),rgba(18,18,27,0.98))]'
        )}
      >
        <CardHeader className='pb-4'>
          <div className='flex items-start justify-between gap-4'>
            <div className='space-y-3'>
              <div className='inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium text-muted-foreground'>
                <Sparkles className='h-3.5 w-3.5 text-primary' />
                Твой Lunch DNA
              </div>
              <div className='space-y-2'>
                <CardTitle className='text-2xl leading-tight'>{profile.archetype}</CardTitle>
                <CardDescription className='max-w-[34ch] text-sm leading-6 text-muted-foreground'>
                  {profile.summary}
                </CardDescription>
              </div>
            </div>

            <Badge variant='secondary' className='rounded-full px-3 py-1 text-xs font-medium'>
              {profile.confidenceLabel}
            </Badge>
          </div>

          <div className='flex flex-wrap gap-2 pt-2'>
            {profile.tags.map(tag => (
              <span
                key={tag}
                className='rounded-full border border-border/50 bg-background/60 px-3 py-1 text-xs text-foreground/76'
              >
                {tag}
              </span>
            ))}
            <span className='rounded-full border border-border/40 px-3 py-1 text-xs text-muted-foreground'>
              {profile.historySampleSize} голосований в основе
            </span>
          </div>
        </CardHeader>

        <CardContent className='space-y-5'>
          <div className='grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] md:items-center'>
            <div
              data-testid='lunch-dna-fingerprint'
              className='relative mx-auto flex h-[220px] w-[220px] items-center justify-center rounded-[28px] border border-border/50 bg-background/55 backdrop-blur-sm'
            >
              <svg viewBox='0 0 220 220' className='h-[190px] w-[190px]'>
                {[24, 42, 60, 78].map(radius => (
                  <polygon
                    key={radius}
                    points={getRingPoints(radius, profile.axes.length)}
                    fill='none'
                    stroke='currentColor'
                    className='text-border/45'
                    strokeWidth='1'
                  />
                ))}

                {profile.axes.map((axis, index) => {
                  const angle = ((Math.PI * 2) / profile.axes.length) * index - Math.PI / 2;
                  const x = 110 + Math.cos(angle) * 78;
                  const y = 110 + Math.sin(angle) * 78;

                  return (
                    <line
                      key={axis.key}
                      x1='110'
                      y1='110'
                      x2={x}
                      y2={y}
                      stroke='currentColor'
                      className='text-border/45'
                      strokeWidth='1'
                    />
                  );
                })}

                <polygon
                  points={polygonPoints}
                  fill='hsl(var(--primary) / 0.18)'
                  stroke='hsl(var(--primary) / 0.92)'
                  strokeWidth='2.5'
                />
                <circle
                  cx='110'
                  cy='110'
                  r='4'
                  fill='hsl(var(--primary))'
                />
              </svg>
            </div>

            <div className='grid gap-3 sm:grid-cols-2'>
              {profile.axes.map(axis => (
                <div
                  key={axis.key}
                  className='rounded-2xl border border-border/50 bg-background/60 p-3 shadow-[0_6px_20px_rgba(33,24,13,0.03)]'
                >
                  <div className='mb-2 flex items-center justify-between gap-3'>
                    <span className='text-sm font-medium text-foreground'>{axis.label}</span>
                    <span className='text-xs font-semibold text-muted-foreground'>{axis.value}</span>
                  </div>
                  <div className='h-2 overflow-hidden rounded-full bg-muted/50'>
                    <div
                      className='h-full rounded-full bg-primary'
                      style={{ width: `${axis.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className='grid gap-3 md:grid-cols-2'>
            <div className='rounded-[24px] border border-border/55 bg-background/65 p-4'>
              <div className='mb-3 flex items-center gap-2'>
                <Users className='h-4 w-4 text-primary' />
                <p className='text-sm font-semibold'>{profile.baseline.title}</p>
              </div>
              <p className='text-sm leading-6 text-muted-foreground'>{profile.baseline.description}</p>
            </div>

            <div className='rounded-[24px] border border-border/55 bg-background/65 p-4'>
              <div className='mb-3 flex items-center gap-2'>
                <Compass className='h-4 w-4 text-primary' />
                <p className='text-sm font-semibold'>{profile.pulse.title}</p>
              </div>
              <p className='text-sm leading-6 text-muted-foreground'>{profile.pulse.description}</p>
            </div>
          </div>
        </CardContent>
      </PastelCard>
    </m.div>
  );
}
