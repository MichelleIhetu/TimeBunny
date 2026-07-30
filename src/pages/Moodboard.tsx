import { useState, useEffect } from "react";
import SEO from "@/components/SEO";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Heart, Bookmark, Search, Sparkles, ExternalLink, Link2, X, Check, Loader2, Plus, Trash2, FolderHeart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { pinterestApi, type PinterestImage } from "@/lib/api/pinterest";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MoodboardItem {
  id: string;
  imageUrl: string;
  title: string;
  height: "short" | "medium" | "tall";
}

interface Aesthetic {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
  items: MoodboardItem[];
}

interface SavedItem {
  id: string;
  board_name: string;
  image_url: string;
  title: string;
  source_url: string;
  created_at: string;
}

const aesthetics: Aesthetic[] = [
  {
    id: "academic-weapon",
    name: "Academic Weapon",
    emoji: "📚",
    description: "Peak productivity & study motivation",
    color: "#8b4513",
    items: [
      { id: "aw1", imageUrl: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=400", title: "Study Setup", height: "tall" },
      { id: "aw2", imageUrl: "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400", title: "Book Stack", height: "medium" },
      { id: "aw3", imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400", title: "Notes & Coffee", height: "short" },
      { id: "aw4", imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=400", title: "Library Goals", height: "tall" },
      { id: "aw5", imageUrl: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400", title: "Study Group", height: "medium" },
      { id: "aw6", imageUrl: "https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=400", title: "Desk Aesthetic", height: "short" },
    ],
  },
  {
    id: "dark-academia",
    name: "Dark Academia",
    emoji: "🖋️",
    description: "Gothic scholarly vibes",
    color: "#2d1b0e",
    items: [
      { id: "da1", imageUrl: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400", title: "Ancient Library", height: "tall" },
      { id: "da2", imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400", title: "Reading Nook", height: "medium" },
      { id: "da3", imageUrl: "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400", title: "Vintage Books", height: "tall" },
      { id: "da4", imageUrl: "https://images.unsplash.com/photo-1519682337058-a94d519337bc?w=400", title: "Candlelit Study", height: "short" },
      { id: "da5", imageUrl: "https://images.unsplash.com/photo-1456324504439-367cee3b3c32?w=400", title: "Typewriter", height: "medium" },
    ],
  },
  {
    id: "cozy-study",
    name: "Cozy Study",
    emoji: "☕",
    description: "Warm & comfortable productivity",
    color: "#d4a574",
    items: [
      { id: "cs1", imageUrl: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400", title: "Coffee & Books", height: "medium" },
      { id: "cs2", imageUrl: "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?w=400", title: "Home Office", height: "tall" },
      { id: "cs3", imageUrl: "https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400", title: "Blanket Season", height: "short" },
      { id: "cs4", imageUrl: "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=400", title: "Laptop Work", height: "medium" },
      { id: "cs5", imageUrl: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400", title: "Coding Setup", height: "tall" },
    ],
  },
  {
    id: "minimalist-focus",
    name: "Minimalist Focus",
    emoji: "🤍",
    description: "Clean & distraction-free",
    color: "#f5f5f5",
    items: [
      { id: "mf1", imageUrl: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400", title: "Clean Desk", height: "medium" },
      { id: "mf2", imageUrl: "https://images.unsplash.com/photo-1494438639946-1ebd1d20bf85?w=400", title: "White Space", height: "tall" },
      { id: "mf3", imageUrl: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=400", title: "Simple Setup", height: "short" },
      { id: "mf4", imageUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=400", title: "Morning Work", height: "medium" },
    ],
  },
  {
    id: "nature-study",
    name: "Nature Study",
    emoji: "🌿",
    description: "Outdoor inspiration & greenery",
    color: "#2d5a27",
    items: [
      { id: "ns1", imageUrl: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=400", title: "Plant Corner", height: "tall" },
      { id: "ns2", imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400", title: "Garden Study", height: "medium" },
      { id: "ns3", imageUrl: "https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=400", title: "Green Desk", height: "short" },
      { id: "ns4", imageUrl: "https://images.unsplash.com/photo-1463320726281-696a485928c7?w=400", title: "Window View", height: "tall" },
    ],
  },
  {
    id: "night-owl",
    name: "Night Owl",
    emoji: "🌙",
    description: "Late night productivity vibes",
    color: "#1a1a2e",
    items: [
      { id: "no1", imageUrl: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=400", title: "Night Coding", height: "medium" },
      { id: "no2", imageUrl: "https://images.unsplash.com/photo-1536859355448-76f92ebdc33d?w=400", title: "City Lights", height: "tall" },
      { id: "no3", imageUrl: "https://images.unsplash.com/photo-1484417894907-623942c8ee29?w=400", title: "Dark Mode", height: "short" },
      { id: "no4", imageUrl: "https://images.unsplash.com/photo-1550439062-609e1531270e?w=400", title: "Late Night", height: "medium" },
    ],
  },
];

const Moodboard = () => {
  const { user } = useAuth();
  const [selectedAesthetic, setSelectedAesthetic] = useState<Aesthetic | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [activeTab, setActiveTab] = useState("browse");


  // Pinterest search state
  const [pinterestQuery, setPinterestQuery] = useState("");
  const [pinterestResults, setPinterestResults] = useState<PinterestImage[]>([]);
  const [pinterestLoading, setPinterestLoading] = useState(false);

  // Board import state
  const [boardUrl, setBoardUrl] = useState("");
  const [boardImportLoading, setBoardImportLoading] = useState(false);
  const [boardResults, setBoardResults] = useState<PinterestImage[]>([]);

  // Board management
  const [newBoardName, setNewBoardName] = useState("");
  const [selectedBoard, setSelectedBoard] = useState("My Board");

  const filteredAesthetics = aesthetics.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Load saved items
  useEffect(() => {
    if (user) {
      loadSavedItems();
    }
  }, [user]);

  const loadSavedItems = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("moodboard_items")
      .select("*")
      .order("created_at", { ascending: false });
    if (data && !error) {
      setSavedItems(data as SavedItem[]);
    }
  };

  const saveImage = async (imageUrl: string, title: string, sourceUrl: string, boardName?: string) => {
    if (!user) {
      toast.error("Sign in to save images to your boards");
      return;
    }
    const { error } = await supabase.from("moodboard_items").insert({
      user_id: user.id,
      image_url: imageUrl,
      title: title || "Untitled",
      source_url: sourceUrl || "",
      board_name: boardName || selectedBoard,
    });
    if (error) {
      toast.error("Failed to save image");
      console.error(error);
    } else {
      toast.success("Saved to " + (boardName || selectedBoard) + " ✨");
      loadSavedItems();
    }
  };

  const removeSavedItem = async (id: string) => {
    const { error } = await supabase.from("moodboard_items").delete().eq("id", id);
    if (!error) {
      setSavedItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Removed from board");
    }
  };

  const handlePinterestSearch = async () => {
    if (!pinterestQuery.trim()) return;
    setPinterestLoading(true);
    setPinterestResults([]);
    try {
      const result = await pinterestApi.searchAesthetic(pinterestQuery);
      if (result.success && result.images.length > 0) {
        setPinterestResults(result.images);
      } else {
        toast.error(result.error || "No images found. Try a different search term.");
      }
    } catch (err) {
      toast.error("Search failed. Please try again.");
    } finally {
      setPinterestLoading(false);
    }
  };

  const handleBoardImport = async () => {
    if (!boardUrl.trim()) return;
    setBoardImportLoading(true);
    setBoardResults([]);
    try {
      const result = await pinterestApi.importBoard(boardUrl);
      if (result.success && result.images.length > 0) {
        setBoardResults(result.images);
        toast.success(`Found ${result.images.length} images!`);
      } else {
        toast.error(result.error || "Couldn't extract images from that URL");
      }
    } catch (err) {
      toast.error("Import failed. Please check the URL.");
    } finally {
      setBoardImportLoading(false);
    }
  };

  const boards = [...new Set(savedItems.map((i) => i.board_name))];

  const heightClasses = {
    short: "h-40",
    medium: "h-56",
    tall: "h-72",
  };

  const ImageCard = ({ imageUrl, title, sourceUrl, onSave, onRemove, isSaved }: {
    imageUrl: string; title: string; sourceUrl?: string;
    onSave?: () => void; onRemove?: () => void; isSaved?: boolean;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="break-inside-avoid group relative rounded-xl overflow-hidden shadow-card mb-4"
    >
      <img
        src={imageUrl}
        alt={title}
        className="w-full object-cover min-h-[160px] max-h-[320px] transition-transform duration-300 group-hover:scale-105"
        loading="lazy"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white text-sm font-body line-clamp-2">{title}</p>
        </div>
        <div className="absolute top-2 right-2 flex gap-2">
          {onSave && (
            <button
              onClick={onSave}
              aria-label="Save image to board"
              className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
              title="Save to board"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          )}
          {onRemove && (
            <button
              onClick={onRemove}
              aria-label="Remove image from board"
              className="p-2 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 transition-colors"
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 left-2 p-2 rounded-full bg-white/90 text-gray-700 hover:bg-white transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "hsl(300 50% 88%)" }}>
      <SEO title="Moodboard — TimeBunny" description="Curate a Pinterest-style aesthetic moodboard to inspire your focus and motivation in TimeBunny." path="/moodboard" />

      <div className="container max-w-6xl mx-auto px-4 py-6 relative z-10 min-h-screen">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/" aria-label="Back to home">
              <Button variant="ghost" size="icon" aria-label="Back to home">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-display text-2xl md:text-3xl text-foreground">
                ✨ Moodboard
              </h1>
              <p className="text-sm text-muted-foreground font-body">
                Find your study aesthetic
              </p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-4 max-w-lg">
            <TabsTrigger value="browse" className="gap-1 text-xs sm:text-sm">
              <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Browse</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-1 text-xs sm:text-sm">
              <Search className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Search</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1 text-xs sm:text-sm">
              <Link2 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-1 text-xs sm:text-sm">
              <FolderHeart className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">My Boards</span>
              {savedItems.length > 0 && (
                <span className="ml-1 text-xs bg-primary/20 text-primary px-1.5 rounded-full">
                  {savedItems.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Browse Tab */}
          <TabsContent value="browse" className="mt-6">
            {/* Search filter */}
            <div className="relative mb-6 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter aesthetics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <AnimatePresence mode="wait">
              {selectedAesthetic ? (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="flex items-center gap-4 mb-6">
                    <Button variant="outline" size="sm" onClick={() => setSelectedAesthetic(null)}>
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <div>
                      <h2 className="font-display text-xl flex items-center gap-2">
                        {selectedAesthetic.emoji} {selectedAesthetic.name}
                      </h2>
                      <p className="text-sm text-muted-foreground">{selectedAesthetic.description}</p>
                    </div>
                  </div>

                  <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                    {selectedAesthetic.items.map((item) => (
                      <div key={item.id} className="break-inside-avoid mb-4">
                        <ImageCard
                          imageUrl={item.imageUrl}
                          title={item.title}
                          onSave={() => saveImage(item.imageUrl, item.title, item.imageUrl)}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="categories"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAesthetics.map((aesthetic, index) => (
                      <motion.button
                        key={aesthetic.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => setSelectedAesthetic(aesthetic)}
                        className="group relative overflow-hidden rounded-2xl border border-border bg-card/80 backdrop-blur-sm shadow-card hover:shadow-float transition-all duration-300 text-left"
                      >
                        <div className="grid grid-cols-3 gap-0.5 h-32 overflow-hidden">
                          {aesthetic.items.slice(0, 3).map((item) => (
                            <img
                              key={item.id}
                              src={item.imageUrl}
                              alt=""
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                            />
                          ))}
                        </div>
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl">{aesthetic.emoji}</span>
                            <h3 className="font-display text-lg text-foreground">{aesthetic.name}</h3>
                          </div>
                          <p className="text-sm text-muted-foreground font-body">{aesthetic.description}</p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {aesthetic.items.length} images
                          </div>
                        </div>
                      </motion.button>
                    ))}
                  </div>
                  {filteredAesthetics.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground font-body">No aesthetics found for "{searchQuery}"</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>

          {/* Search Tab - Pinterest Search */}
          <TabsContent value="search" className="mt-6">
            <div className="max-w-xl mx-auto mb-8">
              <h2 className="font-display text-lg text-foreground mb-2 text-center">🔍 Search Aesthetic Inspiration</h2>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Search for any aesthetic, study vibe, or mood
              </p>
              <form
                onSubmit={(e) => { e.preventDefault(); handlePinterestSearch(); }}
                className="flex gap-2"
              >
                <Input
                  placeholder="e.g. dark academia, cottagecore study, neon desk setup..."
                  value={pinterestQuery}
                  onChange={(e) => setPinterestQuery(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={pinterestLoading || !pinterestQuery.trim()}>
                  {pinterestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </form>

              {/* Quick search tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {["Dark Academia", "Cottagecore Study", "Minimalist Desk", "Neon Gaming Setup", "Library Aesthetic"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => { setPinterestQuery(tag); }}
                    className="px-3 py-1 text-xs bg-muted hover:bg-muted/80 rounded-full font-body transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {pinterestLoading && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Searching for inspiration...</p>
              </div>
            )}

            {pinterestResults.length > 0 && (
              <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                {pinterestResults.map((img, i) => (
                  <ImageCard
                    key={`pin-${i}`}
                    imageUrl={img.imageUrl}
                    title={img.title}
                    sourceUrl={img.sourceUrl}
                    onSave={() => saveImage(img.imageUrl, img.title, img.sourceUrl)}
                  />
                ))}
              </div>
            )}

            {!pinterestLoading && pinterestResults.length === 0 && pinterestQuery && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="font-body">Search for an aesthetic to see results</p>
              </div>
            )}
          </TabsContent>

          {/* Import Tab - Pinterest Board URL */}
          <TabsContent value="import" className="mt-6">
            <div className="max-w-xl mx-auto mb-8">
              <h2 className="font-display text-lg text-foreground mb-2 text-center">📌 Import Pinterest Board</h2>
              <p className="text-sm text-muted-foreground text-center mb-4">
                Paste a Pinterest board URL to import images
              </p>
              <form
                onSubmit={(e) => { e.preventDefault(); handleBoardImport(); }}
                className="flex gap-2"
              >
                <Input
                  placeholder="https://pinterest.com/username/board-name"
                  value={boardUrl}
                  onChange={(e) => setBoardUrl(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={boardImportLoading || !boardUrl.trim()}>
                  {boardImportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Import"}
                </Button>
              </form>
            </div>

            {boardImportLoading && (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Importing board...</p>
              </div>
            )}

            {boardResults.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">{boardResults.length} images found</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      boardResults.forEach((img) => saveImage(img.imageUrl, img.title, img.sourceUrl));
                    }}
                  >
                    <Bookmark className="w-4 h-4 mr-1" />
                    Save All
                  </Button>
                </div>
                <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                  {boardResults.map((img, i) => (
                    <ImageCard
                      key={`board-${i}`}
                      imageUrl={img.imageUrl}
                      title={img.title}
                      sourceUrl={img.sourceUrl}
                      onSave={() => saveImage(img.imageUrl, img.title, img.sourceUrl)}
                    />
                  ))}
                </div>
              </>
            )}
          </TabsContent>

          {/* Saved Boards Tab */}
          <TabsContent value="saved" className="mt-6">
            {savedItems.length === 0 ? (
              <div className="text-center py-16">
                <FolderHeart className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="font-display text-lg text-foreground mb-2">No saved images yet</h3>
                <p className="text-sm text-muted-foreground font-body mb-4">
                  Browse, search, or import images and save them to your boards
                </p>
                <Button variant="outline" onClick={() => setActiveTab("browse")}>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Start Exploring
                </Button>
              </div>
            ) : (
              <>
                {/* Board selector */}
                <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
                  <button
                    onClick={() => setSelectedBoard("all")}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-body transition-colors ${
                      selectedBoard === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    All ({savedItems.length})
                  </button>
                  {boards.map((board) => (
                    <button
                      key={board}
                      onClick={() => setSelectedBoard(board)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-body transition-colors ${
                        selectedBoard === board
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      }`}
                    >
                      {board} ({savedItems.filter((i) => i.board_name === board).length})
                    </button>
                  ))}
                </div>

                <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
                  {savedItems
                    .filter((i) => selectedBoard === "all" || i.board_name === selectedBoard)
                    .map((item) => (
                      <ImageCard
                        key={item.id}
                        imageUrl={item.image_url}
                        title={item.title || "Untitled"}
                        sourceUrl={item.source_url}
                        onRemove={() => removeSavedItem(item.id)}
                      />
                    ))}
                </div>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Moodboard;
