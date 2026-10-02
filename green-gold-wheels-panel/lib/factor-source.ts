/**
 * Emisyon faktörünün kaynağı, kullanıcıya gösterilirken.
 *
 * Veritabanında yeni bir şirket kurulurken faktör kaynağı teknik bir değerle
 * (`placeholder`) yazılır — bu, Green Gold'un kurulumda koyduğu başlangıç
 * değeridir. Bu teknik kelime panelde OLDUĞU GİBİ gösterilmez; okunabilir bir
 * karşılığı yazılır. Veri değişmez, yalnızca etiket.
 *
 * `lib/api.ts` 'server-only' olduğu için bu yardımcılar ayrı dosyada:
 * hem sunucu sayfaları hem de form bileşenleri (client) kullanır.
 */
const SYSTEM_DEFAULT = 'placeholder';

export function isSystemDefaultSource(source: string): boolean {
  return source.trim().toLowerCase() === SYSTEM_DEFAULT;
}

/** Tablolarda/etiketlerde gösterilecek kaynak adı. */
export function factorSourceLabel(source: string): string {
  return isSystemDefaultSource(source) ? 'Green Gold ön değeri' : source;
}
