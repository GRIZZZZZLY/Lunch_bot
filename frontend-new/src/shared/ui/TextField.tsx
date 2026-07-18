/* Текстовое поле с label/hint/error. Для цены Store Run: inputMode="decimal",
   label обязан пояснять, что цена — за всю строку («Цена за всё (×N шт), ₽»);
   значение 0 не запрещать — бэкенд его допускает. */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './TextField.module.css';

export interface TextFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'className'> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  className?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  {
    label,
    hint,
    error,
    prefix,
    suffix,
    id,
    className,
    disabled,
    ...rest
  },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  const controlCls = [styles.control, error && styles.hasError, disabled && styles.disabled]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      {label && (
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
      )}
      <div className={controlCls}>
        {prefix && <span className={styles.affix}>{prefix}</span>}
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        {suffix && <span className={styles.affix}>{suffix}</span>}
      </div>
      {error ? (
        <div id={`${inputId}-error`} className={styles.error} role="alert">
          {error}
        </div>
      ) : hint ? (
        <div id={`${inputId}-hint`} className={styles.hint}>
          {hint}
        </div>
      ) : null}
    </div>
  );
});
