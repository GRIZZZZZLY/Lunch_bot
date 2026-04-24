import type { SettingRow } from './types';

interface Props {
  settings: SettingRow[];
  onToggle?: (id: string, next: boolean) => void;
  onActivate?: (id: string) => void;
}

export function SettingsList({ settings, onToggle, onActivate }: Props) {
  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}>
        <div className="tt">Настройки</div>
      </div>
      <div className="settings">
        {settings.map((s) => (
          <div
            key={s.id}
            className="set-row"
            onClick={() => {
              if (s.control.type === 'toggle')
                onToggle?.(s.id, !(s.control as { on: boolean }).on);
              else onActivate?.(s.id);
            }}
          >
            <div className="ic">{s.icon}</div>
            <div className="tx">
              <div className="l">{s.label}</div>
              <div className="v">{s.value}</div>
            </div>
            {s.control.type === 'toggle' ? (
              <div className={`toggle${s.control.on ? ' on' : ''}`} />
            ) : (
              <div className="ch">›</div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
