import { supabase } from "@/integrations/supabase/client";
import type { PinterestImage } from "@/lib/pinterestConnection";

export type { PinterestBoard, PinterestConnectionStatus, PinterestImage } from "@/lib/pinterestConnection";
export {
  clearPinterestOAuthParams,
  completePinterestConnect,
  disconnectPinterest,
  fetchPinterestBoardPins,
  fetchPinterestBoards,
  getPinterestRedirectUri,
  getPinterestStatus,
  isPinterestConfigured,
  startPinterestConnect,
} from "@/lib/pinterestConnection";

/** Public board URL import + aesthetic search (no Pinterest account required). */
export const pinterestApi = {
  async searchAesthetic(query: string): Promise<{ success: boolean; images: PinterestImage[]; error?: string }> {
    const { data, error } = await supabase.functions.invoke("pinterest-search", {
      body: { query },
    });
    if (error) return { success: false, images: [], error: error.message };
    return data;
  },

  async importBoard(boardUrl: string): Promise<{ success: boolean; images: PinterestImage[]; error?: string }> {
    const { data, error } = await supabase.functions.invoke("pinterest-search", {
      body: { boardUrl },
    });
    if (error) return { success: false, images: [], error: error.message };
    return data;
  },
};
