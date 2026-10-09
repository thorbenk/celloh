import './style.css';
import { App } from './app';
import { requireElement } from './view/dom';

const app = new App(requireElement('#app', HTMLDivElement));
// Clean up listeners, resize observation, and pending playback during Vite hot reloads.
import.meta.hot?.dispose(() => app.destroy());
