import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Folder,
  FolderOpen,
  ImagePlus,
  Package,
  Search,
  Trash2,
} from "lucide-react";
import { optimizeImage } from "../lib/images";

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
      className="group overflow-hidden rounded-[26px] border border-white/10 bg-zinc-900 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-400/40 hover:shadow-[0_14px_40px_rgba(0,0,0,0.28)] active:scale-[0.98]"
    >
      <div className="relative aspect-[1.18/1] overflow-hidden bg-zinc-950">
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
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950 via-zinc-950/45 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black uppercase tracking-wide text-white drop-shadow">
              {title}
            </p>
            <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-zinc-300">
              {detail || `${count} ${count === 1 ? "produto" : "produtos"}`}
            </p>
          </div>
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/15 bg-black/40 text-white">
            <ChevronRight size={14} />
          </span>
        </div>
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
      className="space-y-5"
      aria-label="Estoque organizado por categorias, tamanhos e subcategorias"
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
        {canSeeAll && (
          <button
            type="button"
            onClick={seeAll}
            className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-[9px] font-black uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-400/15"
          >
            {seeAllLabel}
          </button>
        )}
      </div>

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
