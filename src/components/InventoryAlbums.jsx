import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  ImagePlus,
  Loader2,
  Package,
  Search,
  Share2,
  Trash2,
} from "lucide-react";
import { optimizeImage } from "../lib/images";
import { getProductPhotoSources, prepareProductPhotoFiles } from "../lib/shareProductPhotos";

const normalizeLabel = (value) => String(value || "").trim();
const productStock = (product) => Number(product?.stock) || 0;
const sortLabels = (a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
const getSizeLabel = (entry) => {
  const value = entry && typeof entry === "object" ? entry.size : entry;
  return normalizeLabel(value).toLocaleUpperCase("pt-BR");
};
const productSizes = (product) =>
  Array.isArray(product?.sizes)
    ? [...new Set(product.sizes.map(getSizeLabel).filter(Boolean))]
    : [];
const stockForSize = (product, size) => {
  const entry = (Array.isArray(product?.sizes) ? product.sizes : []).find(
    (item) => getSizeLabel(item) === size,
  );
  return Number(entry && typeof entry === "object" ? entry.stock : 0) || 0;
};
const sortSizeLabels = (a, b) =>
  a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });

function AlbumCard({ title, count, cover, detail, onClick, isSubfolder = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative isolate overflow-hidden rounded-[28px] border border-white/25 bg-white/[0.11] p-2.5 text-left shadow-[0_20px_45px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-white/35 hover:bg-white/[0.15] hover:shadow-[0_28px_58px_rgba(0,0,0,0.38),0_0_26px_rgba(52,211,153,0.12)] active:scale-[0.99] motion-reduce:transition-none"
    >
      <span className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-br from-white/[0.10] via-transparent to-emerald-300/[0.04]" />
      <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-300/[0.12] blur-3xl" />
      <div className="relative aspect-[1.18/1] overflow-hidden rounded-[20px] border border-white/15 bg-zinc-950/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
        {cover ? (
          <img
            src={optimizeImage(cover, 460, 78)}
            loading="lazy"
            decoding="async"
            alt={`Capa: ${title}`}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-zinc-800 to-zinc-950">
            {isSubfolder ? (
              <FolderOpen size={36} className="text-emerald-400/70" />
            ) : (
              <Folder size={40} className="text-emerald-400/70" />
            )}
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-950/35 via-transparent to-white/[0.08]" />
        <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-zinc-950/35 px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.12em] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl">
          <Package size={10} className="text-emerald-200" />
          {isSubfolder ? "Subálbum" : "Álbum"}
        </div>
        <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      </div>
      <div className="relative flex items-center justify-between gap-2 px-1.5 pb-1 pt-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-wide text-white">
            {title}
          </p>
          <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-wide text-zinc-300">
            {detail || `${count} ${count === 1 ? "produto" : "produtos"}`}
          </p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] backdrop-blur-xl transition-all group-hover:border-emerald-200/40 group-hover:bg-emerald-200/15">
          <ChevronRight size={14} />
        </span>
      </div>
    </button>
  );
}

function ProductCard({ product, onEdit, onDelete, selectedSize }) {
  const usesSpecificSize = Boolean(selectedSize && !["__all__", "__none__"].includes(selectedSize));
  const stock = usesSpecificSize ? stockForSize(product, selectedSize) : productStock(product);
  const sizes = productSizes(product).length;

  return (
    <article className="overflow-hidden rounded-[24px] border border-white/10 bg-zinc-900 transition-colors hover:border-emerald-400/30">
      <button
        type="button"
        onClick={() => onEdit(product)}
        className="block w-full text-left"
        aria-label={`Editar ${product.name}; trocar imagem ou dados`}
      >
        <div className="relative aspect-square overflow-hidden bg-zinc-950">
          {product.image ? (
            <img
              src={optimizeImage(product.image, 420, 76)}
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-cover transition-transform duration-500 hover:scale-105 ${stock === 0 ? "grayscale opacity-60" : ""}`}
              alt={product.name || "Imagem do produto"}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-zinc-600">
              <ImagePlus size={30} />
            </div>
          )}
          <span
            className={`absolute right-2 top-2 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase backdrop-blur ${stock > 0 ? "border-emerald-400/30 bg-emerald-950/80 text-emerald-300" : "border-rose-400/30 bg-rose-950/80 text-rose-300"}`}
          >
            {stock} un.
          </span>
          {product.is_active === false && (
            <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-zinc-950/85 px-2.5 py-1 text-[8px] font-black uppercase text-zinc-300">
              Inativo
            </span>
          )}
        </div>
        <div className="space-y-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase leading-tight text-white">
              {product.name || "Produto sem nome"}
            </p>
            <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wide text-zinc-500">
              SKU {product.sku || "—"}
            </p>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2">
            <span className="truncate text-[8px] font-black uppercase tracking-wide text-emerald-400">
              {[product.category, product.subcategory].filter(Boolean).join(" · ") ||
                "Sem categoria"}
            </span>
            <span className="shrink-0 text-[8px] font-bold uppercase text-zinc-500">
              {sizes ? `${sizes} tam.` : "Estoque"}
            </span>
          </div>
        </div>
      </button>
      <div className="flex border-t border-white/5 bg-white/[0.025]">
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="flex flex-1 items-center justify-center gap-2 py-2.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 transition hover:bg-emerald-400/10 hover:text-emerald-300"
        >
          <ImagePlus size={12} /> Editar / fotos
        </button>
        <button
          type="button"
          onClick={() => onDelete?.(product)}
          aria-label={`Excluir ${product.name}`}
          title="Excluir produto"
          className="border-l border-white/5 px-3 text-zinc-600 transition hover:bg-rose-500/10 hover:text-rose-400"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}

export default function InventoryAlbums({ products = [], onEdit, onDelete, searchTerm = "" }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [shareFlow, setShareFlow] = useState({
    status: "idle",
    files: [],
    nextIndex: 0,
    batchSize: 0,
    albumKey: "",
    progress: 0,
    total: 0,
    message: "",
  });
  const isSearching = Boolean(searchTerm.trim());
  const query = searchTerm.trim().toLocaleLowerCase("pt-BR");

  const categories = useMemo(() => {
    const labels = new Set(
      (products || []).map((p) => normalizeLabel(p.category) || "Sem categoria"),
    );
    return [...labels].sort(sortLabels);
  }, [products]);

  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return (products || []).filter(
      (p) => (normalizeLabel(p.category) || "Sem categoria") === selectedCategory,
    );
  }, [products, selectedCategory]);

  const sizeLabels = useMemo(() => {
    const labels = new Set(categoryProducts.flatMap(productSizes));
    return [...labels].sort(sortSizeLabels);
  }, [categoryProducts]);

  const sizeSummary = useMemo(() => {
    const groups = sizeLabels.map((size) => {
      const items = categoryProducts.filter((product) => productSizes(product).includes(size));
      return {
        size,
        items,
        count: items.length,
        stock: items.reduce((sum, product) => sum + stockForSize(product, size), 0),
        cover: items.find((product) => product.image)?.image || "",
      };
    });
    const itemsWithoutSize = categoryProducts.filter(
      (product) => productSizes(product).length === 0,
    );
    if (itemsWithoutSize.length) {
      groups.push({
        size: "__none__",
        items: itemsWithoutSize,
        count: itemsWithoutSize.length,
        stock: itemsWithoutSize.reduce((sum, product) => sum + productStock(product), 0),
        cover: itemsWithoutSize.find((product) => product.image)?.image || "",
      });
    }
    return groups;
  }, [sizeLabels, categoryProducts]);

  const sizeProducts = useMemo(() => {
    if (!selectedCategory || selectedSize === null) return [];
    if (selectedSize === "__all__") return categoryProducts;
    if (selectedSize === "__none__") {
      return categoryProducts.filter((product) => productSizes(product).length === 0);
    }
    return categoryProducts.filter((product) => productSizes(product).includes(selectedSize));
  }, [selectedCategory, selectedSize, categoryProducts]);

  const subcategories = useMemo(() => {
    const labels = new Set(sizeProducts.map((p) => normalizeLabel(p.subcategory)).filter(Boolean));
    return [...labels].sort(sortLabels);
  }, [sizeProducts]);

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return (products || []).filter((p) =>
      [p.name, p.sku, p.category, p.subcategory, ...productSizes(p)].some((value) =>
        String(value || "")
          .toLocaleLowerCase("pt-BR")
          .includes(query),
      ),
    );
  }, [products, isSearching, query]);

  const categorySummary = useMemo(
    () =>
      categories.map((category) => {
        const items = (products || []).filter(
          (p) => (normalizeLabel(p.category) || "Sem categoria") === category,
        );
        return {
          category,
          items,
          count: items.length,
          cover: items.find((p) => p.image)?.image || "",
        };
      }),
    [categories, products],
  );

  const subcategorySummary = useMemo(
    () =>
      subcategories.map((subcategory) => {
        const items = sizeProducts.filter((p) => normalizeLabel(p.subcategory) === subcategory);
        return {
          subcategory,
          items,
          count: items.length,
          cover: items.find((p) => p.image)?.image || "",
        };
      }),
    [subcategories, sizeProducts],
  );

  const productsWithoutSubcategory = sizeProducts.filter((p) => !normalizeLabel(p.subcategory));
  const visibleProducts = isSearching
    ? searchResults
    : !selectedCategory || selectedSize === null
      ? []
      : selectedSubcategory === "__all__"
        ? sizeProducts
        : selectedSubcategory === "__none__"
          ? productsWithoutSubcategory
          : selectedSubcategory
            ? sizeProducts.filter((p) => normalizeLabel(p.subcategory) === selectedSubcategory)
            : subcategories.length === 0
              ? sizeProducts
              : [];

  const shareProducts = isSearching
    ? searchResults
    : !selectedCategory
      ? []
      : selectedSize === null
        ? categoryProducts
        : selectedSubcategory === "__none__"
          ? productsWithoutSubcategory
          : selectedSubcategory && selectedSubcategory !== "__all__"
            ? visibleProducts
            : sizeProducts;
  const sharePhotoSources = useMemo(() => getProductPhotoSources(shareProducts), [shareProducts]);
  const currentAlbumKey = JSON.stringify([
    searchTerm.trim(),
    selectedCategory,
    selectedSize,
    selectedSubcategory,
  ]);

  useEffect(() => {
    setShareFlow({
      status: "idle",
      files: [],
      nextIndex: 0,
      batchSize: 0,
      albumKey: currentAlbumKey,
      progress: 0,
      total: 0,
      message: "",
    });
  }, [currentAlbumKey]);

  const shareFlowMatchesAlbum = shareFlow.albumKey === currentAlbumKey;
  const preparedFiles = shareFlowMatchesAlbum ? shareFlow.files : [];
  const canContinueShare = preparedFiles.length > 0 && shareFlow.status === "ready";

  const totalStock = (items, size = null) =>
    items.reduce(
      (sum, product) =>
        sum +
        (size && !["__all__", "__none__"].includes(size)
          ? stockForSize(product, size)
          : productStock(product)),
      0,
    );

  const goToCategory = (category) => {
    setSelectedCategory(category);
    setSelectedSize(null);
    setSelectedSubcategory(null);
  };
  const goToSize = (size) => {
    setSelectedSize(size);
    setSelectedSubcategory(null);
  };

  const findLargestShareableBatch = (files) => {
    if (typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return 0;
    for (let count = files.length; count > 0; count -= 1) {
      try {
        if (navigator.canShare({ files: files.slice(0, count) })) return count;
      } catch {
        // Continue procurando o maior lote aceito pelo navegador.
      }
    }
    return 0;
  };

  const sendPreparedBatch = async (flow) => {
    const batch = flow.files.slice(flow.nextIndex, flow.nextIndex + flow.batchSize);
    if (!batch.length) return;

    try {
      // Chamada direta no evento de toque: o Web Share exige ativação recente do usuário.
      const shareRequest = navigator.share({ files: batch });
      setShareFlow({ ...flow, status: "sending", message: "Abrindo o compartilhamento nativo…" });
      await shareRequest;

      const nextIndex = flow.nextIndex + batch.length;
      if (nextIndex < flow.files.length) {
        setShareFlow({
          ...flow,
          status: "ready",
          nextIndex,
          message: `Lote preparado (${nextIndex} de ${flow.files.length} fotos). Escolha WhatsApp e, ao voltar, toque para enviar o próximo lote.`,
        });
      } else {
        setShareFlow({
          ...flow,
          status: "done",
          files: [],
          nextIndex: 0,
          batchSize: 0,
          message: `A folha nativa foi aberta com ${flow.files.length} foto(s). Escolha WhatsApp, o contato e conclua o envio.`,
        });
      }
    } catch (error) {
      const message =
        error?.name === "AbortError"
          ? "Compartilhamento cancelado. As fotos continuam prontas; toque para tentar novamente."
          : error?.name === "NotAllowedError"
            ? "As fotos estão prontas. Toque novamente para abrir a folha nativa do iPhone."
            : "O Safari não abriu o compartilhamento. Toque novamente para tentar ou baixe as fotos originais abaixo.";
      setShareFlow({ ...flow, status: "ready", message });
    }
  };

  const prepareAndShare = async () => {
    const albumKey = currentAlbumKey;
    setShareFlow({
      status: "preparing",
      files: [],
      nextIndex: 0,
      batchSize: 0,
      albumKey,
      progress: 0,
      total: sharePhotoSources.length,
      message: `Preparando ${sharePhotoSources.length} foto(s) original(is)…`,
    });

    try {
      const files = await prepareProductPhotoFiles(shareProducts, (progress, total) => {
        setShareFlow((current) =>
          current.albumKey === albumKey
            ? {
                ...current,
                progress,
                total,
                message: `Preparando fotos originais: ${progress} de ${total}…`,
              }
            : current,
        );
      });

      const batchSize = findLargestShareableBatch(files);
      if (!batchSize) {
        setShareFlow({
          status: "unsupported",
          files,
          nextIndex: 0,
          batchSize: 0,
          albumKey,
          progress: files.length,
          total: files.length,
          message:
            "Este navegador não permite anexar fotos pela folha nativa. Você ainda pode baixar as imagens originais e anexá-las manualmente no WhatsApp.",
        });
        return;
      }

      const flow = {
        status: "ready",
        files,
        nextIndex: 0,
        batchSize,
        albumKey,
        progress: files.length,
        total: files.length,
        message:
          batchSize < files.length
            ? `O navegador aceita ${batchSize} foto(s) por envio; o álbum será compartilhado em lotes.`
            : "Fotos originais prontas para compartilhar.",
      };
      setShareFlow(flow);
      await sendPreparedBatch(flow);
    } catch (error) {
      setShareFlow({
        status: "error",
        files: [],
        nextIndex: 0,
        batchSize: 0,
        albumKey,
        progress: 0,
        total: sharePhotoSources.length,
        message:
          error?.message ||
          "Não foi possível preparar as fotos originais. Nenhuma imagem foi enviada.",
      });
    }
  };

  const handleShareClick = () => {
    if (shareFlowMatchesAlbum && canContinueShare) {
      void sendPreparedBatch(shareFlow);
      return;
    }
    if (shareFlow.status === "preparing" || shareFlow.status === "sending") return;
    void prepareAndShare();
  };

  const downloadPreparedPhotos = async (files) => {
    for (const [index, file] of files.entries()) {
      const objectUrl = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      if (index < files.length - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 250));
      }
    }
    setShareFlow((current) => ({
      ...current,
      message:
        "Fotos baixadas no dispositivo. Abra a conversa no WhatsApp e anexe as imagens salvas; nenhum link foi enviado.",
    }));
  };

  const sizeTitle =
    selectedSize === "__all__"
      ? "Todos os tamanhos"
      : selectedSize === "__none__"
        ? "Sem tamanho"
        : selectedSize
          ? `Tamanho ${selectedSize}`
          : "";
  const heading = isSearching
    ? `Resultados da busca (${searchResults.length})`
    : !selectedCategory
      ? "Categorias do estoque"
      : selectedSize === null
        ? `Tamanhos de ${selectedCategory}`
        : selectedSubcategory === "__all__"
          ? `${sizeTitle} · Produtos`
          : selectedSubcategory === "__none__"
            ? `${sizeTitle} · Sem subcategoria`
            : selectedSubcategory
              ? `${sizeTitle} · ${selectedSubcategory}`
              : sizeTitle;
  const seeAllLabel = selectedSize === null ? "Ver todos da categoria" : "Ver todos deste tamanho";
  const canSeeAll =
    !isSearching &&
    selectedCategory &&
    (selectedSize === null || (selectedSubcategory === null && subcategories.length > 0));
  const seeAll = () => {
    if (selectedSize === null) {
      setSelectedSize("__all__");
      setSelectedSubcategory("__all__");
    } else {
      setSelectedSubcategory("__all__");
    }
  };

  return (
    <section
      className="relative isolate space-y-5"
      aria-label="Estoque organizado por categorias, tamanhos e subcategorias"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 18% 12%, rgba(16, 185, 129, 0.3), transparent 48%), radial-gradient(ellipse at 88% 42%, rgba(34, 211, 238, 0.26), transparent 50%), radial-gradient(ellipse at 45% 85%, rgba(139, 92, 246, 0.2), transparent 50%)",
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-emerald-400">
            Biblioteca de produtos
          </p>
          <h4 className="mt-1 text-lg font-black uppercase tracking-tight text-white">{heading}</h4>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
            {isSearching
              ? `${searchResults.length} encontrados`
              : selectedSize !== null
                ? `${sizeProducts.length} produtos · ${totalStock(sizeProducts, selectedSize)} unidades`
                : selectedCategory
                  ? `${categoryProducts.length} produtos · ${totalStock(categoryProducts)} unidades`
                  : `${products.length} produtos em ${categories.length} categorias`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {canSeeAll && (
            <button
              type="button"
              onClick={seeAll}
              className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-400/15"
            >
              {seeAllLabel}
            </button>
          )}
          {sharePhotoSources.length > 0 && (
            <button
              type="button"
              onClick={handleShareClick}
              disabled={
                shareFlow.status === "preparing" ||
                shareFlow.status === "sending" ||
                shareFlow.status === "unsupported"
              }
              aria-busy={shareFlow.status === "preparing" || shareFlow.status === "sending"}
              className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-200 transition hover:bg-emerald-500/25 disabled:cursor-wait disabled:opacity-60"
            >
              {shareFlow.status === "preparing" || shareFlow.status === "sending" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Share2 size={13} />
              )}
              {shareFlow.status === "preparing"
                ? `Preparando ${shareFlow.progress}/${shareFlow.total}`
                : shareFlow.status === "sending"
                  ? "Abrindo…"
                  : canContinueShare
                    ? `Continuar · ${Math.min(shareFlow.batchSize, preparedFiles.length - shareFlow.nextIndex)} fotos`
                    : `Compartilhar ${sharePhotoSources.length} fotos`}
            </button>
          )}
        </div>
      </div>

      {sharePhotoSources.length > 0 && (
        <div className="-mt-3 space-y-2 text-right">
          <p className="text-[9px] font-semibold text-zinc-500">
            No menu nativo, escolha WhatsApp e o contato. As fotos vão como anexos, sem links.
          </p>
          {shareFlowMatchesAlbum && shareFlow.message && shareFlow.status !== "idle" && (
            <div
              role="status"
              className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-2 text-left text-[10px] font-medium text-zinc-300"
            >
              <span className="min-w-0 flex-1">{shareFlow.message}</span>
              {preparedFiles.length > 0 && shareFlow.status !== "sending" && (
                <button
                  type="button"
                  onClick={() => void downloadPreparedPhotos(preparedFiles)}
                  className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1.5 text-[9px] font-black uppercase text-zinc-200 hover:bg-white/5"
                >
                  Baixar fotos originais
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {!isSearching && selectedCategory && (
        <nav
          className="flex items-center gap-2 overflow-x-auto text-[9px] font-black uppercase tracking-widest"
          aria-label="Caminho da categoria"
        >
          <button
            type="button"
            onClick={() => {
              setSelectedCategory(null);
              setSelectedSize(null);
              setSelectedSubcategory(null);
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-zinc-900 px-3 py-2 text-zinc-400 hover:text-white"
          >
            <ArrowLeft size={12} /> Categorias
          </button>
          <ChevronRight size={12} className="shrink-0 text-zinc-600" />
          <button
            type="button"
            onClick={() => {
              setSelectedSize(null);
              setSelectedSubcategory(null);
            }}
            className={`shrink-0 ${selectedSize !== null ? "text-zinc-400 hover:text-white" : "text-emerald-300"}`}
          >
            {selectedCategory}
          </button>
          {selectedSize !== null && (
            <>
              <ChevronRight size={12} className="shrink-0 text-zinc-600" />
              <button
                type="button"
                onClick={() => setSelectedSubcategory(null)}
                className={`shrink-0 ${selectedSubcategory ? "text-zinc-400 hover:text-white" : "text-emerald-300"}`}
              >
                {sizeTitle}
              </button>
            </>
          )}
          {selectedSubcategory && selectedSubcategory !== "__all__" && (
            <>
              <ChevronRight size={12} className="shrink-0 text-zinc-600" />
              <span className="shrink-0 text-emerald-300">
                {selectedSubcategory === "__none__" ? "Sem subcategoria" : selectedSubcategory}
              </span>
            </>
          )}
        </nav>
      )}

      {!isSearching && !selectedCategory && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categorySummary.map(({ category, items, count, cover }) => (
              <AlbumCard
                key={category}
                title={category}
                count={count}
                cover={cover}
                detail={`${count} ${count === 1 ? "produto" : "produtos"} · ${totalStock(items)} un.`}
                onClick={() => goToCategory(category)}
              />
            ))}
          </div>
          {categories.length === 0 && <EmptyState message="Nenhum produto cadastrado ainda." />}
        </>
      )}

      {!isSearching && selectedCategory && selectedSize === null && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {sizeSummary.map(({ size, items, count, stock, cover }) => (
              <AlbumCard
                key={size}
                title={size === "__none__" ? "Sem tamanho" : `Tamanho ${size}`}
                count={count}
                cover={cover}
                detail={`${count} ${count === 1 ? "produto" : "produtos"} · ${stock} un.`}
                isSubfolder
                onClick={() => goToSize(size)}
              />
            ))}
          </div>
          {sizeSummary.length === 0 && (
            <EmptyState message="Esta categoria ainda não tem produtos." />
          )}
        </>
      )}

      {!isSearching &&
        selectedCategory &&
        selectedSize !== null &&
        !selectedSubcategory &&
        subcategories.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {subcategorySummary.map(({ subcategory, items, count, cover }) => (
                <AlbumCard
                  key={subcategory}
                  title={subcategory}
                  count={count}
                  cover={cover}
                  detail={`${count} ${count === 1 ? "produto" : "produtos"} · ${totalStock(items, selectedSize)} un.`}
                  isSubfolder
                  onClick={() => setSelectedSubcategory(subcategory)}
                />
              ))}
              {productsWithoutSubcategory.length > 0 && (
                <AlbumCard
                  title="Sem subcategoria"
                  count={productsWithoutSubcategory.length}
                  cover={productsWithoutSubcategory.find((p) => p.image)?.image || ""}
                  detail={`${productsWithoutSubcategory.length} produtos · ${totalStock(productsWithoutSubcategory, selectedSize)} un.`}
                  isSubfolder
                  onClick={() => setSelectedSubcategory("__none__")}
                />
              )}
            </div>
            <div className="rounded-2xl border border-white/5 bg-zinc-900/60 px-4 py-3 text-[9px] font-bold uppercase tracking-wide text-zinc-500">
              Organização: categoria <span className="text-zinc-300">Calça</span> → tamanho{" "}
              <span className="text-zinc-300">M</span> → subcategoria{" "}
              <span className="text-zinc-300">Jogador</span>. A vitrine continua usando a
              classificação já cadastrada.
            </div>
          </>
        )}

      {visibleProducts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={onEdit}
              onDelete={onDelete}
              selectedSize={isSearching ? null : selectedSize}
            />
          ))}
        </div>
      )}

      {(isSearching ||
        (selectedCategory &&
          selectedSize !== null &&
          (selectedSubcategory || subcategories.length === 0))) &&
        visibleProducts.length === 0 && (
          <EmptyState
            message={
              isSearching
                ? "Nenhum produto encontrado. Tente outro nome, SKU, tamanho ou categoria."
                : "Esta pasta ainda não tem produtos."
            }
          />
        )}

      {isSearching && searchResults.length > 0 && (
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wide text-zinc-600">
          <Search size={12} /> Busca inclui nome, SKU, categoria, tamanho e subcategoria
        </div>
      )}
    </section>
  );
}

function EmptyState({ message }) {
  return (
    <div className="grid min-h-40 place-items-center rounded-[26px] border border-dashed border-white/10 bg-zinc-900/40 px-6 text-center">
      <div>
        <Package size={24} className="mx-auto mb-2 text-zinc-600" />
        <p className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">{message}</p>
      </div>
    </div>
  );
}
