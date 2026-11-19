// Arma un video falso (formato Y4M) que enseña un QR, para darle a la cámara
// de mentira del navegador de pruebas. Uso: node qr_video.mjs "<texto>" salida.y4m
import qrcode from "qrcode-generator";
import { writeFileSync } from "node:fs";
const [texto, salida] = process.argv.slice(2);
const q = qrcode(0, "M"); q.addData(texto); q.make();
const n = q.getModuleCount(), W = 640, H = 480, celda = Math.floor(360 / (n + 8)), lado = celda * n;
const x0 = Math.floor((W - lado) / 2), y0 = Math.floor((H - lado) / 2);
const Y = Buffer.alloc(W * H, 235), UV = Buffer.alloc((W / 2) * (H / 2) * 2, 128);
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c))
  for (let y = 0; y < celda; y++) Y.fill(16, (y0 + r * celda + y) * W + x0 + c * celda, (y0 + r * celda + y) * W + x0 + (c + 1) * celda);
const cuadro = Buffer.concat([Buffer.from("FRAME\n"), Y, UV]);
writeFileSync(salida, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), ...Array(10).fill(cuadro)]));
