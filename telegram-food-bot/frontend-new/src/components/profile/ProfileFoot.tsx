interface Props {
  onLogout?: () => void;
  version?: string;
}

export function ProfileFoot({ onLogout, version = 'v2.0.0 · build 1842' }: Props) {
  return (
    <div className="foot">
      <button type="button" className="logout" onClick={onLogout}>
        Выйти из аккаунта
      </button>
      <div className="ver">{version}</div>
    </div>
  );
}
