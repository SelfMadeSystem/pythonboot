import index from './index.html';
import { serve } from 'bun';

function packageRoute(name: string) {
  return (req: Request) => {
    const url = new URL(req.url);
    // Get the path after /<name>/
    const filePath = url.pathname.replace(/^\/[a-zA-Z]+\//, '');
    // Serve the file from node_modules/<name>/
    return new Response(Bun.file(`./node_modules/${name}/${filePath}`));
  };
}

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    '/': index,
    '/pyodide/*': packageRoute('pyodide'),
    '/monaco/*': packageRoute('monaco-editor/min'),
  },

  development: process.env.NODE_ENV !== 'production' && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
