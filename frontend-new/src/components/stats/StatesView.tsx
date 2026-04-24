export function LoadingView() {
  return (
    <div className="content">
      <div className="card">
        <div className="sk bar w60" style={{ height: 14 }} />
        <div className="sk bar w80" style={{ height: 20, marginTop: 10 }} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            marginTop: 14,
          }}
        >
          <div className="sk" style={{ height: 80, borderRadius: 12 }} />
          <div className="sk" style={{ height: 80, borderRadius: 12 }} />
          <div className="sk" style={{ height: 80, borderRadius: 12 }} />
        </div>
      </div>
      <div className="card">
        <div className="sk bar w40" style={{ height: 12 }} />
        <div style={{ display: 'flex', gap: 12, marginTop: 10, alignItems: 'center' }}>
          <div className="sk" style={{ width: 108, height: 108, borderRadius: 999 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div className="sk bar w90" />
            <div className="sk bar w80" />
            <div className="sk bar w60" />
            <div className="sk bar w40" />
          </div>
        </div>
      </div>
      <div className="card">
        <div className="sk bar w40" style={{ height: 12 }} />
        <div className="sk block" style={{ marginTop: 10 }} />
      </div>
    </div>
  );
}

export function EmptyView({ onAction }: { onAction?: () => void }) {
  return (
    <div className="content">
      <div className="empty-st">
        <div className="blob">📊</div>
        <div className="et">Пока нет статистики</div>
        <div className="es">
          Проголосуйте впервые — и мы начнём собирать ваше ДНК обеда.
        </div>
        <button type="button" className="ec" onClick={onAction}>
          К голосованию →
        </button>
      </div>
    </div>
  );
}
