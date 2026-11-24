import { QueryClientProvider } from '@tanstack/react-query';
import { LazyMotion, domAnimation } from 'framer-motion';
import './i18n';
import { queryClient } from './lib';
import { CafeProvider } from './context';
import { App } from './App';

// Load the existing website providers only for website routes. The arcade
// remains available without catalog, authentication, or storage initialization.
export default function SiteShell() {
  return (
    <QueryClientProvider client={queryClient}>
      <CafeProvider>
        <LazyMotion features={domAnimation}>
          <App />
        </LazyMotion>
      </CafeProvider>
    </QueryClientProvider>
  );
}
