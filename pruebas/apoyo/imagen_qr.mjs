// Para los recorridos: hace la imagen (PGM) de un código QR, que ffmpeg convierte en el video de una cámara de imitación.
import qrcode from "qrcode-generator";
import { writeFileSync } from "fs";
const texto = process.argv[2], salida = process.argv[3];
const q = qrcode(0, "M"); q.addData(texto); q.make();
const n = q.getModuleCount(), esc = 10, borde = 4, lado = (n + 2 * borde) * esc;
// PGM (gris) simple: blanco con el código negro en el centro de un cuadro de 640x480
const W = 640, H = 480, img = Buffer.alloc(W * H, 255);
const x0 = Math.floor((W - lado) / 2), y0 = Math.floor((H - lado) / 2);
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c))
  for (let dy = 0; dy < esc; dy++) for (let dx = 0; dx < esc; dx++) img[(y0 + (r + borde) * esc + dy) * W + (x0 + (c + borde) * esc + dx)] = 0;
writeFileSync(salida, Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), img]));
console.log(n, lado);
