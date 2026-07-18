import { lazy } from 'react';

const CartesianGrid = lazy(() =>
  import('recharts').then(module => ({ default: module.CartesianGrid }))
);
const Line = lazy(() =>
  import('recharts').then(module => ({ default: module.Line }))
);
const LineChart = lazy(() =>
  import('recharts').then(module => ({ default: module.LineChart }))
);
const ResponsiveContainer = lazy(() =>
  import('recharts').then(module => ({ default: module.ResponsiveContainer }))
);
const Tooltip = lazy(() =>
  import('recharts').then(module => ({ default: module.Tooltip }))
);
const XAxis = lazy(() =>
  import('recharts').then(module => ({ default: module.XAxis }))
);
const YAxis = lazy(() =>
  import('recharts').then(module => ({ default: module.YAxis }))
);

interface ActivityPoint {
  date: string;
  votes: number;
}

interface ActivityLineChartProps {
  data: ActivityPoint[];
  isDark: boolean;
}

const ActivityLineChart = ({ data, isDark }: ActivityLineChartProps) => (
  <ResponsiveContainer width="100%" height={200}>
    <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
      <defs>
        <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#D86A2C" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#e5e7eb'} opacity={0.5} />
      <XAxis dataKey="date" fontSize={11} />
      <YAxis fontSize={11} />
      <Tooltip />
      <Line
        type="monotone"
        dataKey="votes"
        stroke="url(#lineGradient)"
        strokeWidth={3}
        dot={{ fill: isDark ? '#A78BFA' : '#ff6b6b', r: 4 }}
        activeDot={{ r: 6 }}
        animationDuration={800}
      />
    </LineChart>
  </ResponsiveContainer>
);

export default ActivityLineChart;
