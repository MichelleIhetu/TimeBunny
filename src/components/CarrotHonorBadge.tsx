import { CarrotBadgeIcon } from "@/components/GrowingCarrot";

const PIXEL: React.CSSProperties = { fontFamily: "'Press Start 2P', cursive" };
const VT: React.CSSProperties = { fontFamily: "'VT323', monospace" };

type Props = {
  count: number;
};

/** Completed-goal carrots — top-right badge (lives-style). */
export default function CarrotHonorBadge({ count }: Props) {
  if (count <= 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-full border-2 border-[#ddd6fe] bg-white px-3 py-2 shadow-[3px_3px_0px_#a78bfa]"
      title={`${count} goal${count === 1 ? "" : "s"} harvested`}
    >
      <CarrotBadgeIcon className="h-6 w-6" />
      <div className="flex flex-col leading-none">
        <span className="text-[8px] text-[#a78bfa]" style={PIXEL}>
          HARVEST
        </span>
        <span className="text-xl font-bold text-[#5b21b6]" style={VT}>
          {count}
        </span>
      </div>
    </div>
  );
}
