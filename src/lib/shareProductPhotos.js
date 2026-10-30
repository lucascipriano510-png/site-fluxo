const MIME_BY_EXTENSION = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jfif: "image/jpeg",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

const EXTENSION_BY_MIME = {
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/tiff": "tiff",
  "image/webp": "webp",
};

const getSourceUrl = (value) => {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return String(value.url || value.src || "").trim();
  }
  return "";
};

const safeFilenamePart = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

export function getProductPhotoSources(products = []) {
  const seen = new Set();
  const photos = [];
  const videoExtension = /\.(?:3gp|avi|m4v|mkv|mov|mp4|mpeg|mpg|webm)(?:[?#]|$)/i;

  for (const product of products || []) {
    const rawUrl = getSourceUrl(product?.image);
    if (!rawUrl || videoExtension.test(rawUrl) || seen.has(rawUrl)) continue;

    seen.add(rawUrl);
    photos.push({
      url: rawUrl,
      product,
      productPhotoNumber: 1,
      order: photos.length + 1,
    });
  }

  return photos;
}

function getImageMime(blob, url) {
  const responseMime = String(blob.type || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (responseMime.startsWith("image/")) {
    return responseMime === "image/jpg" ? "image/jpeg" : responseMime;
  }

  try {
    const extension = new URL(url, window.location.href).pathname.split(".").pop().toLowerCase();
    return MIME_BY_EXTENSION[extension] || "";
  } catch {
    return "";
  }
}

function getFileExtension(mime) {
  if (EXTENSION_BY_MIME[mime]) return EXTENSION_BY_MIME[mime];
  return mime.split("/")[1]?.replace(/[^a-z0-9]/g, "") || "img";
}

export async function prepareProductPhotoFiles(products, onProgress = () => {}) {
  const sources = getProductPhotoSources(products);
  if (!sources.length) throw new Error("Este álbum não tem fotos cadastradas para compartilhar.");

  const files = new Array(sources.length);
  const failures = [];
  let cursor = 0;
  let completed = 0;
  onProgress(0, sources.length);

  const worker = async () => {
    while (cursor < sources.length) {
      const index = cursor;
      cursor += 1;
      const source = sources[index];

      try {
        // Leitura apenas: o objeto original vira um File temporário em memória; nada é enviado ao Storage.
        const response = await fetch(new URL(source.url, window.location.href).href, {
          mode: "cors",
          credentials: "omit",
          cache: "default",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const blob = await response.blob();
        if (
          String(blob.type || "")
            .toLowerCase()
            .startsWith("video/")
        ) {
          files[index] = null;
          continue;
        }
        const mime = getImageMime(blob, source.url);
        if (!mime || !mime.startsWith("image/") || blob.size === 0) {
          throw new Error("O arquivo recebido não foi reconhecido como imagem.");
        }

        const sku = safeFilenamePart(source.product?.sku);
        const name = safeFilenamePart(source.product?.name);
        const baseName = [sku, name].filter(Boolean).join("-") || `produto-${source.order}`;
        const filename = `${baseName}-${source.productPhotoNumber}.${getFileExtension(mime)}`;
        files[index] = new File([blob], filename, { type: mime });
      } catch (error) {
        const productLabel = source.product?.sku || source.product?.name || `produto ${index + 1}`;
        failures.push(`${productLabel}: ${error?.message || "falha ao carregar a foto"}`);
      } finally {
        completed += 1;
        onProgress(completed, sources.length);
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(3, sources.length) }, () => worker()));

  if (failures.length) {
    const details = failures.slice(0, 2).join("; ");
    throw new Error(
      `Não consegui obter ${failures.length} foto(s) original(is). Verifique a conexão e o acesso público às imagens do Supabase. ${details}`,
    );
  }

  const imageFiles = files.filter(Boolean);
  if (!imageFiles.length) {
    throw new Error(
      "Este álbum não tem imagens principais disponíveis para compartilhar; vídeos foram ignorados.",
    );
  }
  return imageFiles;
}
