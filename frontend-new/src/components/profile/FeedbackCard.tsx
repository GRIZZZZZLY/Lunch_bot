import { useState } from 'react';

interface Props {
  onSubmit?: (text: string) => void;
  onReportIssue?: () => void;
}

export function FeedbackCard({ onSubmit, onReportIssue }: Props) {
  const [text, setText] = useState('');

  return (
    <>
      <div className="sec" style={{ marginTop: 4 }}>
        <div className="tt">Обратная связь</div>
      </div>
      <div className="fb-card">
        <textarea
          className="fb-ta"
          placeholder="Ваше мнение… что улучшить?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="fb-actions">
          <button
            type="button"
            className="btn primary"
            disabled={!text.trim()}
            onClick={() => {
              onSubmit?.(text.trim());
              setText('');
            }}
          >
            Отправить
          </button>
          <button type="button" className="btn ghost" onClick={onReportIssue}>
            Сообщить об ошибке
          </button>
        </div>
      </div>
    </>
  );
}
