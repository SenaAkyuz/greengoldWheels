/**
 * Shadow DOM içine enjekte edilen CSS.
 *
 * Görsel dil `greengold-wheels-mvp` tanıtım maketinden alındı: limon aksan,
 * koyu yeşil zemin/buton, dairesel "impact orbit", toggle switch, Georgia
 * başlıklar. Maketten FARKLI olan tek şey ölçü sistemi: orada her şey bir
 * telefon çerçevesi içinde sabit 390px genişliğe göreydi; burada widget
 * gerçek bir rezervasyon sayfasına gömülüyor, bu yüzden akışkan ve `container`
 * sorgularıyla dar/geniş kapsayıcıya uyum sağlıyor.
 *
 * `:host { all: initial }` dışarıdan miras alınan stilleri nötrler — kiralama
 * şirketinin agresif global CSS'i widget'ı bozamaz.
 */
export const STYLES = `
:host {
  all: initial;
  display: block;
  contain: content;
  container-type: inline-size;

  /* Maket paleti (greengold-wheels-mvp/style.css :root) */
  --gg-ink: #06261d;
  --gg-lime: #b9df38;
  --gg-line: #dce2dc;
  --gg-muted: #748079;
  /* Marka aksanı — şirketin brand_color'ı (doğrulanmış hex) override eder.
     Varsayılanı ink: aksan rengi butonun/zeminin rengidir, limon sabit kalır. */
  --gg-accent: var(--gg-ink);

  font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  line-height: 1.5;
  color: var(--gg-ink);
}
*, *::before, *::after { box-sizing: border-box; }

.card {
  width: 100%;
  max-width: 560px;
  background: linear-gradient(160deg, #f9fbf5 40%, #eff5dc);
  border: 1px solid var(--gg-line);
  border-radius: 20px;
  padding: 22px;
  position: relative;
  font-size: 14px;
}

.preview-badge {
  position: absolute; top: 14px; right: 14px;
  font-size: 10px; font-weight: 800; letter-spacing: .1em;
  text-transform: uppercase;
  color: #4a5c53; background: rgba(255,255,255,.85);
  border: 1px solid var(--gg-line);
  padding: 3px 9px; border-radius: 999px;
  white-space: nowrap;
}

/* --- Başlık --------------------------------------------------------------- */
.kicker {
  display: flex; align-items: center; gap: 8px;
  font-size: .65rem; font-weight: 900; letter-spacing: .15em;
  color: #698078; margin: 0 0 7px; text-transform: uppercase;
}
.kicker .logo { width: 18px; height: 18px; object-fit: contain; border-radius: 4px; }
.kicker .leaf { width: 16px; height: 16px; color: var(--gg-accent); flex: 0 0 auto; }

h2.heading {
  font: 700 1.65rem/1.05 Georgia, "Times New Roman", serif;
  margin: 0 0 10px;
  letter-spacing: -.02em;
  color: var(--gg-ink);
}
.copy { color: #64746d; font-size: .86rem; line-height: 1.5; margin: 0; }

/* --- Dairesel tahmini etki (maketteki .impact-orbit) ----------------------- */
.orbit {
  height: 174px; width: 174px;
  border: 1px solid #cada93; border-radius: 50%;
  margin: 20px auto;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  position: relative;
  background: rgba(255,255,255,.7);
  box-shadow: 0 0 0 12px rgba(185, 223, 56, .08);
}
.orbit::after {
  content: ""; position: absolute; right: 8px; top: 25px;
  width: 16px; height: 16px; background: var(--gg-lime); border-radius: 50%;
}
.orbit .orbit-label {
  font-size: .58rem; letter-spacing: .13em; color: var(--gg-muted); font-weight: 800;
  text-transform: uppercase;
}
.orbit .orbit-value {
  font: 700 2.9rem/1 Georgia, "Times New Roman", serif;
  font-variant-numeric: tabular-nums;
}
.orbit .orbit-unit { font-size: .75rem; color: #4a5c53; }

/* --- Hesap: formül + girdiler --------------------------------------------- */
.calculation { display: grid; gap: 10px; }
.formula {
  font-size: .7rem; text-align: center; color: #6f7c76;
  font-variant-numeric: tabular-nums; margin: 0;
}
.fields { display: grid; gap: 10px; grid-template-columns: 1fr 128px; }
.field { display: grid; gap: 6px; font-size: .7rem; font-weight: 800; }
.field > span { color: #4a5c53; letter-spacing: .02em; }
.field select, .field input {
  width: 100%; padding: 12px;
  border: 1px solid var(--gg-line); background: #fff; border-radius: 10px;
  font: 600 .9rem inherit; color: var(--gg-ink);
  appearance: none;
}
.field select {
  /* Yerel ok yerine tek tip bir chevron (tüm tarayıcılarda aynı görünür). */
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2306261d' stroke-width='2.4' stroke-linecap='round'><path d='M6 9l6 6 6-6'/></svg>");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 14px;
  padding-right: 32px;
}
.field select:focus-visible, .field input:focus-visible {
  outline: 3px solid rgba(185, 223, 56, .55); outline-offset: 1px;
  border-color: var(--gg-accent);
}
.distance { position: relative; }
.distance input { padding-right: 36px; }
.distance .unit {
  position: absolute; right: 12px; bottom: 13px;
  font-size: .78rem; color: var(--gg-muted); pointer-events: none;
}

/* --- Katkı (maketteki .contribution toggle) -------------------------------- */
.contribution {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: #fff;
  border: 1.5px solid var(--gg-lime);
  border-radius: 14px;
  padding: 14px;
  margin-top: 13px;
  cursor: pointer;
}
.contribution > span { display: grid; gap: 4px; }
.contribution b { font-size: .8rem; }
.contribution .amount {
  color: #658000; font-weight: 850; font-size: .82rem;
  font-variant-numeric: tabular-nums;
}
.contribution input { position: absolute; opacity: 0; width: 0; height: 0; }
.contribution .switch {
  flex: 0 0 auto;
  width: 42px; height: 24px; background: #dbe1dc; border-radius: 99px;
  position: relative; transition: background .2s ease;
}
.contribution .switch::after {
  content: ""; position: absolute;
  width: 18px; height: 18px; left: 3px; top: 3px;
  background: #fff; border-radius: 50%;
  box-shadow: 0 1px 5px #839089;
  transition: transform .2s ease, background .2s ease;
}
.contribution input:checked + .switch { background: var(--gg-lime); }
.contribution input:checked + .switch::after {
  transform: translateX(18px); background: var(--gg-ink);
}
.contribution input:focus-visible + .switch {
  outline: 3px solid rgba(185, 223, 56, .55); outline-offset: 2px;
}
.contribution.disabled { opacity: .55; cursor: not-allowed; border-color: var(--gg-line); }

/* --- Buton ---------------------------------------------------------------- */
.primary {
  width: 100%; border: 0; border-radius: 12px;
  background: var(--gg-accent); color: #fff;
  padding: 14px 16px;
  font: 850 .92rem inherit;
  margin-top: 16px; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  transition: filter .15s ease;
}
.primary:hover:not(:disabled) { filter: brightness(1.18); }
.primary:focus-visible { outline: 3px solid rgba(185, 223, 56, .6); outline-offset: 2px; }
.primary:disabled { background: #cfd6d1; color: #88938e; cursor: not-allowed; }
.primary .arrow { font-size: 1.05rem; line-height: 1; }

/* --- Notlar / onay -------------------------------------------------------- */
.note { font-size: .68rem; color: #7e8b85; margin: 10px 0 0; text-align: center; }

.confirm {
  margin-top: 14px;
  display: flex; align-items: flex-start; gap: 10px;
  padding: 13px; border-radius: 14px;
  background: #fff; border: 1.5px solid var(--gg-lime);
  color: var(--gg-ink); font-size: .82rem;
}
.confirm .check {
  flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%;
  background: var(--gg-lime); display: grid; place-items: center;
}
.confirm .check svg { width: 13px; height: 13px; color: var(--gg-ink); }

.impact-line {
  margin: 12px 0 0; padding-top: 11px;
  border-top: 1px solid var(--gg-line);
  font-size: .7rem; color: #5f6f68;
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap; justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .primary, .contribution .switch, .contribution .switch::after { transition: none; }
}

/* Dar kapsayıcıda (telefon ya da dar kolon) tek sütuna düş. */
@container (max-width: 420px) {
  .card { padding: 18px; }
  .fields { grid-template-columns: 1fr; }
  .orbit { height: 150px; width: 150px; }
  .orbit .orbit-value { font-size: 2.4rem; }
}
`;
