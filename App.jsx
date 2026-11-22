import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag
} from "lucide-react";


import { Header } from "./components/Header";
import { MerchantDashboard } from "./components/MerchantDashboard";
import { OrderTrackerModal } from "./components/OrderTrackerModal";
import { ProductDetailModal } from "./components/ProductDetailModal";
import { ProductRatingSummary } from "./components/ProductRatingSummary";
import { ProductShareMenu } from "./components/ProductShareMenu";
import { ResilientImage } from "./components/ResilientImage";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import {
  CANONICAL_3D_CATEGORIES,
  DEFAULT_STORE_SETTINGS,
  FALLBACK_PRODUCTS,
  HERO_BANNER_IMAGE,
  KEYCHAIN_STARTER_IDS,
  LEGACY_KEYCHAIN_STARTER_ID,
  REMOVED_STARTER_IDS,
  STARTER_PRODUCT_IDS
} from "./data/seedCatalog";
import { TranslationProvider, useTranslation } from "./i18n/TranslationContext";
import {
  subscribeActiveProducts,
  subscribeStoreSettings,
  subscribeVisibleReviews,
  submitCustomerMessage
} from "./services/storeService";
import {
  VALIDATION_LIMITS
} from "./types/store";
const CART_STORAGE_KEY = "aseel_store_cart_v1";
const ORDERS_STORAGE_KEY = "aseel_recent_orders_v1";
const ALL_CATEGORY_KEY = "__ALL__";
function StorefrontApp() {
  const { t, td, ensureDynamicTexts } = useTranslation();
  const [view, setView] = useState("storefront");
  const [firestoreProducts, setFirestoreProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_STORE_SETTINGS);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY_KEY);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [cartNotice, setCartNotice] = useState("");
  const [cart, setCart] = useState(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [recentOrders, setRecentOrders] = useState(() => {
    try {
      const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [senderName, setSenderName] = useState("");
  const [senderContact, setSenderContact] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [messageError, setMessageError] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
    }
  }, [cart]);
  useEffect(() => {
    const unsubProducts = subscribeActiveProducts(
      (items) => {
        setFirestoreProducts(items);
        setProductsLoaded(true);
      },
      () => {
        setProductsLoaded(true);
      }
    );
    const unsubSettings = subscribeStoreSettings((remoteSettings) => {
      if (remoteSettings) {
        setSettings({
          ...DEFAULT_STORE_SETTINGS,
          ...remoteSettings,
          instagram: remoteSettings.instagram !== void 0 ? remoteSettings.instagram : DEFAULT_STORE_SETTINGS.instagram
        });
      }
    });
    const unsubReviews = subscribeVisibleReviews(
      (items) => {
        setReviews(items);
      },
      () => {
      }
    );
    return () => {
      unsubProducts();
      unsubSettings();
      unsubReviews();
    };
  }, []);
  const displayProducts = useMemo(() => {
    if (firestoreProducts.length === 0) {
      return productsLoaded ? FALLBACK_PRODUCTS : FALLBACK_PRODUCTS;
    }
    const isStarterCatalogOnly = firestoreProducts.every(
      (p) => STARTER_PRODUCT_IDS.has(p.id)
    );
    if (isStarterCatalogOnly) {
      const hasNewKeychains = firestoreProducts.some(
        (p) => KEYCHAIN_STARTER_IDS.has(p.id)
      );
      const baseFirestore = (hasNewKeychains ? firestoreProducts : firestoreProducts.filter((p) => p.id !== LEGACY_KEYCHAIN_STARTER_ID)).filter((p) => !REMOVED_STARTER_IDS.has(p.id));
      const existingIds = new Set(baseFirestore.map((p) => p.id));
      const missingStarters = FALLBACK_PRODUCTS.filter(
        (p) => !existingIds.has(p.id)
      );
      return [...baseFirestore, ...missingStarters];
    }
    return firestoreProducts;
  }, [firestoreProducts, productsLoaded]);
  const pendingDeepLinkIdRef = useRef(
    (() => {
      try {
        return new URLSearchParams(window.location.search).get("product");
      } catch {
        return null;
      }
    })()
  );
  useEffect(() => {
    const targetId = pendingDeepLinkIdRef.current;
    if (!targetId) return;
    const match = displayProducts.find((p) => p.id === targetId);
    if (match) {
      setSelectedProduct(match);
      pendingDeepLinkIdRef.current = null;
    }
  }, [displayProducts]);
  const handleCloseProductModal = () => {
    setSelectedProduct(null);
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("product")) {
        url.searchParams.delete("product");
        window.history.replaceState({}, "", url.toString());
      }
    } catch {
    }
  };
  useEffect(() => {
    const texts = [
      settings.tagline,
      settings.city,
      settings.workingHours,
      settings.currency,
      "قياسي",
      ...CANONICAL_3D_CATEGORIES
    ];
    for (const p of displayProducts) {
      texts.push(p.title, p.category, p.description, ...p.variants);
    }
    for (const c of cart) {
      texts.push(c.title, c.variant);
    }
    for (const r of reviews) {
      texts.push(r.comment);
    }
    ensureDynamicTexts(texts);
  }, [cart, displayProducts, ensureDynamicTexts, reviews, settings]);
  const reviewsByProduct = useMemo(() => {
    const map = {};
    for (const rev of reviews) {
      if (!map[rev.productId]) map[rev.productId] = [];
      map[rev.productId].push(rev);
    }
    return map;
  }, [reviews]);
  const ratingStatsByProduct = useMemo(() => {
    const stats = {};
    for (const [productId, list] of Object.entries(reviewsByProduct)) {
      const count = list.length;
      const sum = list.reduce((acc, r) => acc + r.rating, 0);
      stats[productId] = {
        count,
        average: count > 0 ? sum / count : 0
      };
    }
    return stats;
  }, [reviewsByProduct]);
  const categories = useMemo(() => {
    const present = new Set(displayProducts.map((p) => p.category));
    const orderedCanonical = CANONICAL_3D_CATEGORIES.filter((cat) => present.has(cat));
    const extraCustom = Array.from(present).filter(
      (cat) => !CANONICAL_3D_CATEGORIES.includes(cat)
    );
    return [ALL_CATEGORY_KEY, ...orderedCanonical, ...extraCustom];
  }, [displayProducts]);
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return displayProducts.filter((product) => {
      const matchesCat = selectedCategory === ALL_CATEGORY_KEY || product.category === selectedCategory;
      const matchesSearch = !q || product.title.toLowerCase().includes(q) || product.category.toLowerCase().includes(q) || product.description.toLowerCase().includes(q) || td(product.title).toLowerCase().includes(q) || td(product.category).toLowerCase().includes(q) || td(product.description).toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [displayProducts, selectedCategory, searchQuery, td]);
  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );
  const handleAddToCart = (product, variant, quantity = 1) => {
    if (product.stock <= 0) return;
    setCart((prev) => {
      const idx = prev.findIndex(
        (item) => item.productId === product.id && item.variant === variant
      );
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          quantity: Math.min(100, updated[idx].quantity + quantity)
        };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          title: product.title,
          price: product.price,
          imageUrl: product.imageUrl,
          variant,
          quantity
        }
      ];
    });
    setCartNotice(td(product.title));
    setTimeout(() => setCartNotice(""), 2600);
  };
  const handleUpdateCartQuantity = (productId, variant, delta) => {
    setCart(
      (prev) => prev.map((item) => {
        if (item.productId === productId && item.variant === variant) {
          return { ...item, quantity: item.quantity + delta };
        }
        return item;
      }).filter((item) => item.quantity > 0)
    );
  };
  const handleRemoveCartItem = (productId, variant) => {
    setCart(
      (prev) => prev.filter((item) => !(item.productId === productId && item.variant === variant))
    );
  };
  const handleOrderCreated = (orderNumber) => {
    setRecentOrders((prev) => {
      const next = [orderNumber, ...prev.filter((o) => o !== orderNumber)].slice(0, 5);
      try {
        localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(next));
      } catch {
      }
      return next;
    });
  };
  const handleNavigateSection = (sectionId) => {
    if (view !== "storefront") {
      setView("storefront");
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
      }, 60);
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
  };
  const handleSendContactMessage = async (e) => {
    e.preventDefault();
    setMessageError("");
    setMessageSent(false);
    if (senderName.trim().length < VALIDATION_LIMITS.MSG_NAME_MIN) {
      setMessageError(t("contact.errName"));
      return;
    }
    if (senderContact.trim().length < VALIDATION_LIMITS.MSG_CONTACT_MIN) {
      setMessageError(t("contact.errContact"));
      return;
    }
    if (subject.trim().length < VALIDATION_LIMITS.MSG_SUBJECT_MIN) {
      setMessageError(t("contact.errSubject"));
      return;
    }
    if (body.trim().length < VALIDATION_LIMITS.MSG_BODY_MIN) {
      setMessageError(t("contact.errBody"));
      return;
    }
    setSendingMessage(true);
    try {
      await submitCustomerMessage({
        senderName,
        senderContact,
        subject,
        body
      });
      setSenderName("");
      setSenderContact("");
      setSubject("");
      setBody("");
      setMessageSent(true);
    } catch {
      setMessageError(t("contact.errSend"));
    } finally {
      setSendingMessage(false);
    }
  };
  const cleanWhatsapp = settings.whatsapp.replace(/[^0-9]/g, "");
  const directWhatsappHref = cleanWhatsapp ? `https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
    t("contact.whatsappGreeting", { storeName: settings.storeName })
  )}` : void 0;
  const rawInstagram = (settings.instagram ?? "").trim();
  const instagramHandle = rawInstagram.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@+/, "").replace(/\/.*$/, "").trim();
  const instagramHref = instagramHandle ? `https://www.instagram.com/${instagramHandle}/` : void 0;
  const localizedCity = td(settings.city);
  const localizedTagline = td(settings.tagline);
  const localizedHours = td(settings.workingHours);
  const localizedCurrency = td(settings.currency);
  return <div className="min-h-screen flex flex-col text-white">
      <Header
    storeName={settings.storeName}
    cartCount={cartCount}
    activeView={view}
    onNavigateSection={handleNavigateSection}
    onOpenOrderTracker={() => setTrackerOpen(true)}
    onOpenAdmin={() => {
      setView("admin");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}
    onOpenCart={() => setCartOpen(true)}
  />

      {
    /* Non-intrusive Cart Feedback Toast */
  }
      {cartNotice && <div
    role="status"
    aria-live="polite"
    className="fixed bottom-6 end-6 z-40 flex items-center gap-3 px-4 py-3 bg-[#1a0830] border border-pink-400/40 text-white text-sm rounded-xl shadow-lg shadow-pink-950/50"
  >
          <span>{t("catalog.addedToast", { title: cartNotice })}</span>
          <button
    type="button"
    onClick={() => setCartOpen(true)}
    className="text-xs font-semibold text-pink-300 hover:text-pink-200 underline underline-offset-4 whitespace-nowrap"
  >
            {t("catalog.viewCart")}
          </button>
        </div>}

      <main className="flex-1">
        {view === "admin" ? <MerchantDashboard
    settings={settings}
    onBackToStore={() => setView("storefront")}
  /> : <>
            {
    /* Section 1: Storefront Hero */
  }
            <section id="hero" className="border-b border-pink-300/15">
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
                  <div className="lg:col-span-5 flex flex-col justify-center space-y-6">
                    <p className="text-xs font-medium text-pink-200/80 tracking-wide">
                      {localizedCity}
                    </p>
                    <h1 className="font-serif text-4xl sm:text-5xl font-bold text-white leading-[1.2]">
                      {t("hero.headline")}
                    </h1>
                    <p className="text-base text-pink-100/85 leading-relaxed max-w-prose">
                      {localizedTagline}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 pt-2">
                      <button
    type="button"
    onClick={() => handleNavigateSection("catalog")}
    className="px-6 py-3 text-sm font-semibold text-white bg-gradient-to-l from-pink-600 to-fuchsia-600 hover:from-pink-500 hover:to-fuchsia-500 rounded-lg shadow-lg shadow-pink-950/40 transition-all min-h-[44px]"
  >
                        {t("hero.browseProducts")}
                      </button>
                      <button
    type="button"
    onClick={() => handleNavigateSection("contact")}
    className="px-4 py-3 text-sm font-medium text-pink-100 hover:text-white underline underline-offset-4 transition-colors min-h-[44px]"
  >
                        {t("hero.contactDirect")}
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-7">
                    <div className="h-full min-h-[300px] sm:min-h-[380px] rounded-xl overflow-hidden bg-[#f9f9f9] border border-pink-200/30 shadow-xl shadow-purple-950/40 flex items-center justify-center">
                      <ResilientImage
    src={HERO_BANNER_IMAGE}
    alt={t("hero.imageAlt", { storeName: settings.storeName })}
    fallbackTitle={settings.storeName}
    className="w-full h-full object-contain"
  />
                    </div>
                  </div>
                </div>
              </div>

              {
    /* 4-column Store Guarantees Strip below hero split */
  }
              <div className="border-t border-pink-300/15 bg-[#140624]/55 backdrop-blur-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">
                      {t("hero.guarantee1Title")}
                    </p>
                    <p className="text-xs text-pink-200/75">
                      {t("hero.guarantee1Desc")}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">
                      {t("hero.guarantee2Title")}
                    </p>
                    <p className="text-xs text-pink-200/75">
                      {t("hero.guarantee2Desc")}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">
                      {t("hero.guarantee3Title")}
                    </p>
                    <p className="text-xs text-pink-200/75 tabular-nums">
                      {t("hero.guarantee3Desc", {
    amount: settings.freeShippingThreshold.toLocaleString("en-US"),
    currency: localizedCurrency
  })}
                    </p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-semibold text-white">
                      {t("hero.guarantee4Title")}
                    </p>
                    <p className="text-xs text-pink-200/75">
                      {t("hero.guarantee4Desc")}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {
    /* Section 2: Featured Collection & Catalog Grid */
  }
            <section
    id="catalog"
    className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-8"
  >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                  <h2 className="font-serif text-3xl font-bold text-white">
                    {t("catalog.heading")}
                  </h2>
                  <p className="text-sm text-pink-100/80">
                    {t("catalog.subheading")}
                  </p>
                </div>

                {
    /* Search Input */
  }
                <div className="relative w-full md:w-72">
                  <Search
    className="w-4 h-4 text-pink-200/60 absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
    aria-hidden="true"
  />
                  <input
    type="search"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder={t("catalog.searchPlaceholder")}
    aria-label={t("catalog.searchLabel")}
    className="w-full ps-10 pe-4 py-2.5 text-sm bg-[#120520]/80 border border-pink-300/25 text-white placeholder:text-pink-200/45 rounded-lg focus:outline-none focus:border-pink-400"
  />
                </div>
              </div>

              {
    /* Interactive Category Filter Tabs */
  }
              <div
    role="tablist"
    aria-label={t("catalog.categoriesLabel")}
    className="flex flex-wrap items-center gap-2 p-1.5 bg-[#140624]/70 border border-pink-300/20 backdrop-blur-sm rounded-xl w-fit"
  >
                {categories.map((cat) => {
    const active = selectedCategory === cat;
    const label = cat === ALL_CATEGORY_KEY ? t("catalog.allCategory") : td(cat);
    return <button
      key={cat}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={() => setSelectedCategory(cat)}
      className={`px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${active ? "bg-pink-600 text-white shadow-sm" : "text-pink-100/80 hover:text-white"}`}
    >
                      {label}
                    </button>;
  })}
              </div>

              {
    /* 3-Column Product Grid */
  }
              {filteredProducts.length === 0 ? <div className="bg-[#1b0a31]/85 backdrop-blur-md border border-pink-300/20 rounded-xl p-12 text-center space-y-3">
                  <p className="text-base font-medium text-white">
                    {t("catalog.emptySearch")}
                  </p>
                  <button
    type="button"
    onClick={() => {
      setSelectedCategory(ALL_CATEGORY_KEY);
      setSearchQuery("");
    }}
    className="px-4 py-2 text-xs font-medium text-pink-200 bg-white/10 hover:bg-white/20 border border-pink-300/20 rounded-lg transition-colors"
  >
                    {t("catalog.showAll")}
                  </button>
                </div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {filteredProducts.map((product) => {
    const defaultVariant = product.variants.length > 0 ? product.variants[0] : "قياسي";
    const outOfStock = product.stock <= 0;
    const ratingStats = ratingStatsByProduct[product.id] ?? {
      average: 0,
      count: 0
    };
    const localizedTitle = td(product.title);
    const localizedCategory = td(product.category);
    const localizedDescription = td(product.description);
    return <article
      key={product.id}
      className="relative group bg-[#1b0a31]/85 backdrop-blur-md border border-pink-300/20 rounded-xl flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:z-20 focus-within:z-20 hover:border-pink-400/50 hover:shadow-xl hover:shadow-purple-950/50"
    >
                        <button
      type="button"
      onClick={() => setSelectedProduct(product)}
      className="block w-full text-start aspect-[4/3] bg-[#120520] rounded-t-xl overflow-hidden focus-visible:outline-2 focus-visible:outline-pink-400"
    >
                          <ResilientImage
      src={product.imageUrl}
      alt={localizedTitle}
      fallbackTitle={localizedTitle}
      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
    />
                        </button>

                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-xs text-pink-200/75">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{localizedCategory}</span>
                                <span aria-hidden="true">·</span>
                                <span className="whitespace-nowrap">
                                  {outOfStock ? t("catalog.outOfStockShort") : t("catalog.inStockShort")}
                                </span>
                              </div>
                              <ProductShareMenu
      productId={product.id}
      productTitle={localizedTitle}
      productPrice={product.price}
      currency={localizedCurrency}
    />
                            </div>

                            <button
      type="button"
      onClick={() => setSelectedProduct(product)}
      className="block text-start w-full"
    >
                              <h3 className="text-base font-semibold text-white group-hover:text-pink-300 transition-colors leading-snug">
                                {localizedTitle}
                              </h3>
                            </button>

                            <ProductRatingSummary
      average={ratingStats.average}
      count={ratingStats.count}
      size="sm"
    />

                            <p className="text-sm text-pink-100/80 line-clamp-2 leading-relaxed">
                              {localizedDescription}
                            </p>
                          </div>

                          <div className="flex items-center justify-between gap-3 pt-3 border-t border-pink-300/15">
                            <span className="text-base font-bold text-pink-300 tabular-nums">
                              {product.price.toLocaleString("en-US")} {localizedCurrency}
                            </span>

                            <div className="flex items-center gap-2">
                              <button
      type="button"
      onClick={() => setSelectedProduct(product)}
      className="px-3 py-2 text-xs font-medium text-pink-100 hover:text-white bg-white/10 hover:bg-white/20 border border-pink-300/15 rounded-lg transition-colors whitespace-nowrap shrink-0"
    >
                                {t("catalog.detailsBtn")}
                              </button>
                              <button
      type="button"
      disabled={outOfStock}
      onClick={() => handleAddToCart(product, defaultVariant, 1)}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-l from-pink-600 to-fuchsia-600 rounded-lg hover:from-pink-500 hover:to-fuchsia-500 disabled:bg-white/10 disabled:from-transparent disabled:to-transparent disabled:text-pink-200/40 transition-all whitespace-nowrap shrink-0"
    >
                                <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>
                                  {outOfStock ? t("catalog.soldOutBtn") : t("catalog.addToCart")}
                                </span>
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>;
  })}
                </div>}
            </section>

            {
    /* Section 3: Story & Direct Customer Contact */
  }
            <section
    id="contact"
    className="border-t border-pink-300/15 bg-[#120520]/30 py-14 sm:py-20"
  >
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
                  {
    /* Story & Direct Channels */
  }
                  <div id="story" className="lg:col-span-5 space-y-6">
                    <div className="space-y-3">
                      <h2 className="font-serif text-3xl font-bold text-white">
                        {t("contact.heading")}
                      </h2>
                      <p className="text-sm sm:text-base text-pink-100/85 leading-relaxed">
                        {t("contact.storyBody", { storeName: settings.storeName })}
                      </p>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-pink-300/15 text-sm">
                      {directWhatsappHref && <a
    href={directWhatsappHref}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-between p-3.5 rounded-xl bg-gradient-to-l from-pink-600 to-fuchsia-600 text-white hover:from-pink-500 hover:to-fuchsia-500 shadow-lg shadow-pink-950/30 transition-all"
  >
                          <span className="inline-flex items-center gap-2.5 font-semibold">
                            <MessageCircle className="w-4 h-4" aria-hidden="true" />
                            <span>{t("contact.whatsappDirect")}</span>
                          </span>
                          <span translate="no" className="text-xs opacity-90 tabular-nums" dir="ltr">
                            +{cleanWhatsapp}
                          </span>
                        </a>}

                      {settings.phone && <a
    href={`tel:${settings.phone}`}
    className="flex items-center gap-3 p-3 rounded-xl bg-[#1b0a31]/85 border border-pink-300/20 text-pink-50 hover:bg-[#260f42] transition-colors"
  >
                          <Phone className="w-4 h-4 text-pink-400 shrink-0" aria-hidden="true" />
                          <span translate="no" className="tabular-nums" dir="ltr">
                            {settings.phone}
                          </span>
                        </a>}

                      {settings.email && <a
    href={`mailto:${settings.email}`}
    className="flex items-center gap-3 p-3 rounded-xl bg-[#1b0a31]/85 border border-pink-300/20 text-pink-50 hover:bg-[#260f42] transition-colors"
  >
                          <Mail className="w-4 h-4 text-pink-400 shrink-0" aria-hidden="true" />
                          <span translate="no" className="truncate">{settings.email}</span>
                        </a>}

                      {instagramHref && <a
    href={instagramHref}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center justify-between p-3 rounded-xl bg-[#1b0a31]/85 border border-pink-300/20 text-pink-50 hover:bg-[#260f42] transition-colors"
  >
                          <span className="inline-flex items-center gap-3 font-medium">
                            <Instagram className="w-4 h-4 text-pink-400 shrink-0" aria-hidden="true" />
                            <span>{t("contact.instagram")}</span>
                          </span>
                          <span translate="no" className="text-xs text-pink-200/80 font-medium" dir="ltr">
                            @{instagramHandle}
                          </span>
                        </a>}

                      <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-pink-200/75">
                        <MapPin className="w-4 h-4 text-pink-300/70 shrink-0" aria-hidden="true" />
                        <span>{localizedCity}</span>
                      </div>

                      <div className="flex items-center gap-3 px-3 py-1.5 text-xs text-pink-200/75">
                        <Clock className="w-4 h-4 text-pink-300/70 shrink-0" aria-hidden="true" />
                        <span>{localizedHours}</span>
                      </div>
                    </div>
                  </div>

                  {
    /* Customer Message Form */
  }
                  <div className="lg:col-span-7 bg-[#1b0a31]/85 backdrop-blur-md border border-pink-300/20 rounded-xl p-6 sm:p-8">
                    <div className="space-y-1 mb-6">
                      <h3 className="text-xl font-semibold text-white">
                        {t("contact.formTitle")}
                      </h3>
                      <p className="text-xs sm:text-sm text-pink-200/75">
                        {t("contact.formSubtitle")}
                      </p>
                    </div>

                    {messageSent ? <div className="p-6 bg-[#140624]/85 border border-pink-300/20 rounded-xl text-center space-y-3">
                        <CheckCircle2
    className="w-10 h-10 text-pink-400 mx-auto"
    aria-hidden="true"
  />
                        <h4 className="text-base font-semibold text-white">
                          {t("contact.sentTitle")}
                        </h4>
                        <p className="text-sm text-pink-100/80">
                          {t("contact.sentBody", { storeName: settings.storeName })}
                        </p>
                        <button
    type="button"
    onClick={() => setMessageSent(false)}
    className="px-4 py-2 text-xs font-medium text-pink-100 bg-white/10 hover:bg-white/20 border border-pink-300/20 rounded-lg transition-colors"
  >
                          {t("contact.sendAnother")}
                        </button>
                      </div> : <form onSubmit={handleSendContactMessage} className="space-y-4">
                        {messageError && <div className="p-3 bg-red-950/60 border border-red-400/40 rounded-lg text-xs text-red-200">
                            {messageError}
                          </div>}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-medium text-pink-100/90 mb-1.5">
                              {t("contact.nameLabel")}
                            </label>
                            <input
    type="text"
    required
    maxLength={VALIDATION_LIMITS.MSG_NAME_MAX}
    value={senderName}
    onChange={(e) => setSenderName(e.target.value)}
    placeholder={t("contact.namePlaceholder")}
    className="w-full px-3.5 py-2.5 text-sm bg-[#120520]/90 border border-pink-300/25 text-white placeholder:text-pink-200/45 rounded-lg focus:outline-none focus:border-pink-400"
  />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-pink-100/90 mb-1.5">
                              {t("contact.contactLabel")}
                            </label>
                            <input
    type="text"
    required
    maxLength={VALIDATION_LIMITS.MSG_CONTACT_MAX}
    value={senderContact}
    onChange={(e) => setSenderContact(e.target.value)}
    placeholder={t("contact.contactPlaceholder")}
    className="w-full px-3.5 py-2.5 text-sm bg-[#120520]/90 border border-pink-300/25 text-white placeholder:text-pink-200/45 rounded-lg focus:outline-none focus:border-pink-400"
  />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-pink-100/90 mb-1.5">
                            {t("contact.subjectLabel")}
                          </label>
                          <input
    type="text"
    required
    maxLength={VALIDATION_LIMITS.MSG_SUBJECT_MAX}
    value={subject}
    onChange={(e) => setSubject(e.target.value)}
    placeholder={t("contact.subjectPlaceholder")}
    className="w-full px-3.5 py-2.5 text-sm bg-[#120520]/90 border border-pink-300/25 text-white placeholder:text-pink-200/45 rounded-lg focus:outline-none focus:border-pink-400"
  />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-pink-100/90 mb-1.5">
                            {t("contact.bodyLabel")}
                          </label>
                          <textarea
    required
    rows={4}
    maxLength={VALIDATION_LIMITS.MSG_BODY_MAX}
    value={body}
    onChange={(e) => setBody(e.target.value)}
    placeholder={t("contact.bodyPlaceholder")}
    className="w-full px-3.5 py-2.5 text-sm bg-[#120520]/90 border border-pink-300/25 text-white placeholder:text-pink-200/45 rounded-lg focus:outline-none focus:border-pink-400"
  />
                        </div>

                        <button
    type="submit"
    disabled={sendingMessage}
    className="w-full sm:w-auto px-7 py-3 text-sm font-semibold text-white bg-gradient-to-l from-pink-600 to-fuchsia-600 rounded-lg hover:from-pink-500 hover:to-fuchsia-500 disabled:opacity-60 transition-all min-h-[44px]"
  >
                          {sendingMessage ? t("contact.sending") : t("contact.sendBtn")}
                        </button>
                      </form>}
                  </div>
                </div>
              </div>
            </section>
          </>}
      </main>

      {
    /* Quiet Footer */
  }
      <footer className="border-t border-pink-300/15 bg-[#140624]/75 backdrop-blur-sm py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-pink-200/75">
          <p>
            {t("footer.rights", {
    year: (/* @__PURE__ */ new Date()).getFullYear(),
    storeName: settings.storeName
  })}
          </p>
          <div className="flex flex-wrap items-center gap-6">
            <button
    type="button"
    onClick={() => handleNavigateSection("catalog")}
    className="hover:text-white transition-colors"
  >
              {t("nav.products")}
            </button>
            <button
    type="button"
    onClick={() => setTrackerOpen(true)}
    className="hover:text-white transition-colors"
  >
              {t("nav.trackOrder")}
            </button>
            <button
    type="button"
    onClick={() => handleNavigateSection("contact")}
    className="hover:text-white transition-colors"
  >
              {t("nav.contact")}
            </button>
            {instagramHref && <a
    href={instagramHref}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-1.5 hover:text-white transition-colors"
  >
                <Instagram className="w-3.5 h-3.5" aria-hidden="true" />
                <span translate="no" dir="ltr">@{instagramHandle}</span>
              </a>}
            <button
    type="button"
    onClick={() => {
      setView("admin");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }}
    className="text-pink-300 font-medium hover:text-pink-200 hover:underline"
  >
              {t("nav.storeAdmin")}
            </button>
          </div>
        </div>
      </footer>

      {
    /* Modals & Drawers */
  }
      {selectedProduct && <ProductDetailModal
    product={selectedProduct}
    currency={settings.currency}
    whatsapp={settings.whatsapp}
    reviews={reviewsByProduct[selectedProduct.id] ?? []}
    ratingStats={ratingStatsByProduct[selectedProduct.id] ?? { average: 0, count: 0 }}
    onClose={handleCloseProductModal}
    onAddToCart={handleAddToCart}
  />}

      
      <OrderTrackerModal
    open={trackerOpen}
    currency={settings.currency}
    recentOrders={recentOrders}
    onClose={() => setTrackerOpen(false)}
  />

      <ScrollToTopButton
    raised={Boolean(cartNotice)}
    hidden={Boolean(selectedProduct || cartOpen || trackerOpen)}
  />
    </div>;
}
function App() {
  return 
      <TranslationProvider>
        <StorefrontApp />
      </TranslationProvider>;
}
export {
  App as default
};
