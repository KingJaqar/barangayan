import { renderToString } from 'react-dom/server';
import { ThemeFixture } from './hydration-fixture';
export function render(initialCustomColors) { return renderToString(<ThemeFixture initialCustomColors={initialCustomColors} />); }
