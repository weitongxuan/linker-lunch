import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FiltersProvider } from './state/FiltersContext.js';
import { App } from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('#root not found');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <FiltersProvider>
          <App />
        </FiltersProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
