import clsx from 'clsx';
import React, { type ElementType, type HTMLAttributes } from 'react';

import sectionStyles from './section.module.css';
import { useSpotlight } from './useSpotlight';

type SpotSurfaceProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children?: React.ReactNode;
  /** Enable 3D tilt. Default true. */
  tilt?: boolean;
  maxTilt?: number;
} & Omit<HTMLAttributes<HTMLElement>, 'as'>;

/** Interactive surface: spotlight + optional 3D tilt. */
export default function SpotSurface<T extends ElementType = 'div'>({
  as,
  className,
  children,
  tilt = true,
  maxTilt = 8,
  ...rest
}: SpotSurfaceProps<T>) {
  const Tag = (as || 'div') as ElementType;
  const { ref, onPointerMove, onPointerEnter, onPointerLeave } = useSpotlight<HTMLElement>({
    tilt,
    maxTilt,
  });

  return (
    <Tag
      ref={ref}
      className={clsx(sectionStyles.spot, tilt && sectionStyles.tilt, className)}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      {...rest}
    >
      {children}
    </Tag>
  );
}
