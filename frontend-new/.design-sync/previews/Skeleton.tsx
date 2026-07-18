import { Skeleton } from 'telegram-food-bot-frontend-new';

export function ListRow() {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', width: 320 }}>
      <Skeleton variant="circle" width={40} height={40} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="35%" height={10} />
      </div>
    </div>
  );
}

export function TextLines() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: 280 }}>
      <Skeleton variant="text" width="90%" />
      <Skeleton variant="text" width="75%" />
      <Skeleton variant="text" width="50%" />
    </div>
  );
}

export function Blocks() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 320 }}>
      <Skeleton variant="block" height={72} />
      <Skeleton variant="block" height={44} />
    </div>
  );
}
