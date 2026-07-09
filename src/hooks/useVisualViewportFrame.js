import { useState, useEffect } from 'react';

export const useVisualViewportFrame = () => {
  const [frame, setFrame] = useState({ top: 0, height: 0 });
  useEffect(() => {
    const updateFrame = () => {
      const vv = window.visualViewport;
      setFrame({
        top: vv ? vv.offsetTop : 0,
        height: vv ? vv.height : window.innerHeight,
      });
    };
    updateFrame();
    window.visualViewport?.addEventListener('resize', updateFrame);
    window.visualViewport?.addEventListener('scroll', updateFrame);
    window.addEventListener('resize', updateFrame);
    return () => {
      window.visualViewport?.removeEventListener('resize', updateFrame);
      window.visualViewport?.removeEventListener('scroll', updateFrame);
      window.removeEventListener('resize', updateFrame);
    };
  }, []);
  return frame;
};
