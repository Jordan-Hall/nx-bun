Bun.serve({
  port: 8080,
  async fetch(request: Request): Promise<Response> {
    return new Response('Hello World!');
  },
});

console.log(`Running on port http://localhost:8080`);
