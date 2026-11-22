const money = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const dateBR = (value) =>
  value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(value)) : "—";

export function drawCard(reward) {
  if (typeof document === "undefined") throw new Error("Canvas do cartão requer um navegador.");
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1620;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D indisponível neste navegador.");

  const bg = ctx.createLinearGradient(0, 0, 1080, 1620);
  bg.addColorStop(0, "#0a0a0a");
  bg.addColorStop(0.55, "#171717");
  bg.addColorStop(1, "#080808");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1620);

  const rounded = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  rounded(30, 30, 1020, 1560, 42);
  ctx.strokeStyle = "rgba(198,164,99,.72)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#c6a463";
  ctx.fillRect(86, 120, 76, 4);
  ctx.fillStyle = "#f5f5f4";
  ctx.font = "600 34px Arial, sans-serif";
  ctx.letterSpacing = "5px";
  ctx.fillText("FLUXO OUTLET", 86, 190);
  ctx.fillStyle = "#aaa29a";
  ctx.font = "500 20px Arial, sans-serif";
  ctx.letterSpacing = "4px";
  ctx.fillText("REWARDS  /  BENEFÍCIO EXCLUSIVO", 86, 248);
  ctx.fillStyle = "#c6a463";
  ctx.font = "700 210px Arial, sans-serif";
  ctx.letterSpacing = "-8px";
  ctx.fillText(`${Number(reward.discount_percent)}%`, 78, 595);
  ctx.fillStyle = "#f4f4f3";
  ctx.font = "600 52px Arial, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("OFF", 88, 675);
  ctx.fillStyle = "#77736d";
  ctx.fillRect(88, 740, 904, 1);
  ctx.fillStyle = "#aaa29a";
  ctx.font = "500 22px Arial, sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText("FEITO PARA", 88, 820);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 48px Arial, sans-serif";
  ctx.letterSpacing = "0px";
  let name = String(reward.customer_name || "CLIENTE").toUpperCase();
  if (ctx.measureText(name).width > 900) {
    while (name.length > 4 && ctx.measureText(`${name}…`).width > 900) name = name.slice(0, -1);
    name = `${name}…`;
  }
  ctx.fillText(name, 88, 900);
  ctx.fillStyle = "#aaa29a";
  ctx.font = "500 22px Arial, sans-serif";
  ctx.letterSpacing = "3px";
  ctx.fillText("SEU CÓDIGO INDIVIDUAL", 88, 1010);
  rounded(82, 1050, 916, 132, 20);
  ctx.fillStyle = "#20201e";
  ctx.fill();
  ctx.strokeStyle = "rgba(198,164,99,.34)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "#f5f5f4";
  ctx.font = "700 42px monospace";
  ctx.letterSpacing = "2px";
  ctx.fillText(String(reward.code || "").toUpperCase(), 112, 1132);
  ctx.fillStyle = "#c6a463";
  ctx.font = "600 24px Arial, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText(`VÁLIDO ATÉ ${dateBR(reward.expires_at).toUpperCase()}`, 88, 1280);
  ctx.fillStyle = "#aaa29a";
  ctx.font = "400 20px Arial, sans-serif";
  ctx.letterSpacing = "0px";
  const terms = `Uso único e individual. Não cumulativo.${reward.max_discount ? ` Limite de desconto: ${money(reward.max_discount)}.` : ""}`;
  ctx.fillText(terms, 88, 1350, 900);
  ctx.fillStyle = "#6d6963";
  ctx.fillRect(88, 1415, 904, 1);
  ctx.fillStyle = "#aaa29a";
  ctx.font = "500 18px Arial, sans-serif";
  ctx.letterSpacing = "2px";
  ctx.fillText("APRESENTE O CÓDIGO NA LOJA", 88, 1480);
  ctx.fillStyle = "#c6a463";
  ctx.fillRect(88, 1522, 48, 3);
  return canvas;
}
