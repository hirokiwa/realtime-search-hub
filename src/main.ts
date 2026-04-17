import { mountApplication } from './app/createApp.ts';

const rootElement = document.querySelector<HTMLElement>('[data-application-root]');

if (rootElement !== null) {
  mountApplication(rootElement);
}
