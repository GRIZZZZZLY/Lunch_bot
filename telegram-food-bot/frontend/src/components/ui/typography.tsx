import React from 'react';
import { cn } from '../../lib/utils';
import {
  TYPOGRAPHY_DISPLAY,
  TYPOGRAPHY_H1,
  TYPOGRAPHY_H2,
  TYPOGRAPHY_H3,
  TYPOGRAPHY_BODY,
  TYPOGRAPHY_SMALL,
  TYPOGRAPHY_TINY,
} from '../../lib/typography';

type TypographyVariant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'tiny';

interface TypographyProps {
  variant?: TypographyVariant;
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  children: React.ReactNode;
  muted?: boolean;
}

const variantMap = {
  display: TYPOGRAPHY_DISPLAY.className,
  h1: TYPOGRAPHY_H1.className,
  h2: TYPOGRAPHY_H2.className,
  h3: TYPOGRAPHY_H3.className,
  body: TYPOGRAPHY_BODY.className,
  small: TYPOGRAPHY_SMALL.className,
  tiny: TYPOGRAPHY_TINY.className,
};

const defaultTagMap: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  h3: 'h3',
  body: 'p',
  small: 'p',
  tiny: 'span',
};

/**
 * Typography - Унифицированный компонент типографики
 * 
 * @example
 * <Typography variant="h1">Page Title</Typography>
 * <Typography variant="body" muted>Secondary text</Typography>
 * <Typography variant="small" as="span">Inline label</Typography>
 */
export const Typography: React.FC<TypographyProps> = ({
  variant = 'body',
  as,
  className,
  children,
  muted = false,
}) => {
  const Component = as || defaultTagMap[variant];
  
  return (
    <Component
      className={cn(
        variantMap[variant],
        muted && 'text-muted-foreground',
        className
      )}
    >
      {children}
    </Component>
  );
};

/**
 * Preset components для удобства
 */
export const Display: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="display" {...props} />
);

export const H1: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="h1" {...props} />
);

export const H2: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="h2" {...props} />
);

export const H3: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="h3" {...props} />
);

export const Body: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="body" {...props} />
);

export const Small: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="small" {...props} />
);

export const Tiny: React.FC<Omit<TypographyProps, 'variant'>> = (props) => (
  <Typography variant="tiny" {...props} />
);

export default Typography;
