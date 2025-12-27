export type ViewsTab = 'output' | 'turtle' | 'pixels' | 'html';

export function ViewsTabs({
  activeTab,
  setActiveTab,
}: {
  activeTab: ViewsTab;
  setActiveTab: (tab: ViewsTab) => void;
}) {
  return (
    <div className="relative flex w-full items-center border-b border-gray-300">
      {(['output', 'turtle', 'pixels', 'html'] as const).map(tab => (
        <button
          key={tab}
          className={`flex-1 cursor-pointer px-4 py-2 text-center font-bold text-white ${
            activeTab === tab ? 'bg-gray-800' : 'hover:bg-[#fff1]'
          }`}
          onClick={() => setActiveTab(tab)}
        >
          {tab.charAt(0).toUpperCase() + tab.slice(1)}
        </button>
      ))}
    </div>
  );
}
