import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { installEventKitDevMock } from "@/lib/calendar/dev/eventKitDevMock";
import { bootstrapNativeApp } from "@/lib/nativeBootstrap";

installEventKitDevMock();

void bootstrapNativeApp().then(() => {
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>,
  );
});
