import CarrotHonorGlobal from "@/components/CarrotHonorGlobal";
import FloatingNav from "@/components/FloatingNav";
import MobileTabBar from "@/components/MobileTabBar";
import { usePlatform } from "@/hooks/usePlatform";
import { useLocation } from "react-router-dom";

const HIDDEN_ROUTES = ["/auth", "/calendar-success"];

export default function AppNavigation() {
  const { useMobileChrome } = usePlatform();
  const { pathname } = useLocation();

  if (HIDDEN_ROUTES.includes(pathname)) return null;

  return (
    <>
      <CarrotHonorGlobal />
      {useMobileChrome ? <MobileTabBar /> : <FloatingNav />}
    </>
  );
}
