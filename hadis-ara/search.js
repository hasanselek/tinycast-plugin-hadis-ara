"use strict";
// "Hadis Ara": el-Minassatü'l-hadîsiyye'de arar; seçili hadis yan panelde, İSNAD 2 atıfları eylemlerde.
const React = require("react");
const {
  List, Detail, ActionPanel, Action, Icon, Clipboard, showToast, Toast, useNavigation,
} = require("@raycast/api");
const m = require("./assets/minassa.js");
const recent = require("./assets/recent.js");

const h = React.createElement;
const positions = new Map(); // hadith_id -> pos | Promise
const searches = new Map(); // anahtar -> { total, hits }

function loadPosition(x) {
  const cached = positions.get(x.hadith_id);
  if (cached) return Promise.resolve(cached);
  const p = m.position(x).then(
    (pos) => {
      positions.set(x.hadith_id, pos || { n: null, kind: "sayfa" });
      return positions.get(x.hadith_id);
    },
    (e) => {
      positions.delete(x.hadith_id);
      throw e;
    },
  );
  positions.set(x.hadith_id, p);
  return p;
}

function loadedPosition(x) {
  const p = positions.get(x.hadith_id);
  return p && !(p instanceof Promise) ? p : null;
}

async function copy(value, label) {
  if (!value) {
    await showToast({ style: Toast.Style.Failure, title: `${label} için bilgi yok` });
    return;
  }
  await Clipboard.copy(value);
  await showToast({ style: Toast.Style.Success, title: `${label} kopyalandı`, message: value.length > 90 ? value.slice(0, 90) + "…" : value });
}

async function copyCitation(x, key, label) {
  try {
    const pos = loadedPosition(x) || (await loadPosition(x));
    const c = m.citations(x, pos);
    await copy(c && c[key], label);
    if (pos && pos.reason) await showToast({ style: Toast.Style.Failure, title: `${label} kopyalandı — bâb no. yok`, message: pos.reason });
  } catch (e) {
    await showToast({ style: Toast.Style.Failure, title: "Bâb numarası hesaplanamadı", message: String((e && e.message) || e) });
  }
}

function bookName(arabic) {
  const b = m.BOOKS[arabic];
  return b ? b.short : arabic;
}

function hadithActions({ x, primary, query, book, setBook, extra }) {
  const p = m.parts(x.html || x.hadith);
  const strip = (s) => s.replace(/[\u0001\u0002]/g, "");
  return h(
    ActionPanel,
    null,
    h(
      ActionPanel.Section,
      null,
      primary,
      h(Action, {
        title: "Diğer Rivayetleri Göster",
        icon: Icon.List,
        shortcut: { modifiers: ["cmd"], key: "r" },
        onAction: () => extra && extra.showNarrations(x),
      }),
      h(Action.OpenInBrowser, { title: "Sitede Ara", url: m.searchUrl(query || strip(p.matn).split(" ").slice(0, 8).join(" ")), shortcut: { modifiers: ["cmd"], key: "return" } }),
    ),
    h(
      ActionPanel.Section,
      { title: "Atıf (İSNAD 2)" },
      h(Action, { title: "Dipnot Atfını Kopyala (İlk Atıf)", icon: Icon.QuoteBlock, shortcut: { modifiers: ["cmd", "shift"], key: "a" }, onAction: () => copyCitation(x, "footnote", "Dipnot atfı") }),
      h(Action, { title: "Kısa Dipnot Atfını Kopyala", icon: Icon.QuoteBlock, shortcut: { modifiers: ["cmd", "shift", "opt"], key: "a" }, onAction: () => copyCitation(x, "shortFootnote", "Kısa dipnot") }),
      h(Action, { title: "Kaynakça Girdisini Kopyala", icon: Icon.Book, shortcut: { modifiers: ["cmd", "shift"], key: "k" }, onAction: () => copyCitation(x, "bibliography", "Kaynakça girdisi") }),
    ),
    h(
      ActionPanel.Section,
      { title: "Kopyala" },
      h(Action, { title: "Hadisi Kopyala (Senet + Metin)", icon: Icon.Text, shortcut: { modifiers: ["cmd", "opt"], key: "c" }, onAction: () => copy(m.plain(x.html || x.hadith), "Hadis") }),
      h(Action, { title: "Yalnız Metni Kopyala", icon: Icon.Text, shortcut: { modifiers: ["cmd", "shift"], key: "m" }, onAction: () => copy(strip(p.matn), "Metin") }),
    ),
    setBook
      ? h(
          ActionPanel.Section,
          { title: "Süz" },
          h(
            ActionPanel.Submenu,
            { title: "Kitapla Sınırla…", icon: Icon.Filter, shortcut: { modifiers: ["cmd"], key: "f" } },
            m.BOOK_LIST.map((b) => h(Action, { key: b.arabic, title: `${b.short} — ${b.title}`, onAction: () => setBook(b.arabic) })),
          ),
          book ? h(Action, { title: "Kitap Sınırını Kaldır", icon: Icon.XMarkCircle, shortcut: { modifiers: ["cmd", "shift"], key: "f" }, onAction: () => setBook("") }) : null,
        )
      : null,
  );
}

function markdownFor(x) {
  const pos = loadedPosition(x);
  const c = m.citations(x, pos);
  return m.hadithMarkdown(x, pos, c);
}

// Tam ekran okuma (↵ ya da çift tıklama).
function Reader({ x, extra }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    if (!loadedPosition(x)) loadPosition(x).then(() => setTick((t) => t + 1), () => setTick((t) => t + 1));
  }, [x.hadith_id]);
  return h(Detail, {
    navigationTitle: `${bookName(x.book_name)} ${m.numbers(x)}`,
    markdown: markdownFor(x),
    actions: hadithActions({ x, primary: null, extra }),
  });
}

// Ortak sonuç listesi: arama ekranı ve "diğer rivayetler" ekranı bunu kullanır.
function Results({ hits, total, searching, query, book, setBook, onSearchTextChange, searchBarAccessory, emptyView, more, navigationTitle, sectionTitle, extraSection }) {
  const { push } = useNavigation();
  const [selected, setSelected] = React.useState(null);
  const [, setTick] = React.useState(0);
  const selectedRef = React.useRef(null);
  const selectedAt = React.useRef(0);

  const extra = {
    showNarrations: (x) => push(h(Narrations, { x })),
  };

  const current = hits.find((r) => r.id === selected) || hits[0] || null;

  // Bâb numarasını seçilen hadis için, kısa bir beklemeden sonra hesapla.
  React.useEffect(() => {
    if (!current || loadedPosition(current)) return;
    let alive = true;
    const timer = setTimeout(() => {
      loadPosition(current).then(
        () => alive && setTick((t) => t + 1),
        () => alive && setTick((t) => t + 1),
      );
    }, 150);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [current && current.id]);

  // Tinycast her tıklamada satırın ilk eylemini çalıştırır; seçili olmayan satıra gelen ilk tıklama
  // yalnız seçer, tam ekran için çift tıklama ya da ↵ gerekir.
  const guard = (id) => {
    if (selectedRef.current !== id) {
      selectedRef.current = id;
      selectedAt.current = Date.now();
      setSelected(id);
      return false;
    }
    return Date.now() - selectedAt.current > 60;
  };

  const rows = hits.map((x) => {
    const isSel = current && x.id === current.id;
    const pos = loadedPosition(x);
    const no = m.numbers(x);
    const kitab = m.kitabName(x.chapter);
    const where = pos && pos.n ? `“${kitab}”, ${pos.n}` : `“${kitab}”`;
    return h(List.Item, {
      key: x.id,
      id: x.id,
      title: `${bookName(x.book_name)}${no ? " " + no : ""}`,
      subtitle: m.snippet(x.html, 90),
      icon: Icon.Book,
      keywords: [x.book_name],
      accessories: isSel ? [] : [{ text: where }],
      detail: h(List.Item.Detail, { markdown: isSel ? markdownFor(x) : "" }),
      actions: hadithActions({
        x,
        query,
        book,
        setBook,
        extra,
        primary: h(Action, {
          title: "Tam Ekranda Oku",
          icon: Icon.Eye,
          onAction: () => {
            if (guard(x.id)) push(h(Reader, { x, extra }));
          },
        }),
      }),
    });
  });

  if (more) {
    rows.push(
      h(List.Item, {
        key: "__more",
        id: "__more",
        title: `Daha fazla göster (${hits.length} / ${total})`,
        icon: Icon.Plus,
        detail: h(List.Item.Detail, { markdown: `Toplam **${total}** sonuçtan **${hits.length}** tanesi gösteriliyor.\n\nSonraki sonuçları yüklemek için ↵ ya da çift tıklayın.` }),
        actions: h(ActionPanel, null, h(Action, { title: "Daha Fazla Yükle", icon: Icon.Plus, onAction: () => guard("__more") && more() })),
      }),
    );
  }

  const title = total ? `${sectionTitle ? sectionTitle + " — " : ""}${total} hadis${book ? " — " + bookName(book) : ""}` : sectionTitle;

  return h(
    List,
    {
      isLoading: searching,
      isShowingDetail: hits.length > 0,
      filtering: false,
      throttle: true,
      navigationTitle,
      searchBarPlaceholder: onSearchTextChange ? "Hadis metninde ara (Arapça; harekesiz olur, tam ifade için \"…\")" : undefined,
      onSearchTextChange,
      searchBarAccessory,
      onSelectionChange: (id) => {
        if (selectedRef.current !== (id || null)) selectedAt.current = Date.now();
        selectedRef.current = id || null;
        setSelected(id || null);
      },
    },
    emptyView,
    h(List.Section, { title }, ...rows),
    extraSection || null,
  );
}

function useSearch(query, mode, book) {
  const [state, setState] = React.useState({ hits: [], total: 0, searching: false });
  const key = `${mode}|${book}|${query.trim()}`;

  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ hits: [], total: 0, searching: false });
      return;
    }
    if (searches.has(key)) {
      setState({ ...searches.get(key), searching: false });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, searching: true }));
    m.search(q, { mode, book }).then(
      (r) => {
        searches.set(key, r);
        if (alive) setState({ ...r, searching: false });
      },
      (e) => {
        if (!alive) return;
        setState((s) => ({ ...s, searching: false }));
        showToast({ style: Toast.Style.Failure, title: "Arama yapılamadı", message: String((e && e.message) || e) });
      },
    );
    return () => {
      alive = false;
    };
  }, [key]);

  const more = async () => {
    const q = query.trim();
    setState((s) => ({ ...s, searching: true }));
    try {
      const r = await m.search(q, { mode, book, from: state.hits.length });
      const merged = { total: r.total, hits: [...state.hits, ...r.hits.filter((x) => !state.hits.some((y) => y.id === x.id))] };
      searches.set(key, merged);
      setState({ ...merged, searching: false });
    } catch (e) {
      setState((s) => ({ ...s, searching: false }));
      showToast({ style: Toast.Style.Failure, title: "Yüklenemedi", message: String((e && e.message) || e) });
    }
  };

  return { ...state, more: state.hits.length < state.total ? more : null };
}

function Narrations({ x }) {
  const [state, setState] = React.useState({ hits: [], total: 0, searching: true });
  React.useEffect(() => {
    m.narrations(x).then(
      (r) => setState({ ...r, searching: false }),
      (e) => {
        setState({ hits: [], total: 0, searching: false });
        showToast({ style: Toast.Style.Failure, title: "Rivayetler yüklenemedi", message: String((e && e.message) || e) });
      },
    );
  }, [x.hadith_id]);
  return h(Results, {
    ...state,
    navigationTitle: `${bookName(x.book_name)} ${m.numbers(x)} — diğer rivayetler`,
    emptyView: h(List.EmptyView, { icon: Icon.List, title: state.searching ? "Yükleniyor…" : "Başka rivayet bulunamadı" }),
  });
}

const MODES = { ifade: "İfade", tam: "Tam ifade", kelime: "Tüm kelimeler" };

// Arama çubuğu boşken önceki aramalar (en sonuncusu zaten listede gösteriliyor).
function historySection(entries, pick, clear) {
  if (!entries.length) return null;
  return h(
    List.Section,
    { title: "Önceki aramalar" },
    ...entries.map((e) =>
      h(List.Item, {
        key: "__h" + e.q,
        id: "__h" + e.q,
        title: e.q,
        subtitle: [MODES[e.mode], e.book ? bookName(e.book) : ""].filter(Boolean).join(" · "),
        icon: Icon.Clock,
        detail: h(List.Item.Detail, { markdown: `**${e.q}**\n\n↵ ile bu aramayı yeniden göster.` }),
        actions: h(
          ActionPanel,
          null,
          h(Action, { title: "Bu Aramayı Göster", icon: Icon.MagnifyingGlass, onAction: () => pick(e) }),
          h(Action, { title: "Arama Geçmişini Temizle", icon: Icon.Trash, style: Action.Style.Destructive, onAction: clear }),
        ),
      }),
    ),
  );
}

function Command() {
  const [initial] = React.useState(() => recent.list()[0] || null);
  const [query, setQuery] = React.useState("");
  const [recall, setRecall] = React.useState(initial);
  const [mode, setMode] = React.useState((initial && initial.mode) || "ifade");
  const [book, setBook] = React.useState((initial && initial.book) || "");
  const [, setTick] = React.useState(0);
  const typed = query.trim();

  // Çubuk boşalınca en son kaydedilen aramaya dön.
  React.useEffect(() => {
    if (!typed) setRecall(recent.list()[0] || null);
  }, [typed]);

  const shown = typed || (recall ? recall.q : "");
  const s = useSearch(shown, mode, book);
  recent.useRemember({ q: typed, mode, book }, !!typed && !s.searching && s.total > 0);

  const pick = (e) => {
    recent.remember(e);
    setRecall(e);
    setMode(e.mode || "ifade");
    setBook(e.book || "");
  };
  const clearHistory = () => {
    recent.clear();
    setRecall(null);
    setTick((t) => t + 1);
    showToast({ style: Toast.Style.Success, title: "Arama geçmişi temizlendi" });
  };
  const others = !typed ? recent.list().filter((e) => !recall || e.q !== recall.q) : [];

  return h(Results, {
    ...s,
    query: shown,
    book,
    setBook,
    onSearchTextChange: setQuery,
    sectionTitle: !typed && recall ? `Son arama: ${recall.q}` : undefined,
    extraSection: historySection(others, pick, clearHistory),
    searchBarAccessory: h(
      List.Dropdown,
      { tooltip: "Arama türü", value: mode, onChange: setMode },
      h(List.Dropdown.Item, { title: "İfade (varyantlarla)", value: "ifade" }),
      h(List.Dropdown.Item, { title: "Tam ifade", value: "tam" }),
      h(List.Dropdown.Item, { title: "Tüm kelimeler", value: "kelime" }),
    ),
    emptyView: h(List.EmptyView, {
      icon: Icon.Book,
      title: shown ? (s.searching ? "Aranıyor…" : "Sonuç bulunamadı") : "Hadis arayın",
      description: shown
        ? book
          ? `${bookName(book)} ile sınırlı. Sınırı kaldırmak için ⇧⌘F.`
          : undefined
        : "Kütüb-i Sitte, Müsned, Müstedrek, İbn Hibbân, İbn Huzeyme, Dârimî ve Muvatta'da arar. Arapça yazın; hareke gerekmez.",
    }),
  });
}

module.exports = { default: Command };
