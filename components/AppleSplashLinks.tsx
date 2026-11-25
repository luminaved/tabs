import splash from '@/lib/appleSplashDevices.json';

/**
 * Стартовые картинки для ярлыка на iOS.
 *
 * Без них при запуске с домашнего экрана система показывает белый экран с
 * растянутой иконкой — на тёмном сайте это вспышка не своим цветом. Здесь
 * заставка своя: фон темы и знак по центру (см. scripts/make-splash.mjs).
 *
 * ── Почему тег на каждый экран ──────────────────────────────────────────────
 *
 * iOS подхватывает картинку, только если её размер совпадает с экраном ровно,
 * пиксель в пиксель, — поэтому и медиазапрос описывает конкретное устройство, и
 * файл лежит отдельный. Список общий с генератором
 * ([lib/appleSplashDevices.json](../lib/appleSplashDevices.json)): разъехались
 * бы — часть телефонов молча вернулась бы к белому экрану.
 *
 * `device-width`/`device-height` в медиазапросе ВСЕГДА портретные: в iOS они
 * описывают сам экран и при повороте местами не меняются. Ориентацию задаёт
 * только `orientation`.
 *
 * Метаданными Next это не выразить — его Metadata API умеет `<meta>`, но не
 * `<link>` с `media`. Поэтому теги рисуются компонентом, а React 19 сам
 * поднимает их в `<head>`.
 *
 * Цена — три десятка ссылок в разметке каждой страницы, включая Android и
 * десктоп, где они не нужны. Отдавать их выборочно нельзя: разметка у всех
 * одна и кэшируется целиком. В сжатом виде это сотни байт — теги отличаются
 * пятью числами и жмутся почти в ноль.
 */
export function AppleSplashLinks() {
  return (
    <>
      {splash.devices.flatMap((device) =>
        (['portrait', 'landscape'] as const).map((orientation) => (
          <link
            key={`${device.width}x${device.height}@${device.dpr}-${orientation}`}
            rel="apple-touch-startup-image"
            media={
              `(device-width: ${device.width}px) and (device-height: ${device.height}px) and ` +
              `(-webkit-device-pixel-ratio: ${device.dpr}) and (orientation: ${orientation})`
            }
            href={`/splash/${device.width}x${device.height}@${device.dpr}x-${orientation}.png`}
          />
        )),
      )}
    </>
  );
}
