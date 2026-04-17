import { mountApplication } from './app/createApp.ts';

const rootElement = document.querySelector<HTMLElementTagNameMap['main']>('[data-application-root]');

if (rootElement !== null) {
  mountApplication(rootElement);
}
