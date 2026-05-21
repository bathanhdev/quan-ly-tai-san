'use client';

import { useEffect } from 'react';

export default function ScrollbarActivity() {
  useEffect(() => {
    let hideTimer: number | undefined;

    const showScrollbar = () => {
      document.documentElement.classList.add('scrollbar-active');
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => {
        document.documentElement.classList.remove('scrollbar-active');
      }, 900);
    };

    window.addEventListener('scroll', showScrollbar, { passive: true });
    window.addEventListener('wheel', showScrollbar, { passive: true });
    window.addEventListener('touchmove', showScrollbar, { passive: true });
    window.addEventListener('keydown', showScrollbar);

    return () => {
      window.clearTimeout(hideTimer);
      window.removeEventListener('scroll', showScrollbar);
      window.removeEventListener('wheel', showScrollbar);
      window.removeEventListener('touchmove', showScrollbar);
      window.removeEventListener('keydown', showScrollbar);
    };
  }, []);

  return null;
}
