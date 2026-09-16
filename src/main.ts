import './style.css';
import { startProjectApp } from './project/app.ts';
import { installLocalization } from './i18n/browser.ts';
const localization = installLocalization(document.querySelector<HTMLElement>('#app')!);
function exposeLocale() {
    const lab = window.wiringLab;
    if (!lab) throw new Error('Application integration interface is unavailable');
    Object.assign(lab, { getLocale: () => localization.controller.locale.id, setLocale: (locale: string) => localization.controller.setPreference(locale) });
    const dispose = lab.dispose;
    lab.dispose = () => { localization.dispose(); dispose?.(); };
}
// Historical component snapshots retain an explicit compatibility entry point.
if (location.pathname.endsWith('/mc1.html') || ['legacy', 'inspect'].some(key => new URLSearchParams(location.search).get(key) === 'MC1')) {
    import('./legacy-inspector.ts').then(exposeLocale);
}
else {
    startProjectApp();
    exposeLocale();
}
