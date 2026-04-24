import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
}

export function PlaceholderPage({ title, subtitle }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col gap-3.5 px-4 py-4 pb-6">
      <Card variant="pastel-peach">
        <div className="text-[10px] font-mono uppercase tracking-[0.1em] opacity-70">
          Rocket Lunch · Redesign
        </div>
        <div className="text-[22px] font-bold mt-1">{title}</div>
        {subtitle ? <div className="text-sm opacity-80 mt-1">{subtitle}</div> : null}
      </Card>

      <Card>
        <CardHeader
          icon={<Sparkles className="size-4 text-lavender-500" />}
          title="Дизайн-система подключена"
          subtitle="Цвета, типографика, тени и градиенты идут из /exports/Rocket Lunch Design System"
        />
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge tone="active" pip>Активно</Badge>
          <Badge tone="done" pip>Готово</Badge>
          <Badge tone="urgent" pip>Срочно</Badge>
          <Badge tone="pending" pip>Ожидает</Badge>
          <Badge tone="neutral">Архив</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader title="Кнопки" subtitle="Варианты · размеры" />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm">SM Primary</Button>
          <Button variant="primary">MD Primary</Button>
          <Button variant="primary" size="lg">LG Primary</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" loading>Loading</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </div>
      </Card>

      <Card variant="pastel-lav">
        <div className="text-sm font-semibold">Следующий шаг</div>
        <div className="text-xs mt-1 opacity-80">
          Порт HomePage → VotingPage → MenuPage из HTML-экспортов.
        </div>
      </Card>
    </div>
  );
}
