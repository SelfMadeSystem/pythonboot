import App from './App';
import { useCallback, useState } from 'react';

export function FloatingApp() {
  const [visible, setVisible] = useState(window.MAIN);
  const [floating, setFloating] = useState(window.CDN);
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);
  const [width, setWidth] = useState(600);
  const [height, setHeight] = useState(400);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = left;
      const startTop = top;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        setLeft(startLeft + deltaX);
        setTop(startTop + deltaY);
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [left, top],
  );

  const handleResize = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = width;
      const startHeight = height;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;
        setWidth(Math.max(200, startWidth + deltaX));
        setHeight(Math.max(150, startHeight + deltaY));
      };

      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [width, height],
  );

  return (
    <>
      <div
        className={
          'pythonboot-app fixed ' +
          (visible
            ? floating
              ? 'z-1000 resize-none'
              : 'inset-0 h-screen w-screen'
            : 'hidden')
        }
        style={floating ? { left, top, width, height } : {}}
      >
        <div className="@container-[size] h-full w-full overflow-hidden">
          <App
            onFloatDown={floating ? handleMouseDown : undefined}
            floating={floating}
            setFloating={setFloating}
          />
        </div>
        {floating && (
          <div
            className="absolute right-0 bottom-0 z-100 h-4 w-4 cursor-se-resize rounded-tl-full bg-gray-600 fill-white"
            onMouseDown={handleResize}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="4 4 20 20">
              <path d="M22,22H20V20H22V22M22,18H20V16H22V18M18,22H16V20H18V22M18,18H16V16H18V18M14,22H12V20H14V22M22,14H20V12H22V14Z" />
            </svg>
          </div>
        )}
      </div>
      {window.CDN && (
        <button
          className="fixed right-4 bottom-4 z-1000 cursor-pointer rounded-full bg-blue-600 p-4 text-white shadow-lg hover:bg-blue-700"
          onClick={() => setVisible(!visible)}
        >
          {visible ? 'Close Editor' : 'Open Editor'}
        </button>
      )}
    </>
  );
}

export default FloatingApp;
