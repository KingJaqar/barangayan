import { hydrateRoot } from 'react-dom/client';
import { ThemeFixture } from './hydration-fixture';

window.hydrationErrors = [];
hydrateRoot(document.getElementById('root'), <ThemeFixture initialCustomColors={window.initialCustomColors} />, {
  onRecoverableError: error => window.hydrationErrors.push(error.message),
});
