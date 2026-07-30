import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGoals } from "@/hooks/useGoals";
import { countHarvestedCarrots, loadCelebratedGoalIds } from "@/lib/goalCarrots";
import CarrotHonorBadge from "@/components/CarrotHonorBadge";

/** App-wide harvest badge — top-right, lives-style. */
export default function CarrotHonorGlobal() {
  const { user } = useAuth();
  const { goals } = useGoals();
  const [harvestCount, setHarvestCount] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setHarvestCount(0);
      return;
    }
    setHarvestCount(countHarvestedCarrots(user.id, goals));
  }, [user?.id, goals]);

  useEffect(() => {
    if (!user?.id) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("timebunny_goal_carrot_celebrated")) {
        setHarvestCount(loadCelebratedGoalIds(user.id).size);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [user?.id]);

  return <CarrotHonorBadge count={harvestCount} />;
}
