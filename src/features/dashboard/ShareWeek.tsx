import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { useData } from '@/state/DataContext';
import { useToday } from '@/state/useToday';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/ui';
import { Dialog } from '@/components/Dialog';
import { Humito, type HumitoMood } from '@/components/brand';
import { DEFAULT_SHARE_OPTIONS, shareCardContent, type ShareContent, type ShareOptions } from '@/domain/shareCard';
import { formatMoney, formatNumber, formatPeriod } from '@/i18n';

const W = 1080;
const H = 1920;
const OPTION_LABELS: Record<keyof ShareOptions, string> = {
  freeDays: 'Días sin humo',
  streak: 'Racha sin humo',
  sessions: 'Sesiones de la semana',
  spending: 'Plata en humo',
};

async function svgToImage(svg: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

/** Dibuja la tarjeta en un canvas (todo local) y devuelve un PNG. */
async function renderCard(content: ShareContent, mood: HumitoMood): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');
  const display = '"Space Grotesk Variable", "Inter Variable", system-ui, sans-serif';
  const sans = '"Inter Variable", system-ui, sans-serif';
  try {
    await Promise.all([document.fonts.load(`600 80px ${display}`), document.fonts.load(`400 40px ${sans}`)]);
  } catch {
    // con fuentes del sistema también se ve bien
  }

  // Fondo carbón con halo lima tenue.
  ctx.fillStyle = '#0b0c0e';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.75, 260, 0, W * 0.75, 260, 900);
  glow.addColorStop(0, 'rgba(182,243,106,0.16)');
  glow.addColorStop(1, 'rgba(182,243,106,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Volutas de humo.
  ctx.strokeStyle = 'rgba(182,243,106,0.06)';
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-40, 1650);
  ctx.bezierCurveTo(260, 1450, 420, 1800, 700, 1600);
  ctx.bezierCurveTo(880, 1470, 1000, 1560, 1140, 1500);
  ctx.stroke();

  // Marca.
  ctx.fillStyle = '#eceef1';
  ctx.font = `600 52px ${display}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Fum', 90, 150);
  const fumW = ctx.measureText('Fum').width;
  ctx.fillStyle = '#b6f36a';
  ctx.fillText('ó', 90 + fumW, 150);
  const oW = ctx.measureText('ó').width;
  ctx.fillStyle = '#eceef1';
  ctx.fillText('metro', 90 + fumW + oW, 150);
  ctx.fillStyle = '#a7adb5';
  ctx.font = `400 34px ${sans}`;
  ctx.fillText(`Mi semana · ${formatPeriod(content.period)}`, 90, 210);

  // Humito.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const svg = renderToStaticMarkup(<Humito mood={mood} className="" float={false} />).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="480" ');
  const img = await svgToImage(svg);
  ctx.drawImage(img, (W - 560) / 2, 300, 560, 480);

  // Titular.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#eceef1';
  ctx.font = `600 84px ${display}`;
  ctx.fillText(content.headline, W / 2, 900);

  // Estadísticas elegidas.
  const top = 1000;
  const rowH = 190;
  content.stats.forEach((s, i) => {
    const y = top + i * rowH;
    ctx.fillStyle = '#121417';
    ctx.strokeStyle = '#272b31';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(90, y, W - 180, rowH - 30, 32);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = '#b6f36a';
    ctx.font = `600 88px ${display}`;
    ctx.fillText(s.value, 140, y + 112);
    const vw = ctx.measureText(s.value).width;
    ctx.fillStyle = '#d7dbe0';
    ctx.font = `400 38px ${sans}`;
    ctx.fillText(s.label, 140 + vw + 32, y + 104, W - 180 - (vw + 112));
  });

  // Pie.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#858c95';
  ctx.font = `400 32px ${sans}`;
  ctx.fillText('Registro privado: mis datos quedan en mi celular', W / 2, H - 150);
  ctx.fillStyle = '#a7adb5';
  ctx.fillText('fumometro.onrender.com', W / 2, H - 100);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}

/** Botón + diálogo «Compartir mi semana». */
export function ShareWeek({ mood }: { mood: HumitoMood }) {
  const { data } = useData();
  const today = useToday();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ShareOptions>(DEFAULT_SHARE_OPTIONS);
  const [png, setPng] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url: string | null = null;
    const content = shareCardContent(data, today, opts, { money: formatMoney, number: (n) => formatNumber(n, 1) });
    renderCard(content, mood)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPng({ blob, url });
        setError(null);
      })
      .catch(() => !cancelled && setError('Este navegador no pudo generar la imagen.'));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, opts, data, today, mood]);

  const filename = `fumometro-semana-${today}.png`;

  async function share() {
    if (!png) return;
    const file = new File([png.blob], filename, { type: 'image/png' });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }
    download();
  }

  function download() {
    if (!png) return;
    const a = document.createElement('a');
    a.href = png.url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('Imagen descargada');
  }

  return (
    <>
      <Button size="sm" icon={Share2} onClick={() => setOpen(true)}>
        Compartir mi semana
      </Button>
      <Dialog open={open} title="Compartir mi semana" onClose={() => setOpen(false)}>
        <div className="grid gap-4">
          <p>La imagen se crea en tu dispositivo. Elegí qué mostrar: nada más sale de acá.</p>
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Qué mostrar</legend>
            {(Object.keys(OPTION_LABELS) as (keyof ShareOptions)[]).map((k) => (
              <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-fg">
                <input type="checkbox" className="size-4 accent-[#b6f36a]" checked={opts[k]} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} />
                {OPTION_LABELS[k]}
              </label>
            ))}
          </fieldset>
          <div className="mx-auto w-40 overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-bg sm:w-48" style={{ aspectRatio: '9 / 16' }}>
            {png ? (
              <img src={png.url} alt="Vista previa de la tarjeta de tu semana" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-xs text-fg-subtle">{error ?? 'Generando…'}</div>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button icon={Download} onClick={download} disabled={!png}>
              Descargar
            </Button>
            <Button variant="primary" icon={Share2} onClick={() => void share()} disabled={!png}>
              Compartir
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
